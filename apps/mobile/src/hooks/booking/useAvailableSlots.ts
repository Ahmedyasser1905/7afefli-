// apps/mobile/src/hooks/booking/useAvailableSlots.ts
// Fetches available time slots from the API.
// Falls back to client-side slot generation using the shared timeSlots utility
// if the API is unavailable, using only data already available in component props
// (no direct Supabase queries from the client).

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import { generateTimeSlots } from '@barberdz/shared/utils/timeSlots';
import type { TimeSlot } from '@barberdz/shared/types';

interface UseSlotsParams {
  salonId: string | null;
  serviceId: string | null;
  date: string | null;   // "2025-07-15"
  staffId?: string | null;
  openTime: string;       // "09:00"
  closeTime: string;      // "21:00"
  durationMin: number;    // e.g., 30
  workingDays?: number[]; // optional list of active working days (0=Sun, 6=Sat)
  isBarberMode?: boolean; // if true, past slots today are NOT filtered (barbers can add walk-ins)
}

export function useAvailableSlots({
  salonId,
  serviceId,
  date,
  staffId,
  openTime,
  closeTime,
  durationMin,
  workingDays,
  isBarberMode = false,
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

      // Current date and time strings for filtering past slots
      const now = new Date();
      const currentDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // Check if the requested date is in the past
      if (date && date < currentDateStr) {
        return [];
      }

      try {
        // Primary path: fetch from the backend API
        const url = `/slots?${queryParams.toString()}`;
        const data = await apiClient.get<TimeSlot[]>(url);

        // Filter out past slots for today (skip in barber mode — barbers can register walk-ins)
        if (isBarberMode) return data;

        return data.map(slot => {
          let isAvailable = slot.isAvailable;
          if (isAvailable && date === currentDateStr && slot.startTime <= currentTimeStr) {
            isAvailable = false;
          }
          return { ...slot, isAvailable };
        });
      } catch {
        // API unavailable — generate slots locally using props only (no Supabase)
        // This gives the user a degraded-but-functional experience.

        // Check if salon is open on this day of the week (UTC date to avoid timezone shift)
        if (date && workingDays) {
          const requestedDay = new Date(date + 'T00:00:00Z').getUTCDay();
          if (!workingDays.includes(requestedDay)) {
            return [];
          }
        }

        // Generate slots from open/close times with no booking overlay
        // (we can't query booked reservations without the API or Supabase)
        const rawSlots = generateTimeSlots(openTime, closeTime, durationMin);

        // In barber mode show all slots; in client mode filter out past ones
        return rawSlots.map(slot => {
          const isAvailable = isBarberMode
            ? true
            : !(date === currentDateStr && slot.startTime <= currentTimeStr);
          return { ...slot, isAvailable } as TimeSlot;
        });
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
