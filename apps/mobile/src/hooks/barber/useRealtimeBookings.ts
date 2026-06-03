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
          
        }
        if (status === 'CHANNEL_ERROR') {
          // Prevent Red Box in React Native during hot-reloads
          if (err && err.toString().includes('1000')) {
            
          } else {
            console.error(`[Realtime] ❌ Channel error:`, err);
          }
          // Reconnection is handled automatically by Supabase v2 client
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
  }, [salonId, queryClient, onNewBooking, onStatusChange, onCancellation]);
}
