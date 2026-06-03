// services/api/src/slots/slots.service.ts
// Core slot generation logic — generates available time slots for a salon/service/date

import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SupabaseService } from '../supabase/supabase.service';

export interface TimeSlot {
  startTime: string;   // "09:00"
  endTime: string;     // "09:30"
  isAvailable: boolean;
}

@Injectable()
export class SlotsService {
  constructor(
    private readonly supabase: SupabaseService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

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
    const cacheKey = `slots_v2:${salonId}:${serviceId}:${date}:${barberId || 'any'}`;
    const cachedSlots = await this.cacheManager.get<TimeSlot[]>(cacheKey);
    if (cachedSlots) {
      return cachedSlots;
    }

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
      // Find the staff row to check if barberId is a staff.id or profile_id
      const { data: staff } = await this.supabase.adminClient
        .from('salon_staff')
        .select('id, profile_id')
        .or(`id.eq.${barberId},profile_id.eq.${barberId}`)
        .maybeSingle();

      if (staff) {
        // Query reservations where staff_id is staff.id or barber_id is staff.profile_id
        query = query.or(`staff_id.eq.${staff.id}${staff.profile_id ? `,barber_id.eq.${staff.profile_id}` : ''}`);
      } else {
        // Fallback: check both anyway
        query = query.or(`staff_id.eq.${barberId},barber_id.eq.${barberId}`);
      }
    }

    const { data: bookedSlots } = await query;

    // 3. Generate all possible slots
    const allSlots = this.generateTimeSlots(openTime, closeTime, duration);

    // 4. Mark booked slots as unavailable
    const finalSlots = allSlots.map(slot => ({
      ...slot,
      isAvailable: !this.isSlotBooked(slot, bookedSlots ?? []),
    }));

    await this.cacheManager.set(cacheKey, finalSlots, 60 * 1000); // Cache for 60 seconds

    console.log('[SlotsService] Generated slots:', {
      salonId,
      date,
      openTime,
      closeTime,
      duration,
      workingDays,
      requestedDay,
      allSlotsLength: allSlots.length,
      finalSlotsLength: finalSlots.length,
    });

    return finalSlots;
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
    let close = this.timeToMinutes(closeTime);

    // Handle midnight or next-day closing (e.g. 11:00 to 00:00 or 02:00)
    if (close <= open) {
      close += 24 * 60;
    }

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
    let slotStart = this.timeToMinutes(slot.startTime);
    let slotEnd = this.timeToMinutes(slot.endTime);
    if (slotEnd <= slotStart) slotEnd += 24 * 60;

    return bookedSlots.some(booked => {
      let bookedStart = this.timeToMinutes(booked.start_time);
      let bookedEnd = this.timeToMinutes(booked.end_time);
      if (bookedEnd <= bookedStart) bookedEnd += 24 * 60;
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
    const normalizedM = minutes % (24 * 60);
    const h = Math.floor(normalizedM / 60).toString().padStart(2, '0');
    const m = (normalizedM % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }
}
