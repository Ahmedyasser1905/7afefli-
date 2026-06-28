import {
  Controller,
  Get,
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
   * - Free plans (price = 0) are activated directly — Chargily rejects amount=0.
   * - Paid plans go through Chargily and return a checkout_url.
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
    const { data: planData, error: planError } = await this.supabase.adminClient
      .from('plans')
      .select('id, slug, price, name, duration_days')
      .eq('slug', body.plan.toLowerCase())
      .eq('is_active', true)
      .maybeSingle();

    if (planError) {
      this.logger.error(`Failed to fetch plan "${body.plan}": ${planError.message}`);
      return { error: 'Erreur lors de la récupération du plan' };
    }

    if (!planData) {
      return { error: 'Plan introuvable ou inactif' };
    }

    // ── Free / zero-price plan: activate directly, no Chargily needed ──────
    // Chargily requires amount >= 100 DZD — sending 0 causes a 422 which
    // the service re-throws as a 502 Bad Gateway. Handle it gracefully here.
    if (!planData.price || planData.price <= 0) {
      this.logger.log(
        `Free plan activation for salon ${salon.id}: plan=${planData.name}`,
      );

      const endsAt = planData.duration_days > 0
        ? new Date(Date.now() + planData.duration_days * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { error: subError } = await this.supabase.adminClient
        .from('user_subscriptions')
        .upsert(
          {
            salon_id: salon.id,
            plan: planData.id,
            status: 'Active',
            starts_at: new Date().toISOString(),
            ends_at: endsAt,
            trial_ends_at: null,
          },
          { onConflict: 'salon_id' },
        );

      if (subError) {
        this.logger.error(`Free plan upsert failed for salon ${salon.id}: ${subError.message}`);
        return { error: 'Erreur lors de l\'activation du plan gratuit' };
      }

      // Return a special flag so the mobile app knows to refresh without a redirect
      return { activated: true, checkout_url: null };
    }

    // ── Paid plan: go through Chargily ──────────────────────────────────────
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
   * GET /payments/success
   * Chargily requires an HTTPS success_url. This endpoint bridges the gap by
   * serving an HTML page that immediately redirects the mobile WebView / browser
   * to the app's deep link (hafefli://payment/success).
   */
  @Get('success')
  @HttpCode(HttpStatus.OK)
  paymentSuccess(@Res() res: Response) {
    const deepLink = process.env.PAYMENT_DEEPLINK_SUCCESS || 'hafefli://payment/success';
    return res.status(200).send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Paiement confirmé — 7afefli</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         background:#0f0f0f;color:#fff;min-height:100vh;
         display:flex;align-items:center;justify-content:center;text-align:center;padding:24px}
    .card{max-width:360px;width:100%}
    .icon{font-size:64px;margin-bottom:20px}
    h1{font-size:22px;font-weight:700;margin-bottom:8px;color:#22c55e}
    p{font-size:15px;color:#aaa;margin-bottom:32px;line-height:1.5}
    .btn{display:none;width:100%;padding:16px;background:#e8a020;color:#000;
         border:none;border-radius:14px;font-size:16px;font-weight:700;
         cursor:pointer;text-decoration:none;margin-bottom:12px}
    .btn:active{opacity:.85}
    .hint{font-size:13px;color:#666}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Paiement confirmé !</h1>
    <p>Votre abonnement a été activé avec succès.<br>Retour vers l'application...</p>
    <a id="btn" class="btn" href="${deepLink}">Ouvrir 7afefli</a>
    <p id="hint" class="hint" style="display:none">Si l'application ne s'ouvre pas,<br>appuyez sur le bouton ci-dessus.</p>
  </div>
  <script>
    // 1. Try to open the app immediately
    window.location.href = '${deepLink}';
    // 2. After 1.5s, if we're still here, show the manual button
    setTimeout(function(){
      document.getElementById('btn').style.display='block';
      document.getElementById('hint').style.display='block';
    }, 1500);
  </script>
</body>
</html>`);
  }

  /**
   * GET /payments/failure
   * Same bridge pattern as /payments/success but for failed / cancelled payments.
   */
  @Get('failure')
  @HttpCode(HttpStatus.OK)
  paymentFailure(@Res() res: Response) {
    const deepLink = process.env.PAYMENT_DEEPLINK_FAILURE || 'hafefli://payment/failure';
    return res.status(200).send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Paiement non complété — 7afefli</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         background:#0f0f0f;color:#fff;min-height:100vh;
         display:flex;align-items:center;justify-content:center;text-align:center;padding:24px}
    .card{max-width:360px;width:100%}
    .icon{font-size:64px;margin-bottom:20px}
    h1{font-size:22px;font-weight:700;margin-bottom:8px;color:#ef4444}
    p{font-size:15px;color:#aaa;margin-bottom:32px;line-height:1.5}
    .btn{display:none;width:100%;padding:16px;background:#e8a020;color:#000;
         border:none;border-radius:14px;font-size:16px;font-weight:700;
         cursor:pointer;text-decoration:none;margin-bottom:12px}
    .btn:active{opacity:.85}
    .hint{font-size:13px;color:#666}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">❌</div>
    <h1>Paiement non complété</h1>
    <p>Le paiement n'a pas été finalisé.<br>Retour vers l'application...</p>
    <a id="btn" class="btn" href="${deepLink}">Retourner à 7afefli</a>
    <p id="hint" class="hint" style="display:none">Si l'application ne s'ouvre pas,<br>appuyez sur le bouton ci-dessus.</p>
  </div>
  <script>
    window.location.href = '${deepLink}';
    setTimeout(function(){
      document.getElementById('btn').style.display='block';
      document.getElementById('hint').style.display='block';
    }, 1500);
  </script>
</body>
</html>`);
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

          // 2. Activate / renew subscription — upsert on salon_id (one record per salon).
          //    This handles both first-time activation and renewals correctly.
          //    The lock trigger now allows same-plan renewal and upgrades.
          const { error: subError } = await this.supabase.adminClient
            .from('user_subscriptions')
            .upsert(
              {
                salon_id,
                plan: planData?.id || null,
                status: 'Active',
                starts_at: new Date().toISOString(),
                ends_at: endsAt,
                trial_ends_at: null,  // clear trial on paid activation
              },
              { onConflict: 'salon_id' },
            );

          if (subError) {
            this.logger.error(`Subscription upsert failed for salon ${salon_id}: ${subError.message}`);
          } else {
            this.logger.log(`Subscription activated for salon ${salon_id}: plan=${plan}, ends_at=${endsAt}`);
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
