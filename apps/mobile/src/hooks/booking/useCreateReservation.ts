import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { apiClient } from '../../lib/apiClient';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useBookingStore } from '../../store/bookingStore';
import type { Reservation } from '@barberdz/shared/types';

interface CreateReservationParams {
  salonId: string;
  serviceId: string;
  staffId?: string | null;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  notes?: string;
  clientPhone?: string;
}

export function useCreateReservation() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const resetBooking = useBookingStore((s) => s.resetBooking);

  return useMutation({
    mutationFn: async (params: CreateReservationParams): Promise<Reservation> => {
      if (!user) throw new Error('Not authenticated');

      try {
        const data = await apiClient.post<Reservation>('/reservations', {
          salonId: params.salonId,
          serviceId: params.serviceId,
          barberId: params.staffId ?? undefined,
          appointmentDate: params.appointmentDate,
          startTime: params.startTime,
          notes: params.notes,
          clientPhone: params.clientPhone,
        });
        return data;
      } catch (error: any) {
        const errorStr = error.message || '';
        
        // If the stale backend rejected clientPhone because it is not whitelisted, retry without it
        if (errorStr.includes('clientPhone') && (errorStr.includes('should not exist') || errorStr.includes('non-whitelisted'))) {
          console.log('[useCreateReservation] Production API rejected clientPhone, retrying without it...');
          try {
            const data = await apiClient.post<Reservation>('/reservations', {
              salonId: params.salonId,
              serviceId: params.serviceId,
              barberId: params.staffId ?? undefined,
              appointmentDate: params.appointmentDate,
              startTime: params.startTime,
              notes: params.notes,
            });

            // Update user profile with phone number directly in Supabase
            if (params.clientPhone) {
              await supabase
                .from('profiles')
                .update({ phone_number: params.clientPhone })
                .eq('id', user.id);
            }

            return data;
          } catch (retryError: any) {
            const retryStr = retryError.message || '';
            if (retryStr.includes('no longer available') || retryStr.includes('booked')) {
              throw new Error('Ce créneau n\'est plus disponible. Veuillez en choisir un autre.');
            }
            throw new Error(`Réservation échouée (retry): ${retryStr}`);
          }
        }

        if (errorStr.includes('no longer available') || errorStr.includes('booked')) {
          throw new Error('Ce créneau n\'est plus disponible. Veuillez en choisir un autre.');
        }
        throw new Error(`Réservation échouée: ${errorStr}`);
      }
    },

    onSuccess: (reservation) => {
      // Invalidate slot cache so the booked slot disappears
      queryClient.invalidateQueries({
        queryKey: ['slots', reservation.salon_id],
      });

      // Invalidate my appointments list
      queryClient.invalidateQueries({
        queryKey: ['my-reservations'],
      });

      // Reset the booking wizard
      resetBooking();
    },

    onError: (error: Error) => {
      Alert.alert('Erreur de réservation', error.message);
    },
  });
}
