// apps/mobile/src/screens/barber/CalendarScreen.tsx
// Full-day timeline view with realtime reservation blocks

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { colors, typography, spacing, radius, shadows } from '../../theme';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { useRealtimeBookings } from '../../hooks/barber/useRealtimeBookings';
import { useAuthStore } from '../../store/authStore';
import {
  getNextDays,
  getDayNameShort,
  getDayNumber,
  today,
  formatTime,
} from '../../../../packages/shared/utils/formatters';
import type { Reservation } from '../../../../packages/shared/types';

// Timeline config
const OPEN_HOUR = 9;
const CLOSE_HOUR = 21;
const HOUR_HEIGHT = 80;
const TOTAL_HOURS = CLOSE_HOUR - OPEN_HOUR;

function timeToPixelOffset(time: string): number {
  const [h, m] = time.split(':').map(Number);
  const minutesSinceOpen = (h - OPEN_HOUR) * 60 + m;
  return (minutesSinceOpen / 60) * HOUR_HEIGHT;
}

function durationToHeight(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const durationMin = (eh * 60 + em) - (sh * 60 + sm);
  return (durationMin / 60) * HOUR_HEIGHT;
}

export function CalendarScreen() {
  const user = useAuthStore((s) => s.user);
  const [selectedDate, setSelectedDate] = useState(today());
  const dates = getNextDays(7);

  // Fetch barber's salon
  const { data: salon } = useQuery({
    queryKey: ['barber-salon', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salons')
        .select('id, name, open_time, close_time')
        .eq('owner_id', user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const salonId = salon?.id ?? null;

  // Fetch reservations for selected date
  const { data: reservations = [] } = useQuery<Reservation[]>({
    queryKey: ['barber-reservations', salonId, selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select(
          '*, profiles:client_id (full_name, avatar_url), services:service_id (service_name, price, duration_minutes)',
        )
        .eq('salon_id', salonId!)
        .eq('appointment_date', selectedDate)
        .in('status', ['Pending', 'Confirmed', 'Completed'])
        .order('start_time', { ascending: true });
      if (error) throw error;
      return data as Reservation[];
    },
    enabled: !!salonId,
  });

  // Realtime updates
  useRealtimeBookings({ salonId });

  // Hour labels
  const hourLabels = useMemo(() => {
    return Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
      const h = OPEN_HOUR + i;
      return `${String(h).padStart(2, '0')}:00`;
    });
  }, []);

  // Status-to-color mapping
  const getBlockColor = (status: string) => {
    switch (status) {
      case 'Pending':
        return { bg: '#1A2A3D', border: colors.pending };
      case 'Confirmed':
        return { bg: '#1A3D2A', border: colors.success };
      case 'Completed':
        return { bg: '#2A2A2A', border: colors.textMuted };
      default:
        return { bg: colors.graphite, border: colors.steel };
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📅 Calendrier</Text>
        <Text style={styles.subtitle}>{salon?.name ?? 'Mon salon'}</Text>
      </View>

      {/* Week Strip */}
      <View style={styles.weekStrip}>
        {dates.map((dateStr) => {
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === today();
          // Count bookings for this date
          const bookingCount = dateStr === selectedDate ? reservations.length : 0;

          return (
            <TouchableOpacity
              key={dateStr}
              style={[styles.dayCell, isSelected && styles.dayCellSelected]}
              onPress={() => setSelectedDate(dateStr)}
            >
              <Text style={[styles.dayName, isSelected && styles.dayNameSelected]}>
                {getDayNameShort(dateStr)}
              </Text>
              <Text style={[styles.dayNum, isSelected && styles.dayNumSelected]}>
                {getDayNumber(dateStr)}
              </Text>
              {isToday && (
                <View style={[styles.todayDot, isSelected && styles.todayDotSelected]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Timeline View */}
      <ScrollView style={styles.timeline} showsVerticalScrollIndicator={false}>
        <View style={[styles.timelineContent, { height: TOTAL_HOURS * HOUR_HEIGHT + HOUR_HEIGHT }]}>
          {/* Hour rules */}
          {hourLabels.map((label, i) => (
            <View
              key={label}
              style={[styles.hourRow, { top: i * HOUR_HEIGHT }]}
            >
              <Text style={styles.hourLabel}>{label}</Text>
              <View style={styles.hourLine} />
            </View>
          ))}

          {/* Reservation blocks */}
          {reservations.map((reservation) => {
            const top = timeToPixelOffset(reservation.start_time);
            const height = durationToHeight(reservation.start_time, reservation.end_time);
            const blockColor = getBlockColor(reservation.status);
            const client = (reservation as any).profiles;
            const service = (reservation as any).services;

            return (
              <View
                key={reservation.id}
                style={[
                  styles.reservationBlock,
                  {
                    top,
                    height: Math.max(height, 36),
                    backgroundColor: blockColor.bg,
                    borderLeftColor: blockColor.border,
                  },
                ]}
              >
                <View style={styles.blockContent}>
                  <Text style={styles.blockClient} numberOfLines={1}>
                    {client?.full_name ?? 'Client'}
                  </Text>
                  <Text style={styles.blockService} numberOfLines={1}>
                    {service?.service_name ?? 'Service'}
                  </Text>
                  <Text style={styles.blockTime}>
                    {formatTime(reservation.start_time)} – {formatTime(reservation.end_time)}
                  </Text>
                </View>
                <Badge label={reservation.status} variant={reservation.status.toLowerCase() as any} />
              </View>
            );
          })}

          {/* Empty state */}
          {reservations.length === 0 && (
            <View style={styles.emptyTimeline}>
              <Text style={styles.emptyText}>Aucune réservation pour ce jour</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink },
  header: { paddingTop: 60, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  title: { ...typography.h2, color: colors.textPrimary },
  subtitle: { ...typography.bodyMd, color: colors.amber, marginTop: spacing.xs },
  weekStrip: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: spacing.sm, paddingHorizontal: spacing.sm,
    backgroundColor: colors.carbon,
    borderBottomWidth: 1, borderBottomColor: colors.graphite,
  },
  dayCell: {
    width: 44, height: 64, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  dayCellSelected: { backgroundColor: colors.amber },
  dayName: { ...typography.caption, color: colors.textSecondary, textTransform: 'capitalize' },
  dayNameSelected: { color: colors.ink },
  dayNum: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: colors.textPrimary },
  dayNumSelected: { color: colors.ink },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.amber },
  todayDotSelected: { backgroundColor: colors.ink },
  timeline: { flex: 1 },
  timelineContent: { position: 'relative', marginLeft: 60, marginRight: spacing.md },
  hourRow: { position: 'absolute', left: -60, right: 0, flexDirection: 'row', alignItems: 'flex-start' },
  hourLabel: { ...typography.caption, color: colors.textMuted, width: 50, textAlign: 'right', marginRight: spacing.sm },
  hourLine: { flex: 1, height: 1, backgroundColor: colors.graphite, marginTop: 6 },
  reservationBlock: {
    position: 'absolute', left: 0, right: 0,
    borderRadius: radius.md, borderLeftWidth: 3,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    ...shadows.sm,
  },
  blockContent: { flex: 1 },
  blockClient: { ...typography.label, color: colors.textPrimary },
  blockService: { ...typography.caption, color: colors.textSecondary },
  blockTime: { ...typography.caption, color: colors.amber, marginTop: 1 },
  emptyTimeline: {
    position: 'absolute', top: TOTAL_HOURS * HOUR_HEIGHT / 2 - 20,
    left: 0, right: 0, alignItems: 'center',
  },
  emptyText: { ...typography.bodyMd, color: colors.textMuted },
});
