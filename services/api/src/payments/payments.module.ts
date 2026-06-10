import { Module } from '@nestjs/common';
import { ChargilyService } from './chargily/chargily.service';
import { PaymentsController } from './payments.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [SupabaseModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [ChargilyService],
})
export class PaymentsModule {}
