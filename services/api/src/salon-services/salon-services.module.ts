// services/api/src/salon-services/salon-services.module.ts

import { Module } from '@nestjs/common';
import { SalonServicesController } from './salon-services.controller';
import { SalonServicesService } from './salon-services.service';

@Module({
  controllers: [SalonServicesController],
  providers: [SalonServicesService],
  exports: [SalonServicesService],
})
export class SalonServicesModule {}
