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
      const queryParams = new URLSearchParams({
        salonId: salonId!,
        serviceId: serviceId!,
        date: date!,
      });
      if (staffId) {
        queryParams.append('barberId', staffId);
      }
      
      try {
        const url = `/slots?${queryParams.toString()}`;
        console.log('[useAvailableSlots] Fetching:', url);
        const data = await apiClient.get<TimeSlot[]>(url);
        console.log('[useAvailableSlots] Response length:', data.length);
        return data;
      } catch (err) {
        console.error('[useAvailableSlots] Error fetching slots:', err);
        throw err;
      }
    },

    // Only run if all required params are present
    enabled: Boolean(salonId && serviceId && date && durationMin > 0),

    // Refetch every 60 seconds to catch bookings by other users
    refetchInterval: 60 * 1000,

    // Keep stale data visible while refetching (no flash of empty state)
    placeholderData: (prev) => prev,
  });
}
