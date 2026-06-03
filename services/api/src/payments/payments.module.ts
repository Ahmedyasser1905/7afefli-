import { Module } from '@nestjs/common';
import { ChargilyService } from './chargily/chargily.service';

import { PaymentsController } from './payments.controller';

@Module({
  controllers: [PaymentsController],
  providers: [ChargilyService]
})
export class PaymentsModule {}
