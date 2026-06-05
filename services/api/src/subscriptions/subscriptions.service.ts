import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditService } from '../audit/audit.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly audit: AuditService,
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
    return data || [];
  }

  /**
   * Daily subscription checks:
   * 1. Expire trials past trial_ends_at
   * 2. Expire active subscriptions past ends_at
   * 3. Sync salon status (handled by trigger, but double-check)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailySubscriptionChecks() {
    this.logger.log('Running daily subscription checks...');
    const now = new Date().toISOString();

    // Fetch basic plan ID
    const { data: basicPlan } = await this.supabase.adminClient
      .from('plans')
      .select('id')
      .eq('slug', 'basic')
      .maybeSingle();

    const basicPlanId = basicPlan?.id || null;

    // Expire trials (Fallback to Basic)
    const { data: expiredTrials, error: trialErr } = await this.supabase.adminClient
      .from('user_subscriptions')
      .update({ status: 'Active', plan: 'Basic', plan_id: basicPlanId, trial_ends_at: null, ends_at: null })
      .eq('status', 'Trial')
      .lt('trial_ends_at', now)
      .select('salon_id');

    if (trialErr) {
      this.logger.error('Failed to expire trials:', trialErr.message);
    } else if (expiredTrials?.length) {
      this.logger.log(`Transitioned ${expiredTrials.length} trial(s) to Basic plan`);
    }

    // Expire active subscriptions (Fallback to Basic)
    const { data: expiredActive, error: activeErr } = await this.supabase.adminClient
      .from('user_subscriptions')
      .update({ status: 'Active', plan: 'Basic', plan_id: basicPlanId, trial_ends_at: null, ends_at: null })
      .eq('status', 'Active')
      .neq('plan', 'Basic')
      .lt('ends_at', now)
      .select('salon_id');

    if (activeErr) {
      this.logger.error('Failed to expire active subs:', activeErr.message);
    } else if (expiredActive?.length) {
      this.logger.log(`Transitioned ${expiredActive.length} active subscription(s) to Basic plan`);
    }

    // The sync trigger should have updated salon status,
    // but let's double-check for any desync
    try {
      const { error } = await this.supabase.adminClient.rpc(
        'sync_all_subscription_statuses',
      );
      if (error) {
        this.logger.error('Failed to sync subscription statuses:', error.message);
      }
    } catch (err) {
      // Ignore if function doesn't exist
    }

    this.logger.log('Daily subscription checks completed.');
  }

  /**
   * Get the subscription plan for the authenticated owner's salon.
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

    // 2. Try to find a subscription record
    const { data: subscription } = await this.supabase.adminClient
      .from('user_subscriptions')
      .select('*')
      .eq('salon_id', salon.id)
      .order('starts_at', { ascending: false })
      .maybeSingle();

    if (subscription) {
      return subscription;
    }

    // 3. No subscription record — return default trial based on salon data
    return {
      id: null,
      salon_id: salon.id,
      status: salon.subscription_status || 'Trial',
      plan: 'Basic',
      trial_ends_at: salon.trial_ends_at || null,
      starts_at: null,
      ends_at: null,
      created_at: null,
    };
  }
}
