// services/api/src/slots/slots.service.ts
// Core slot generation logic — generates available time slots for a salon/service/date

import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface TimeSlot {
  startTime: string;   // "09:00"
  endTime: string;     // "09:30"
  isAvailable: boolean;
}

@Injectable()
export class SlotsService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Generate available time slots for a given salon, service, and date.
   * 
   * Algorithm:
   * 1. Fetch service duration and salon operating hours
   * 2. Fetch all booked (Pending/Confirmed) reservations for that date
   * 3. Generate all possible slots in service-duration increments
   * 4. Mark overlapping slots as unavailable
   */
  async getAvailableSlots(
    salonId: string,
    serviceId: string,
    date: string,        // "2025-06-15"
    barberId?: string,
  ): Promise<TimeSlot[]> {
    // 1. Fetch service duration and salon hours in parallel
    const [serviceResult, salonResult] = await Promise.all([
      this.supabase.adminClient
        .from('services')
        .select('duration_minutes')
        .eq('id', serviceId)
        .eq('salon_id', salonId)
        .single(),
      this.supabase.adminClient
        .from('salons')
        .select('open_time, close_time, working_days')
        .eq('id', salonId)
        .single(),
    ]);

    if (serviceResult.error || !serviceResult.data) {
      throw new BadRequestException('Service not found for this salon');
    }
    if (salonResult.error || !salonResult.data) {
      throw new BadRequestException('Salon not found');
    }

    const duration = serviceResult.data.duration_minutes;
    const openTime = salonResult.data.open_time;   // "09:00:00"
    const closeTime = salonResult.data.close_time;  // "21:00:00"
    const workingDays = salonResult.data.working_days;

    // Check if the requested date falls on a working day
    const requestedDay = new Date(date).getDay(); // 0=Sun, 6=Sat
    if (workingDays && !workingDays.includes(requestedDay)) {
      return []; // Salon is closed on this day
    }

    // 2. Fetch all booked slots for that date
    let query = this.supabase.adminClient
      .from('reservations')
      .select('start_time, end_time')
      .eq('salon_id', salonId)
      .eq('appointment_date', date)
      .in('status', ['Pending', 'Confirmed']);

    if (barberId) {
      query = query.eq('barber_id', barberId);
    }

    const { data: bookedSlots } = await query;

    // 3. Generate all possible slots
    const allSlots = this.generateTimeSlots(openTime, closeTime, duration);

    // 4. Mark booked slots as unavailable
    return allSlots.map(slot => ({
      ...slot,
      isAvailable: !this.isSlotBooked(slot, bookedSlots ?? []),
    }));
  }

  /**
   * Generate time slots from open to close in duration-minute increments.
   */
  private generateTimeSlots(
    openTime: string,
    closeTime: string,
    durationMinutes: number,
  ): Omit<TimeSlot, 'isAvailable'>[] {
    const slots: Omit<TimeSlot, 'isAvailable'>[] = [];
    const open = this.timeToMinutes(openTime);
    const close = this.timeToMinutes(closeTime);

    let current = open;
    while (current + durationMinutes <= close) {
      slots.push({
        startTime: this.minutesToTime(current),
        endTime: this.minutesToTime(current + durationMinutes),
      });
      current += durationMinutes; // Move by service duration (not fixed 30min)
    }

    return slots;
  }

  /**
   * Check if a slot overlaps with any booked reservation.
   * Uses standard interval overlap formula: A_start < B_end AND A_end > B_start
   */
  private isSlotBooked(
    slot: { startTime: string; endTime: string },
    bookedSlots: { start_time: string; end_time: string }[],
  ): boolean {
    const slotStart = this.timeToMinutes(slot.startTime);
    const slotEnd = this.timeToMinutes(slot.endTime);

    return bookedSlots.some(booked => {
      const bookedStart = this.timeToMinutes(booked.start_time);
      const bookedEnd = this.timeToMinutes(booked.end_time);
      return slotStart < bookedEnd && slotEnd > bookedStart;
    });
  }

  /**
   * Convert "HH:MM" or "HH:MM:SS" time string to minutes since midnight.
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Convert minutes since midnight to "HH:MM" time string.
   */
  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }
}
