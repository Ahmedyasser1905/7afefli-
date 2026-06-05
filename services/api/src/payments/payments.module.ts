import { Module } from '@nestjs/common';
import { ChargilyService } from './chargily/chargily.service';
import { PaymentsController } from './payments.controller';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [PaymentsController],
  providers: [ChargilyService],
})
export class PaymentsModule {}
