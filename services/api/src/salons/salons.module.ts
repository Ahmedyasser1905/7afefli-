// services/api/src/salons/salons.module.ts

import { Module } from '@nestjs/common';
import { SalonsController } from './salons.controller';
import { SalonsService } from './salons.service';

@Module({
  controllers: [SalonsController],
  providers: [SalonsService],
  exports: [SalonsService],
})
export class SalonsModule {}
