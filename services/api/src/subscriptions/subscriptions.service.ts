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

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailySubscriptionChecks() {
    this.logger.log('Running daily subscription checks...');
    // Expire trials
    await this.supabase.adminClient
      .from('subscriptions')
      .update({ status: 'Expired' })
      .eq('status', 'Trial')
      .lt('trial_ends_at', new Date().toISOString());

    // Expire active
    await this.supabase.adminClient
      .from('subscriptions')
      .update({ status: 'Expired' })
      .eq('status', 'Active')
      .lt('ends_at', new Date().toISOString());
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
      .from('subscriptions')
      .select('*')
      .eq('salon_id', salon.id)
      .order('created_at', { ascending: false })
      .maybeSingle();

    if (subscription) {
      return subscription;
    }

    // 3. No subscription record — return default trial based on salon data
    return {
      id: null,
      salon_id: salon.id,
      status: salon.subscription_status || 'Trial',
      plan: 'trial',
      trial_ends_at: salon.trial_ends_at || null,
      starts_at: null,
      ends_at: null,
      created_at: null,
    };
  }
}
