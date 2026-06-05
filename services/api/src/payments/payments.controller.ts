import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  Res,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ChargilyService } from './chargily/chargily.service';
import { SupabaseAuthGuard, AuthenticatedUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly chargily: ChargilyService,
    private readonly supabase: SupabaseService,
  ) {}

  /**
   * POST /payments/checkout
   * Create a Chargily checkout session for a subscription plan.
   */
  @Post('checkout')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('Coiffeur')
  @HttpCode(HttpStatus.OK)
  async createCheckout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { plan: string; amount: number },
  ) {
    // Find the user's salon
    const { data: salon } = await this.supabase.adminClient
      .from('salons')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (!salon) {
      return { error: 'Aucun salon trouvé pour cet utilisateur' };
    }

    const result = await this.chargily.createCheckoutUrl(
      body.amount,
      salon.id,
      body.plan,
    );

    this.logger.log(
      `Checkout created for salon ${salon.id}: plan=${body.plan}, amount=${body.amount} DZD`,
    );

    return result;
  }

  /**
   * POST /payments/webhook
   * Handle Chargily payment webhook — activates subscription on successful payment.
   */
  @Post('webhook')
  async handleWebhook(
    @Headers('signature') signature: string,
    @Req() req: Request & { rawBody?: Buffer },
    @Res() res: Response,
  ) {
    const rawBody = req.rawBody
      ? req.rawBody.toString()
      : JSON.stringify(req.body);

    if (!this.chargily.verifySignature(signature, rawBody)) {
      return res.status(403).send('Invalid signature');
    }

    try {
      const payload = JSON.parse(rawBody);

      // Process checkout.paid event — activate subscription
      if (payload.type === 'checkout.paid' && payload.data?.metadata) {
        const { salon_id, plan } = payload.data.metadata;
        const amount = payload.data.amount;

        if (salon_id) {
          // 1. Record payment
          await this.supabase.adminClient.from('payments').insert({
            salon_id,
            amount: amount || 0,
            status: 'Completed',
            provider_payment_id: payload.data.id || payload.id,
          });

          // 2. Activate subscription (+30 days)
          const endsAt = new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString();

          await this.supabase.adminClient
            .from('subscriptions')
            .update({
              status: 'Active',
              plan: plan || 'Pro',
              starts_at: new Date().toISOString(),
              ends_at: endsAt,
            })
            .eq('salon_id', salon_id);

          // 3. Update salon subscription_status
          await this.supabase.adminClient
            .from('salons')
            .update({
              subscription_status: 'Active',
              subscription_ends_at: endsAt,
            })
            .eq('id', salon_id);

          this.logger.log(
            `Payment processed: salon=${salon_id}, plan=${plan}, amount=${amount} DZD`,
          );
        }
      }
    } catch (err) {
      this.logger.error('Webhook processing error:', err);
    }

    return res.status(200).send('OK');
  }
}
