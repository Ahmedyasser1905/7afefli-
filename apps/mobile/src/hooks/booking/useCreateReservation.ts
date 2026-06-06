import Toast from 'react-native-toast-message';
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
      Toast.show({
        type: 'error',
        text1: 'Erreur de réservation',
        text2: error.message
      });
    },
  });
}
