// services/api/src/slots/slots.controller.ts

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SlotsService } from './slots.service';
import { SupabaseAuthGuard } from '../auth/auth.guard';

@Controller('slots')
export class SlotsController {
  constructor(private readonly slotsService: SlotsService) {}

  /**
   * GET /slots?salonId=...&serviceId=...&date=2025-06-15&barberId=...
   * Get available time slots for a specific salon, service, and date.
   */
  @Get()
  @UseGuards(SupabaseAuthGuard)
  getAvailableSlots(
    @Query('salonId') salonId: string,
    @Query('serviceId') serviceId: string,
    @Query('date') date: string,
    @Query('barberId') barberId?: string,
  ) {
    return this.slotsService.getAvailableSlots(salonId, serviceId, date, barberId);
  }
}
