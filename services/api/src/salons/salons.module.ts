// services/api/src/salons/salons.module.ts

import { Module } from '@nestjs/common';
import { SalonsController } from './salons.controller';
import { SalonsService } from './salons.service';
import { SalonServicesModule } from '../salon-services/salon-services.module';

@Module({
  imports: [SalonServicesModule],
  controllers: [SalonsController],
  providers: [SalonsService],
  exports: [SalonsService],
})
export class SalonsModule {}
