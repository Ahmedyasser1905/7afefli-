import { Injectable, Logger } from '@nestjs/common';
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
}
