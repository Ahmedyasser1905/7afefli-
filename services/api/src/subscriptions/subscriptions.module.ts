import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [SubscriptionsService],
})
export class SubscriptionsModule {}
