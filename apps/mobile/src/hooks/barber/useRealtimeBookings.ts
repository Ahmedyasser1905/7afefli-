// apps/mobile/src/hooks/barber/useRealtimeBookings.ts
// Supabase Realtime subscription for barbers — instant calendar updates

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { triggerLocalNotification } from '../../lib/notifications';
import { apiClient } from '../../lib/apiClient';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Reservation } from '@barberdz/shared/types';

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

  // Store callbacks in refs to avoid re-subscribing the Realtime channel
  // when parent component re-renders with new function references
  const onNewBookingRef = useRef(onNewBooking);
  const onStatusChangeRef = useRef(onStatusChange);
  const onCancellationRef = useRef(onCancellation);
  onNewBookingRef.current = onNewBooking;
  onStatusChangeRef.current = onStatusChange;
  onCancellationRef.current = onCancellation;

  useEffect(() => {
    if (!salonId) return;

    // Unsubscribe and remove from any previous channel globally
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Generate a unique channel name for this hook instance
    // This prevents collisions when Dashboard and Calendar both mount simultaneously
    const uniqueChannelName = `salon-reservations:${salonId}-${Math.random().toString(36).substring(7)}`;

    channelRef.current = supabase
      .channel(uniqueChannelName, {
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

          // 1. Invalidate all date-filtered caches for this salon (exact:false matches 3-key queries like [key, salonId, date])
          queryClient.invalidateQueries({
            queryKey: ['barber-reservations', salonId],
            exact: false,
          });

          // 2. Delayed re-invalidation to pick up auto-confirm status update (backend takes ~300ms)
          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: ['barber-reservations', salonId],
              exact: false,
            });
            queryClient.invalidateQueries({
              queryKey: ['barber-pending'],
              exact: false,
            });
          }, 1000);

          // 3. Fetch client name + service for a rich notification
          let clientName = 'Un client';
          let serviceName = '';
          try {
            const resData = await apiClient.get<Record<string, unknown>>(`/reservations/${reservation.id}`);
            if (resData.profiles?.full_name) clientName = resData.profiles.full_name;
            else if (resData.client_phone) clientName = resData.client_phone;
            
            if (resData.services?.service_name) serviceName = ` — ${resData.services.service_name}`;
          } catch (err) {
            // Fallback: use generic name
          }

          // 4. Fire a local device notification to barber
          await triggerLocalNotification({
            title: '💈 Nouveau rendez-vous !',
            body: `${clientName} a réservé à ${reservation.start_time}${serviceName}`,
            data: { screen: 'Calendar', reservationId: reservation.id },
          });

          onNewBookingRef.current?.(reservation);
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

          // Invalidate all date-filtered caches so every visible day reflects the change
          queryClient.invalidateQueries({
            queryKey: ['barber-reservations', salonId],
            exact: false,
          });

          if (reservation.status === 'Cancelled') {
            onCancellationRef.current?.(reservation);
          } else {
            onStatusChangeRef.current?.(reservation);
          }
        },
      )

      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          
        }
        if (status === 'CHANNEL_ERROR') {
          // Reconnection is handled automatically by Supabase v2 client
          // Suppress normal close code 1000 (clean disconnect during hot-reload)
        }
      });

    // Cleanup on unmount or salonId change
    return () => {
      if (channelRef.current) {
        const channel = channelRef.current;
        channel.unsubscribe().then(() => {
          supabase.removeChannel(channel);
        });
        channelRef.current = null;
      }
    };
  }, [salonId, queryClient]);
}
