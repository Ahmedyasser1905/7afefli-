// apps/mobile/src/hooks/booking/useAvailableSlots.ts
// Fetches booked reservations, generates all possible slots, overlays booked data

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { generateTimeSlots, isSlotBooked } from '@barberdz/shared/utils/timeSlots';
import type { TimeSlot } from '@barberdz/shared/types';

interface UseSlotsParams {
  salonId: string | null;
  serviceId: string | null;
  date: string | null;   // "2025-07-15"
  staffId?: string | null;
  openTime: string;       // "09:00"
  closeTime: string;      // "21:00"
  durationMin: number;    // e.g., 30
}

export function useAvailableSlots({
  salonId,
  serviceId,
  date,
  staffId,
  openTime,
  closeTime,
  durationMin,
}: UseSlotsParams) {
  return useQuery<TimeSlot[]>({
    // Key includes all parameters → cache is per (salon, service, date, staff)
    queryKey: ['slots', salonId, serviceId, date, staffId],

    queryFn: async (): Promise<TimeSlot[]> => {
      // ── Step 1: Fetch all booked/pending slots for this date ──
      let query = supabase
        .from('reservations')
        .select('start_time, end_time, status')
        .eq('salon_id', salonId!)
        .eq('appointment_date', date!)
        .in('status', ['Confirmed', 'Pending', 'Blocked']);

      if (staffId) {
        query = query.or(`staff_id.eq.${staffId},staff_id.is.null`);
      }

      const { data: bookedSlots, error } = await query;
      if (error) throw new Error(error.message);

      // ── Step 2: Generate all possible slots (pure function) ──
      const allSlots = generateTimeSlots(openTime, closeTime, durationMin);

      // ── Step 3: Overlay booked data onto generated slots ──
      return allSlots.map((slot) => ({
        ...slot,
        isAvailable: !isSlotBooked(slot, bookedSlots ?? []),
      }));
    },

    // Only run if all required params are present
    enabled: Boolean(salonId && serviceId && date && durationMin > 0),

    // Refetch every 60 seconds to catch bookings by other users
    refetchInterval: 60 * 1000,

    // Keep stale data visible while refetching (no flash of empty state)
    placeholderData: (prev) => prev,
  });
}
