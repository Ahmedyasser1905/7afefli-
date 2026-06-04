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

    // 1. Fetch service duration, salon hours, staff members, and existing bookings in parallel
    const [serviceResult, salonResult, staffResult, bookedResult] = await Promise.all([
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
      this.supabase.adminClient
        .from('salon_staff')
        .select('id, profile_id')
        .eq('salon_id', salonId),
      this.supabase.adminClient
        .from('reservations')
        .select('start_time, end_time, staff_id, barber_id, notes')
        .eq('salon_id', salonId)
        .eq('appointment_date', date)
        .in('status', ['Pending', 'Confirmed']),
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

    // Check if the requested date is in the past (Algerian local time)
    const today = new Date();
    const utc = today.getTime() + today.getTimezoneOffset() * 60000;
    const algeriaTime = new Date(utc + 3600000);
    const currentDateStr = `${algeriaTime.getFullYear()}-${String(algeriaTime.getMonth() + 1).padStart(2, '0')}-${String(algeriaTime.getDate()).padStart(2, '0')}`;
    const currentTimeStr = `${String(algeriaTime.getHours()).padStart(2, '0')}:${String(algeriaTime.getMinutes()).padStart(2, '0')}`;

    if (date < currentDateStr) {
      return [];
    }

    // Check if the requested date falls on a working day
    // Use UTC parsing to avoid server timezone offset causing wrong day-of-week
    const requestedDay = new Date(date + 'T00:00:00Z').getUTCDay(); // 0=Sun, 6=Sat
    if (workingDays && !workingDays.includes(requestedDay)) {
      return []; // Salon is closed on this day
    }

    const staffList = staffResult.data;
    const N = Math.max(staffList?.length || 1, 1); // Total number of barbers in the salon
    const bookedSlots = bookedResult.data ?? [];

    // Resolve barberId to both salon_staff.id and profiles.id for robust matching
    let targetStaffId: string | null = null;
    let targetProfileId: string | null = null;
    if (barberId) {
      const staff = staffList?.find(s => s.id === barberId || s.profile_id === barberId);
      if (staff) {
        targetStaffId = staff.id;
        targetProfileId = staff.profile_id;
      } else {
        // barberId passed but not found in salon — treat as invalid, show no slots
        targetStaffId = barberId;
      }
    }

    // 3. Generate all possible slots in service-duration increments
    const allSlots = this.generateTimeSlots(openTime, closeTime, duration);

    // 4. Mark each slot as available or not
    const finalSlots = allSlots.map(slot => {
      const slotStart = this.timeToMinutes(slot.startTime);
      const slotEnd   = this.timeToMinutes(slot.endTime);

      // Helper: does a booked reservation overlap with this slot?
      const doesOverlap = (booked: { start_time: string; end_time: string }) => {
        const bookedStart = this.timeToMinutes(booked.start_time);
        const bookedEnd   = this.timeToMinutes(booked.end_time);
        const bs = bookedEnd <= bookedStart ? bookedEnd + 24 * 60 : bookedEnd;
        const se = slotEnd  <= slotStart   ? slotEnd  + 24 * 60 : slotEnd;
        return slotStart < bs && se > bookedStart;
      };

      // Helper: does a reservation belong to the target barber?
      const isTargetBarber = (booked: { staff_id: string | null; barber_id: string | null }) =>
        (targetStaffId   && booked.staff_id  === targetStaffId)  ||
        (targetProfileId && booked.barber_id === targetProfileId) ||
        booked.staff_id  === barberId ||
        booked.barber_id === barberId;

      let isAvailable = true;

      // ── PRIORITY RULE: CRÉNEAU BLOQUÉ ──
      // A blocked time created by the barber overrides everything.
      // In Mode A: blocked for the exact barber → slot unavailable.
      // In Mode B: if ANY barber in the salon has a block here,
      //            reduce available capacity by one (same counting as a regular booking).
      const blockedSlots = bookedSlots.filter(
        (b): b is typeof b & { notes: string } =>
          typeof (b as Record<string, unknown>).notes === 'string' &&
          ((b as Record<string, unknown>).notes as string).includes('CRÉNEAU BLOQUÉ')
      );

      if (barberId) {
        // ── MODE A: Client chose a specific barber ──
        // Block if THAT barber has a normal reservation OR a CRÉNEAU BLOQUÉ overlapping this slot.
        const isTargetBarberBusy = bookedSlots.some(booked => {
          if (!doesOverlap(booked)) return false;
          return isTargetBarber(booked);
        });

        if (isTargetBarberBusy) {
          isAvailable = false;
        }
      } else {
        // ── MODE B: No specific barber (any available barber) ──
        // Count distinct barbers occupied at this slot.
        // CRÉNEAU BLOQUÉ counts as that barber being fully occupied.
        const busyBarbers = new Set<string>();
        for (const booked of bookedSlots) {
          if (!doesOverlap(booked)) continue;
          if (booked.staff_id) {
            busyBarbers.add(booked.staff_id);
          } else if (booked.barber_id) {
            busyBarbers.add(booked.barber_id);
          } else {
            // Unassigned reservation — still consumes one barber slot
            busyBarbers.add(`unassigned-${booked.start_time}`);
          }
        }
        // Also add any blocked barbers (they are fully unavailable during their block)
        for (const blocked of blockedSlots) {
          if (!doesOverlap(blocked)) continue;
          if (blocked.staff_id) busyBarbers.add(blocked.staff_id);
          else if (blocked.barber_id) busyBarbers.add(blocked.barber_id);
        }

        if (busyBarbers.size >= N) {
          isAvailable = false;
        }
      }

      // Block past slots for today (skip in barber walk-in mode)
      if (isAvailable && date === currentDateStr && slot.startTime <= currentTimeStr) {
        isAvailable = false;
      }

      return { ...slot, isAvailable };
    });

    await this.cacheManager.set(cacheKey, finalSlots, 30 * 1000); // Cache for 30 seconds

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

