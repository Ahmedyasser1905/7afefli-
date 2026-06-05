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
   * Now reads price from subscription_plans table (dynamic).
   */
  @Post('checkout')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('Coiffeur')
  @HttpCode(HttpStatus.OK)
  async createCheckout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { plan: string },
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

    // Fetch plan details from DB (dynamic pricing)
    const { data: planData } = await this.supabase.adminClient
      .from('plans')
      .select('slug, price, name')
      .eq('slug', body.plan.toLowerCase())
      .eq('is_active', true)
      .maybeSingle();

    if (!planData) {
      return { error: 'Plan introuvable ou inactif' };
    }

    const result = await this.chargily.createCheckoutUrl(
      planData.price,
      salon.id,
      planData.slug,
    );

    this.logger.log(
      `Checkout created for salon ${salon.id}: plan=${planData.name}, amount=${planData.price} DZD`,
    );

    return result;
  }

  /**
   * POST /payments/webhook
   * Handle Chargily payment webhook — activates subscription on successful payment.
   * Now uses dynamic duration from subscription_plans table.
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
          // Fetch dynamic duration from subscription_plans
          const { data: planData } = await this.supabase.adminClient
            .from('plans')
            .select('duration_days')
            .eq('slug', (plan || 'pro').toLowerCase())
            .maybeSingle();

          const durationDays = planData?.duration_days || 30;
          const endsAt = durationDays === 0 
            ? null 
            : new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

          // 1. Record payment
          await this.supabase.adminClient.from('payments').insert({
            salon_id,
            amount: amount || 0,
            status: 'Completed',
            provider_payment_id: payload.data.id || payload.id,
          });

          // 2. Activate subscription (sync trigger auto-updates salon)
          await this.supabase.adminClient
            .from('user_subscriptions')
            .update({
              status: 'Active',
              plan: plan || 'Pro',
              starts_at: new Date().toISOString(),
              ends_at: endsAt,
            })
            .eq('salon_id', salon_id);

          this.logger.log(
            `Payment processed: salon=${salon_id}, plan=${plan}, amount=${amount} DZD, duration=${durationDays}d`,
          );
        }
      }
    } catch (err) {
      this.logger.error('Webhook processing error:', err);
    }

    return res.status(200).send('OK');
  }
}
