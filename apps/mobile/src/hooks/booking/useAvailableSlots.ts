// apps/mobile/src/hooks/booking/useAvailableSlots.ts
// Fetches booked reservations, generates all possible slots, overlays booked data

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
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
  workingDays?: number[]; // optional list of active working days (0=Sun, 6=Sat)
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
      
      let data: TimeSlot[] = [];
      let apiSucceeded = false;
      try {
        const url = `/slots?${queryParams.toString()}`;
        console.log('[useAvailableSlots] Fetching:', url);
        data = await apiClient.get<TimeSlot[]>(url);
        console.log('[useAvailableSlots] Response length:', data.length);
        apiSucceeded = true;
      } catch (err) {
        console.log('[useAvailableSlots] API failed, falling back to client-side generation:', err);
      }

      // Fallback: if API failed OR returned no slots (but salon open/close times are set, indicating it should have slots)
      if (!apiSucceeded || data.length === 0) {
        console.log('[useAvailableSlots] Generating slots locally for:', { openTime, closeTime, durationMin });
        
        // 1. Check if the salon is open on this day of the week
        if (date) {
          const requestedDay = new Date(date).getDay(); // 0=Sun, 6=Sat
          if (workingDays && !workingDays.includes(requestedDay)) {
            console.log('[useAvailableSlots] Salon is closed on this day (local check)');
            return [];
          }
        }

        try {
          // 2. Fetch booked reservations from Supabase directly
          let query = supabase
            .from('reservations')
            .select('start_time, end_time')
            .eq('salon_id', salonId!)
            .eq('appointment_date', date!)
            .in('status', ['Pending', 'Confirmed']);

          if (staffId) {
            // Find the staff row to check if staffId is a staff.id or profile_id
            const { data: staff } = await supabase
              .from('salon_staff')
              .select('id, profile_id')
              .or(`id.eq.${staffId},profile_id.eq.${staffId}`)
              .maybeSingle();

            if (staff) {
              query = query.or(`staff_id.eq.${staff.id}${staff.profile_id ? `,barber_id.eq.${staff.profile_id}` : ''}`);
            } else {
              query = query.or(`staff_id.eq.${staffId},barber_id.eq.${staffId}`);
            }
          }

          const { data: bookedReservations, error } = await query;
          if (error) throw error;

          // 3. Generate slots using the shared logic (handles midnight correctly)
          const rawSlots = generateTimeSlots(openTime, closeTime, durationMin);
          
          // 4. Mark booked slots as unavailable
          const localSlots = rawSlots.map((slot) => ({
            ...slot,
            isAvailable: !isSlotBooked(slot, bookedReservations || []),
          })) as TimeSlot[];

          console.log('[useAvailableSlots] Local generation count:', localSlots.length);
          return localSlots;
        } catch (dbErr) {
          console.error('[useAvailableSlots] Local generation failed:', dbErr);
          if (apiSucceeded) return data; // If API succeeded but returned empty, return it instead of crashing
          throw dbErr;
        }
      }

      return data;
    },

    // Only run if all required params are present
    enabled: Boolean(salonId && serviceId && date && durationMin > 0),

    // Refetch every 60 seconds to catch bookings by other users
    refetchInterval: 60 * 1000,

    // Keep stale data visible while refetching (no flash of empty state)
    placeholderData: (prev) => prev,
  });
}
