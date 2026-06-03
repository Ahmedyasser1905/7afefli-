// apps/mobile/src/hooks/booking/useAvailableSlots.ts
// Fetches booked reservations, generates all possible slots, overlays booked data

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
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
      // Call the NestJS Slots API instead of direct Supabase query
      const url = staffId 
        ? `/slots/${salonId}/${serviceId}/${date}?staffId=${staffId}`
        : `/slots/${salonId}/${serviceId}/${date}`;
        
      const bookedSlots = await apiClient.get<Record<string, unknown>[]>(url);

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
