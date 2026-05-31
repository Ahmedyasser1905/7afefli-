// apps/mobile/src/hooks/barber/useRealtimeBookings.ts
// Supabase Realtime subscription for barbers — instant calendar updates

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { triggerLocalNotification } from '../../lib/notifications';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Reservation } from '../../../../packages/shared/types';

interface UseRealtimeBookingsOptions {
  salonId: string | null;
  onNewBooking?: (r: Reservation) => void;
  onStatusChange?: (r: Reservation) => void;
  onCancellation?: (r: Reservation) => void;
}

export function useRealtimeBookings({
  salonId,
  onNewBooking,
  onStatusChange,
  onCancellation,
}: UseRealtimeBookingsOptions) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!salonId) return;

    // Unsubscribe from any previous channel
    channelRef.current?.unsubscribe();

    channelRef.current = supabase
      .channel(`salon-reservations:${salonId}`, {
        config: { broadcast: { self: false } },
      })

      // ── INSERT: New booking arrived ──
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reservations',
          filter: `salon_id=eq.${salonId}`,
        },
        async (payload) => {
          const reservation = payload.new as Reservation;

          // 1. Optimistically prepend to the calendar cache
          queryClient.setQueryData<Reservation[]>(
            ['barber-reservations', salonId],
            (old) => [reservation, ...(old ?? [])],
          );

          // 2. Invalidate to get fresh server data shortly after
          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: ['barber-reservations', salonId],
            });
          }, 2000);

          // 3. Fire a local device notification
          await triggerLocalNotification({
            title: '💈 Nouveau rendez-vous !',
            body: `Client a réservé ${reservation.start_time} – ${reservation.end_time}`,
            data: { screen: 'Calendar', reservationId: reservation.id },
          });

          onNewBooking?.(reservation);
        },
      )

      // ── UPDATE: Status changed (confirmed, cancelled, completed) ──
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'reservations',
          filter: `salon_id=eq.${salonId}`,
        },
        (payload) => {
          const reservation = payload.new as Reservation;

          // Patch in place — no full refetch needed
          queryClient.setQueryData<Reservation[]>(
            ['barber-reservations', salonId],
            (old) =>
              (old ?? []).map((r) =>
                r.id === reservation.id ? reservation : r,
              ),
          );

          if (reservation.status === 'Cancelled') {
            onCancellation?.(reservation);
          } else {
            onStatusChange?.(reservation);
          }
        },
      )

      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] ✅ Subscribed: salon ${salonId}`);
        }
        if (status === 'CHANNEL_ERROR') {
          console.error(`[Realtime] ❌ Channel error:`, err);
          // Attempt reconnect after 5 seconds
          setTimeout(() => channelRef.current?.subscribe(), 5000);
        }
      });

    // Cleanup on unmount or salonId change
    return () => {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [salonId]);
}
