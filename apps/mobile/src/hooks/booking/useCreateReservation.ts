// apps/mobile/src/hooks/booking/useCreateReservation.ts
// Mutation hook for creating a reservation with optimistic updates

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
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

      const { data, error } = await supabase
        .from('reservations')
        .insert({
          client_id: user.id,
          salon_id: params.salonId,
          service_id: params.serviceId,
          staff_id: params.staffId ?? null,
          appointment_date: params.appointmentDate,
          start_time: params.startTime,
          end_time: params.endTime,
          status: 'Pending',
          client_phone: params.clientPhone ?? null,
          notes: params.notes ?? null,
        })
        .select(
          `
          *,
          salons:salon_id (name, address, wilaya),
          services:service_id (service_name, price, duration_minutes)
        `,
        )
        .single();

      if (error) {
        // PostgreSQL trigger raised SQLSTATE P0001 — booking conflict
        if (error.code === 'P0001' || error.message.includes('BOOKING_CONFLICT')) {
          throw new Error(
            'Ce créneau n\'est plus disponible. Veuillez en choisir un autre.',
          );
        }
        throw new Error(`Réservation échouée: ${error.message}`);
      }

      return data as Reservation;
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
