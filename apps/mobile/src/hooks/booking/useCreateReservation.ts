// apps/mobile/src/hooks/booking/useCreateReservation.ts
// Mutation hook for creating a reservation with optimistic updates

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
          notes: params.notes,
          clientPhone: params.clientPhone,
        });
        return data;
      } catch (error: unknown) {
        if (error.message?.includes('no longer available') || error.message?.includes('booked')) {
          throw new Error('Ce créneau n\'est plus disponible. Veuillez en choisir un autre.');
        }
        throw new Error(`Réservation échouée: ${error.message}`);
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
