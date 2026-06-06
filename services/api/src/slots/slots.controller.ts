// services/api/src/slots/slots.controller.ts

import { Controller, Get, Query } from '@nestjs/common';
import { SlotsService } from './slots.service';

@Controller('slots')
export class SlotsController {
  constructor(private readonly slotsService: SlotsService) {}

  /**
   * GET /slots?salonId=...&serviceId=...&date=2025-06-15&barberId=...
   * Get available time slots for a specific salon, service, and date.
   * Note: No auth required — slot availability is public information.
   * Authenticated users (barbers) can additionally see past slots for walk-in booking.
   */
  @Get()
  getAvailableSlots(
    @Query('salonId') salonId: string,
    @Query('serviceId') serviceId: string,
    @Query('date') date: string,
    @Query('barberId') barberId?: string,
  ) {
    return this.slotsService.getAvailableSlots(salonId, serviceId, date, barberId);
  }
}
