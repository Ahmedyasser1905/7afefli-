import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly audit: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Get all active subscription plans (public catalog).
   */
  async getPlans() {
    const { data, error } = await this.supabase.adminClient
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      this.logger.error('Failed to fetch plans:', error.message);
      return [];
    }
    return (data || []).map(plan => ({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      duration: plan.duration_days,
      duration_days: plan.duration_days,
      max_barbers: plan.max_barbers,
      max_photos: plan.max_portfolio_photos,
      max_portfolio_photos: plan.max_portfolio_photos,
      max_reservations: plan.max_reservations,
      features: plan.features,
      is_active: plan.is_active,
      sort_order: plan.sort_order,
      slug: plan.slug,
      is_recommended: plan.is_recommended,
      featured_listing: plan.featured_listing,
      sponsored_listing: plan.sponsored_listing,
      premium_badge: plan.premium_badge,
      advanced_statistics: plan.advanced_statistics,
      marketing_included: plan.marketing_included,
      priority_support: plan.priority_support,
    }));
  }

  /**
   * Daily subscription checks:
   * 1. Expire trials past trial_ends_at → downgrade to free plan
   * 2. Keep active trials on the trial plan (is_trial_plan = true)
   * 3. Expire active paid subscriptions past ends_at
   * 4. Sync salon status (handled by trigger, but double-check)
   */
  @Cron('0 0 * * *', { timeZone: 'Africa/Algiers' })
  async handleDailySubscriptionChecks() {
    this.logger.log('Running daily subscription checks...');
    const now = new Date().toISOString();

    // Fetch default free plan (price = 0) dynamically
    const { data: defaultPlan } = await this.supabase.adminClient
      .from('plans')
      .select('id, name')
      .eq('price', 0)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    const defaultPlanId = defaultPlan?.id || null;
    const defaultPlanName = defaultPlan?.name || 'Free';

    // Fetch the trial plan (is_trial_plan = true, e.g. Pro) dynamically
    const { data: trialPlan } = await this.supabase.adminClient
      .from('plans')
      .select('id, name')
      .eq('is_trial_plan', true)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    const trialPlanId = trialPlan?.id || null;

    // Ensure all active Trial subscriptions are on the trial plan
    if (trialPlanId) {
      await this.supabase.adminClient
        .from('user_subscriptions')
        .update({ plan: trialPlanId })
        .eq('status', 'Trial')
        .gte('trial_ends_at', now)
        .neq('plan', trialPlanId);
    }

    // H5 Fix: Downgrade trials → Free Plan ('Active')
    const { data: expiredTrials, error: trialErr } = await this.supabase.adminClient
      .from('user_subscriptions')
      .update({ status: 'Active', plan: defaultPlanId, trial_ends_at: null, ends_at: null })
      .eq('status', 'Trial')
      .lt('trial_ends_at', now)
      .select('salon_id');

    if (trialErr) {
      this.logger.error('Failed to expire trials:', trialErr.message);
    } else if (expiredTrials?.length) {
      this.logger.log(`Downgraded ${expiredTrials.length} trial(s) → ${defaultPlanName} / Active`);

      // Notify each expired trial barber
      for (const { salon_id } of expiredTrials) {
        try {
          const { data: salonData } = await this.supabase.adminClient
            .from('salons')
            .select('owner_id')
            .eq('id', salon_id)
            .maybeSingle();
          if (salonData?.owner_id) {
            this.notificationsService.createNotification(
              salonData.owner_id,
              'subscription_expiring',
              '⏰ Période d\'essai terminée',
              'Votre période d\'essai est terminée. Passez à un plan payant pour continuer à recevoir des réservations.',
              { salonId: salon_id },
            ).catch(() => {});
          }
        } catch {
          // Non-fatal notification failure
        }
      }
    }

    // H5 Fix: Downgrade paid subscriptions → Free Plan ('Active')
    const { data: expiredActive, error: activeErr } = await this.supabase.adminClient
      .from('user_subscriptions')
      .update({ status: 'Active', plan: defaultPlanId, trial_ends_at: null, ends_at: null })
      .eq('status', 'Active')
      .not('plan', 'eq', defaultPlanId)
      .lt('ends_at', now)
      .select('salon_id');

    if (activeErr) {
      this.logger.error('Failed to expire active subs:', activeErr.message);
    } else if (expiredActive?.length) {
      this.logger.log(`Downgraded ${expiredActive.length} subscription(s) → ${defaultPlanName} / Active`);

      // Notify each expired active subscription barber
      for (const { salon_id } of expiredActive) {
        try {
          const { data: salonData } = await this.supabase.adminClient
            .from('salons')
            .select('owner_id')
            .eq('id', salon_id)
            .maybeSingle();
          if (salonData?.owner_id) {
            this.notificationsService.createNotification(
              salonData.owner_id,
              'subscription_expiring',
              '📅 Abonnement expiré',
              'Votre abonnement a expiré. Renouvelez pour continuer à recevoir des réservations.',
              { salonId: salon_id },
            ).catch(() => {});
          }
        } catch {
          // Non-fatal notification failure
        }
      }
    }

    // Final sync: ensures salon.subscription_status column is consistent with user_subscriptions.status
    try {
      const { error } = await this.supabase.adminClient.rpc('sync_all_subscription_statuses');
      if (error) {
        this.logger.error('Failed to sync subscription statuses:', error.message);
      }
    } catch {
      // Ignore if function doesn't exist yet
    }

    // FIX-10: Auto-unsponsor salons whose sponsored_until date has passed
    const { error: sponsorErr } = await this.supabase.adminClient
      .from('salons')
      .update({ is_sponsored: false, sponsored_until: null })
      .eq('is_sponsored', true)
      .lt('sponsored_until', new Date().toISOString())
      .not('sponsored_until', 'is', null);

    if (sponsorErr) {
      this.logger.error('Failed to auto-unsponsor expired salons:', sponsorErr.message);
    } else {
      this.logger.log('Auto-unsponsor check completed.');
    }

    this.logger.log('Daily subscription checks completed.');
  }

  /**
   * Helper to map a plan row to the standard plan_details shape.
   */
  private mapPlanDetails(p: any) {
    if (!p) return null;
    return {
      id: p.id,
      name: p.name,
      price: p.price,
      duration: p.duration_days,
      duration_days: p.duration_days,
      max_barbers: p.max_barbers,
      max_photos: p.max_portfolio_photos,
      max_portfolio_photos: p.max_portfolio_photos,
      max_reservations: p.max_reservations,
      features: p.features,
      is_active: p.is_active,
      sort_order: p.sort_order,
      slug: p.slug,
      is_recommended: p.is_recommended,
      featured_listing: p.featured_listing,
      sponsored_listing: p.sponsored_listing,
      premium_badge: p.premium_badge,
      advanced_statistics: p.advanced_statistics,
      marketing_included: p.marketing_included,
      priority_support: p.priority_support,
      is_trial_plan: p.is_trial_plan ?? false,
    };
  }

  /**
   * Get the subscription plan for the authenticated owner's salon.
   * When the subscription is in Trial status and the trial hasn't expired,
   * plan_details reflects the trial plan (is_trial_plan = true, e.g. Pro)
   * so the user experiences full trial features. status remains 'Trial'.
   */
  async getMyPlan(ownerId: string) {
    // 1. Find the salon by owner
    const { data: salon } = await this.supabase.adminClient
      .from('salons')
      .select('id, subscription_status, trial_ends_at')
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (!salon) {
      throw new NotFoundException('Salon not found for this owner');
    }

    // 2. Fetch the trial plan (is_trial_plan = true) and free plan in parallel
    const [{ data: trialPlan }, { data: freePlan }] = await Promise.all([
      this.supabase.adminClient
        .from('plans')
        .select('*')
        .eq('is_trial_plan', true)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle(),
      this.supabase.adminClient
        .from('plans')
        .select('*')
        .eq('price', 0)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    // 3. Try to find a subscription record
    const { data: subscription } = await this.supabase.adminClient
      .from('user_subscriptions')
      .select('*, plans(*)')
      .eq('salon_id', salon.id)
      .order('starts_at', { ascending: false })
      .maybeSingle();

    if (subscription) {
      const isTrial = subscription.status === 'Trial';
      const trialActive = isTrial &&
        subscription.trial_ends_at &&
        new Date(subscription.trial_ends_at) > new Date();

      // During active trial: override plan_details with the trial plan (Pro)
      // so the user sees Pro features — while status stays 'Trial'
      const effectivePlan = trialActive && trialPlan
        ? trialPlan
        : subscription.plans;

      return {
        ...subscription,
        // Expose whether we're in trial so the UI can show the right badge
        is_trial_active: !!trialActive,
        plan_details: this.mapPlanDetails(effectivePlan),
      };
    }

    // 4. No subscription record — synthesise from salon data
    const isSalonTrial = (salon.subscription_status || 'Trial') === 'Trial';
    const trialActive = isSalonTrial &&
      salon.trial_ends_at &&
      new Date(salon.trial_ends_at) > new Date();

    const effectivePlan = trialActive && trialPlan ? trialPlan : freePlan;

    return {
      id: null,
      salon_id: salon.id,
      status: salon.subscription_status || 'Trial',
      plan: effectivePlan?.id || null,
      plan_details: this.mapPlanDetails(effectivePlan),
      is_trial_active: !!trialActive,
      trial_ends_at: salon.trial_ends_at || null,
      starts_at: null,
      ends_at: null,
      created_at: null,
    };
  }

  /**
   * Get the subscription plan for a client user (not a barber/salon owner).
   * Clients can subscribe to a Premium plan that unlocks sponsored salon visibility.
   */
  async getMyClientPlan(userId: string): Promise<{ plan: string; isPremium: boolean }> {
    const { data: subscription } = await this.supabase.adminClient
      .from('client_subscriptions')
      .select('plan, status, ends_at')
      .eq('user_id', userId)
      .eq('status', 'Active')
      .order('ends_at', { ascending: false })
      .maybeSingle();

    if (subscription) {
      // Look up if this plan grants premium status dynamically (we can assume client_subscriptions will eventually map to client_plans)
      // For now, if they have an active plan, check if it's not a free one
      if (subscription.plan !== 'Free') {
        const now = new Date();
        const endsAt = subscription.ends_at ? new Date(subscription.ends_at) : null;
        if (!endsAt || endsAt > now) {
          return { plan: subscription.plan, isPremium: true };
        }
      }
    }

    return { plan: 'Free', isPremium: false };
  }
}
