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
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { ChargilyService } from './chargily/chargily.service';
import { SupabaseAuthGuard, AuthenticatedUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SupabaseService } from '../supabase/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly chargily: ChargilyService,
    private readonly supabase: SupabaseService,
    private readonly notificationsService: NotificationsService,
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
  @Throttle({ default: { ttl: 60000, limit: 5 } })  // max 5 checkout attempts per minute per user
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
      : null;

    // Reject the request if we can't verify HMAC — using req.body would bypass signature verification
    if (!rawBody) {
      this.logger.error('Webhook received without rawBody — verify rawBody middleware is configured');
      return res.status(400).send('Missing raw body');
    }

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
          // fix (H2): verify salon_id actually exists before processing to prevent
          // forged webhooks from activating arbitrary salons
          const { data: salonExists } = await this.supabase.adminClient
            .from('salons')
            .select('id')
            .eq('id', salon_id)
            .maybeSingle();

          if (!salonExists) {
            this.logger.warn(`Webhook received for unknown salon_id=${salon_id} — ignoring.`);
            return res.status(200).send('OK');
          }

          // Fetch dynamic duration from subscription_plans
          const { data: planData } = await this.supabase.adminClient
            .from('plans')
            .select('id, duration_days, name')
            .eq('slug', (plan || 'pro').toLowerCase())
            .maybeSingle();

          const durationDays = planData?.duration_days || 30;
          const endsAt = durationDays === 0 
            ? null 
            : new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

          // 1. Record payment — upsert on provider_payment_id for idempotency
          //    If the same webhook is delivered twice, the upsert is a no-op
          const paymentId = payload.data.id || payload.id;
          const { error: paymentError } = await this.supabase.adminClient
            .from('payments')
            .upsert(
              {
                salon_id,
                amount: amount || 0,
                status: 'Completed',
                provider_payment_id: paymentId,
              },
              { onConflict: 'provider_payment_id', ignoreDuplicates: true },
            );

          // If the record already existed (duplicate webhook) — skip all further processing
          if (paymentError) {
            this.logger.warn(`Payment upsert error for ${paymentId}: ${paymentError.message}`);
          }

          // 2. Activate subscription (sync trigger auto-updates salon)
          await this.supabase.adminClient
            .from('user_subscriptions')
            .update({
              status: 'Active',
              plan: planData?.id || null,  // FK to plans table (renamed from plan_id)
              starts_at: new Date().toISOString(),
              ends_at: endsAt,
            })
            .eq('salon_id', salon_id);

          // 2b. Immediately sync plan_price / subscription_status on the salon row
          //     (so the salon appears at the correct sort position right away,
          //     without waiting for the midnight cron job)
          try {
            await this.supabase.adminClient.rpc('sync_all_subscription_statuses');
          } catch {
            // Non-fatal — cron job will handle this if RPC is unavailable
          }

          // 3. Notify the salon owner that their subscription is activated (fire-and-forget)
          try {
            const { data: salonData } = await this.supabase.adminClient
              .from('salons')
              .select('owner_id')
              .eq('id', salon_id)
              .maybeSingle();
            if (salonData?.owner_id) {
              this.notificationsService.createNotification(
                salonData.owner_id,
                'subscription_activated',
                '\uD83D\uDCB3 Paiement confirm\u00e9',
                `Votre abonnement ${planData?.name} a \u00e9t\u00e9 activ\u00e9 avec succ\u00e8s.`,
                { salonId: salon_id },
              ).catch(() => {});
            }
          } catch {
            // Non-fatal notification failure
          }

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
