// apps/mobile/src/hooks/booking/useAvailableSlots.ts
// Fetches booked reservations, generates all possible slots, overlays booked data

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import { supabase } from '../../lib/supabase';
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

      // Check if the requested date is in the past
      const now = new Date();
      const currentDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      if (date) {
        if (date < currentDateStr) {
          console.log('[useAvailableSlots] Date is in the past');
          return [];
        }
      }

      if (apiSucceeded && data.length > 0) {
        // Filter out past slots from the successful API response (stale production backend resilience)
        data = data.map(slot => {
          let isAvailable = slot.isAvailable;
          if (isAvailable && date === currentDateStr && slot.startTime <= currentTimeStr) {
            isAvailable = false;
          }
          return {
            ...slot,
            isAvailable,
          };
        });
        return data;
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
          // Fetch salon staff list to determine capacity N
          const { data: staffList, error: staffErr } = await supabase
            .from('salon_staff')
            .select('id, profile_id')
            .eq('salon_id', salonId!);
          if (staffErr) throw staffErr;
          const N = staffList?.length || 1;

          // Fetch all booked reservations for that date
          const { data: bookedReservations, error: resErr } = await supabase
            .from('reservations')
            .select('start_time, end_time, staff_id, barber_id')
            .eq('salon_id', salonId!)
            .eq('appointment_date', date!)
            .in('status', ['Pending', 'Confirmed']);
          if (resErr) throw resErr;

          // Resolve staffId / profile_id
          let targetStaffId: string | null = null;
          let targetProfileId: string | null = null;
          if (staffId) {
            const staff = staffList?.find(s => s.id === staffId || s.profile_id === staffId);
            if (staff) {
              targetStaffId = staff.id;
              targetProfileId = staff.profile_id;
            } else {
              targetStaffId = staffId;
            }
          }

          // 3. Generate slots using the shared logic
          const rawSlots = generateTimeSlots(openTime, closeTime, durationMin);

          // helper to parse time to minutes
          const timeToMinutes = (t: string) => {
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
          };
          
          // 4. Mark booked slots as unavailable based on capacity N
          const localSlots = rawSlots.map((slot) => {
            let slotStart = timeToMinutes(slot.startTime);
            let slotEnd = timeToMinutes(slot.endTime);
            if (slotEnd <= slotStart) slotEnd += 24 * 60;

            // Find overlapping reservations
            const overlapping = (bookedReservations || []).filter(booked => {
              let bookedStart = timeToMinutes(booked.start_time);
              let bookedEnd = timeToMinutes(booked.end_time);
              if (bookedEnd <= bookedStart) bookedEnd += 24 * 60;
              return slotStart < bookedEnd && slotEnd > bookedStart;
            });

            const totalBookedCount = overlapping.length;
            let isAvailable = true;

            if (totalBookedCount >= N) {
              isAvailable = false;
            } else if (staffId) {
              const isBarberBusy = overlapping.some(booked => 
                booked.staff_id === targetStaffId || 
                booked.barber_id === targetProfileId ||
                booked.staff_id === staffId ||
                booked.barber_id === staffId
              );
              if (isBarberBusy) {
                isAvailable = false;
              }
            }

            if (isAvailable && date === currentDateStr && slot.startTime <= currentTimeStr) {
              isAvailable = false;
            }

            return {
              ...slot,
              isAvailable,
            };
          }) as TimeSlot[];

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
