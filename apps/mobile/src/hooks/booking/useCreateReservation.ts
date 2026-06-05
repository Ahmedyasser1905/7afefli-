import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { apiClient } from '../../lib/apiClient';
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
          endTime: params.endTime,
          notes: params.notes,
          clientPhone: params.clientPhone,
        });
        return data;
      } catch (error: unknown) {
        const errorStr = (error as Error).message || '';
        
        // If the backend rejected clientPhone because it is not whitelisted, retry without it
        if (errorStr.includes('clientPhone') && (errorStr.includes('should not exist') || errorStr.includes('non-whitelisted'))) {
          try {
            const data = await apiClient.post<Reservation>('/reservations', {
              salonId: params.salonId,
              serviceId: params.serviceId,
              barberId: params.staffId ?? undefined,
              appointmentDate: params.appointmentDate,
              startTime: params.startTime,
              endTime: params.endTime,
              notes: params.notes,
            });

            // Persist phone number via API (best-effort, non-blocking)
            if (params.clientPhone) {
              apiClient.patch('/auth/profiles/me', { phone_number: params.clientPhone }).catch(() => {
                // Non-critical — phone save failure doesn't affect the reservation
              });
            }

            return data;
          } catch (retryError: unknown) {
            const retryStr = (retryError as Error).message || '';
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
