// apps/mobile/src/screens/barber/CalendarScreen.tsx
// Full-day timeline view with realtime reservation blocks

import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { apiClient } from '../../lib/apiClient';
import { colors, spacing, radius, shadows } from '../../theme';
import { useRealtimeBookings } from '../../hooks/barber/useRealtimeBookings';
import { useAuthStore } from '../../store/authStore';
import {
  getNextDays,
  getDayNameShort,
  getDayNumber,
  today,
  formatTime,
} from '@barberdz/shared/utils/formatters';
import Ionicons from "@react-native-vector-icons/ionicons";
import type { Reservation } from '@barberdz/shared/types';

import { AddWalkInModal } from '../../components/barber/AddWalkInModal';
import { ReservationDetailModal } from '../../components/barber/ReservationDetailModal';

// Timeline hourly grid configuration
const HOUR_HEIGHT = 88;

function timeToPixelOffset(time: string, openHour: number): number {
  const [h, m] = time.split(':').map(Number);
  const minutesSinceOpen = (h - openHour) * 60 + m;
  return (minutesSinceOpen / 60) * HOUR_HEIGHT;
}

function durationToHeight(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const durationMin = (eh * 60 + em) - (sh * 60 + sm);
  return (durationMin / 60) * HOUR_HEIGHT;
}

const DEFAULT_AVATAR = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDqBwevJA_-4C8CiV0jhFk0kQ1wMed3SXsDLtkuYojI_z1NOOr9TsG1ppWseymOF1jEuEUK3KfQn_lUckAbPgmIaSRhgIECSEyCop0h_moZW-TI7--iKZxYbB5dZpkgKIpdJVPPVXhmU_beflYOnLuUI7k4eAbhpYAKJUc2JV4h2TvxiIWmmNqIissEk6ErNlsy-GNvPrX3FNFYIJAjGjQyRcvhURmAzdffu9vrnoRvuq2K4ncxHaDMjasu4zspMlyphP4AOIGdHDxi';

export function CalendarScreen() {
  const user = useAuthStore((s) => s.user);
  const [selectedDate, setSelectedDate] = useState(today());
  const [isWalkInModalVisible, setIsWalkInModalVisible] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const dates = getNextDays(14); // Extended to 14 days for more planning options

  // Fetch barber's salon
  const { data: salon } = useQuery({
    queryKey: ['barber-salon', user?.id],
    queryFn: async () => {
      if (!user) return null;
      try {
        const data = await apiClient.get<Record<string, unknown>>('/salons/my-salon');
        return data;
      } catch (error) {
        return null;
      }
    },
    enabled: !!user,
  });

  const salonId = salon?.id ?? null;

  // Fetch reservations for selected date
  const { data: reservations = [], refetch } = useQuery<Reservation[]>({
    queryKey: ['barber-reservations', salonId, selectedDate],
    queryFn: async () => {
      if (!salonId) return [];
      const data = await apiClient.get<Reservation[]>(`/reservations/salon/${salonId}`);
      return data.filter(r => 
        r.appointment_date === selectedDate && 
        ['Pending', 'Confirmed', 'Completed'].includes(r.status)
      );
    },
    enabled: !!salonId,
  });

  // Realtime updates
  useRealtimeBookings({ salonId });

  const openHour = salon?.open_time ? parseInt(salon.open_time.split(':')[0]) : 8;
  const closeHour = salon?.close_time ? parseInt(salon.close_time.split(':')[0]) : 22;
  const TOTAL_HOURS = closeHour - openHour;

  // Hour labels (e.g. 08:00, 09:00, ..., 22:00)
  const hourLabels = useMemo(() => {
    return Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
      const h = openHour + i;
      return `${String(h).padStart(2, '0')}:00`;
    });
  }, [openHour, TOTAL_HOURS]);

  // Format month and year label
  const monthYearLabel = useMemo(() => {
    const d = new Date(selectedDate);
    return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }, [selectedDate]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header bar */}
      <View style={styles.headerBar}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerLogo}>7afefli</Text>
          <Text style={styles.headerSub}>Mon Planning</Text>
        </View>
        <Image source={{ uri: user?.user_metadata?.avatar_url || DEFAULT_AVATAR }} style={styles.barberAvatar} />
      </View>

      {/* Date controls header */}
      <View style={styles.calendarHeader}>
        <View style={styles.monthSelectorRow}>
          <View>
            <Text style={styles.monthLabel}>{monthYearLabel}</Text>
            <Text style={styles.subtitleHint}>Visualisation de votre agenda</Text>
          </View>
          <View style={styles.monthNavButtons}>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => {
                const prev = new Date(selectedDate);
                prev.setDate(prev.getDate() - 1);
                setSelectedDate(prev.toISOString().split('T')[0]);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => {
                const next = new Date(selectedDate);
                next.setDate(next.getDate() + 1);
                setSelectedDate(next.toISOString().split('T')[0]);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-forward" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Weekly Day Cards Strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekStrip}>
          {dates.map((dateStr) => {
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === today();
            const dayName = getDayNameShort(dateStr).toUpperCase();
            const dayNum = getDayNumber(dateStr);

            return (
              <TouchableOpacity
                key={dateStr}
                style={[
                  styles.dayCard,
                  isSelected && styles.dayCardSelected,
                ]}
                onPress={() => setSelectedDate(dateStr)}
                activeOpacity={0.8}
              >
                <Text style={[styles.dayNameText, isSelected ? styles.textInk : styles.textSecondary]}>
                  {dayName}
                </Text>
                <Text style={[styles.dayNumText, isSelected ? styles.textInk : styles.textPrimary]}>
                  {dayNum}
                </Text>
                {isToday && (
                  <View style={[styles.todayDot, isSelected && styles.todayDotSelected]} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Timeline view */}
      <ScrollView style={styles.timelineContainer} showsVerticalScrollIndicator={false}>
        <View style={[styles.timelineContent, { height: TOTAL_HOURS * HOUR_HEIGHT + HOUR_HEIGHT }]}>
          {/* Main timeline vertical rule */}
          <View style={styles.timelineVerticalLine} />

          {/* Hourly slots grid background lines */}
          {hourLabels.map((label, i) => (
            <View key={label} style={[styles.hourRow, { top: i * HOUR_HEIGHT }]}>
              <Text style={styles.hourLabel}>{label}</Text>
              <View style={styles.hourLineRule} />
            </View>
          ))}

          {/* Dynamic Reservation blocks */}
          {reservations.map((reservation) => {
            const top = timeToPixelOffset(reservation.start_time, openHour);
            const height = durationToHeight(reservation.start_time, reservation.end_time);
            const client = (reservation as Record<string, unknown>).profiles;
            const service = (reservation as Record<string, unknown>).services;

            const isPending = reservation.status === 'Pending';
            const isConfirmed = reservation.status === 'Confirmed';
            const isCompleted = reservation.status === 'Completed';

            let borderLeftColor: string = colors.steel;
            let bgBlockColor: string = 'rgba(44, 44, 44, 0.4)';
            let statusIcon: string = 'checkmark-circle';
            let iconColor: string = colors.textMuted;

            if (isPending) {
              borderLeftColor = colors.pending;
              bgBlockColor = 'rgba(52, 152, 219, 0.08)';
              statusIcon = 'hourglass';
              iconColor = colors.pending;
            } else if (isConfirmed) {
              borderLeftColor = colors.success;
              bgBlockColor = 'rgba(46, 204, 113, 0.08)';
              statusIcon = 'checkmark-circle';
              iconColor = colors.success;
            } else if (isCompleted) {
              borderLeftColor = colors.steel;
              bgBlockColor = 'rgba(90, 90, 90, 0.08)';
              statusIcon = 'checkmark-done-circle';
              iconColor = colors.textMuted;
            }

            return (
              <TouchableOpacity
                key={reservation.id}
                onPress={() => setSelectedReservation(reservation)}
                activeOpacity={0.8}
                style={[
                  styles.reservationBlock,
                  {
                    top: top + 6, // shift slightly below the hourly line rule
                    height: Math.max(height - 12, 44), // leave spacing between blocks
                    backgroundColor: bgBlockColor,
                    borderLeftColor,
                  },
                ]}
              >
                <View style={styles.blockTextCol}>
                  <Text style={styles.blockClientText} numberOfLines={1}>
                    {client?.full_name || 'Client'}
                  </Text>
                  <Text style={styles.blockServiceText} numberOfLines={1}>
                    {service?.service_name || 'Soin coiffeur'} • {service?.duration_minutes || 30} min
                  </Text>
                  <Text style={styles.blockTimeText}>
                    ⏱️ {formatTime(reservation.start_time)} – {formatTime(reservation.end_time)}
                  </Text>
                </View>
                <Ionicons name={statusIcon as unknown as keyof typeof Ionicons.glyphMap} size={18} color={iconColor} style={styles.blockStatusIcon} />
              </TouchableOpacity>
            );
          })}

          {/* Empty timeline indicator */}
          {reservations.length === 0 && (
            <View style={styles.emptyTimelineCard}>
              <Ionicons name="calendar-outline" size={24} color={colors.textMuted} />
              <Text style={styles.emptyTimelineText}>Aucun rendez-vous planifié</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button (FAB) to Add Bookings */}
      <TouchableOpacity
        style={styles.fabButton}
        onPress={() => setIsWalkInModalVisible(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color={colors.ink} />
      </TouchableOpacity>

      {salonId && (
        <AddWalkInModal
          visible={isWalkInModalVisible}
          onClose={() => setIsWalkInModalVisible(false)}
          salonId={salonId}
          onSuccess={() => refetch()}
        />
      )}

      <ReservationDetailModal
        visible={!!selectedReservation}
        onClose={() => setSelectedReservation(null)}
        reservation={selectedReservation}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  headerBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogo: {
    fontFamily: 'Syne_700Bold',
    fontSize: 18,
    color: colors.amber,
  },
  headerSub: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
    color: colors.textPrimary,
  },
  barberAvatar: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  calendarHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.ink,
  },
  monthSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  monthLabel: {
    fontFamily: 'Syne_700Bold',
    fontSize: 22,
    color: colors.textPrimary,
    textTransform: 'capitalize',
  },
  subtitleHint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  monthNavButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.carbon,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekStrip: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  dayCard: {
    width: 56,
    height: 76,
    borderRadius: radius.lg,
    backgroundColor: colors.carbon,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCardSelected: {
    backgroundColor: colors.amber,
    borderColor: colors.amber,
    ...shadows.amber,
  },
  dayNameText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  dayNumText: {
    fontFamily: 'Syne_700Bold',
    fontSize: 18,
  },
  textPrimary: {
    color: colors.textPrimary,
  },
  textSecondary: {
    color: colors.textSecondary,
  },
  textInk: {
    color: colors.ink,
  },
  todayDot: {
    position: 'absolute',
    bottom: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.amber,
  },
  todayDotSelected: {
    backgroundColor: colors.ink,
  },
  timelineContainer: {
    flex: 1,
  },
  timelineContent: {
    position: 'relative',
    marginHorizontal: spacing.lg,
  },
  timelineVerticalLine: {
    position: 'absolute',
    left: 56,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  hourRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    height: HOUR_HEIGHT,
  },
  hourLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
    color: colors.textMuted,
    width: 44,
    textAlign: 'right',
    marginRight: 12,
    marginTop: -8, // center visually relative to line
  },
  hourLineRule: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  reservationBlock: {
    position: 'absolute',
    left: 64, // shift right of the timeline vertical rule
    right: 0,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderLeftWidth: 4,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  blockTextCol: {
    flex: 1,
    marginRight: spacing.md,
  },
  blockClientText: {
    fontFamily: 'Syne_600SemiBold',
    fontSize: 15,
    color: colors.textPrimary,
  },
  blockServiceText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  blockTimeText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
    color: colors.amber,
    marginTop: 4,
  },
  blockStatusIcon: {
    alignSelf: 'center',
  },
  emptyTimelineCard: {
    position: 'absolute',
    left: 64,
    right: 0,
    top: 100,
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  emptyTimelineText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textMuted,
  },
  fabButton: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    backgroundColor: colors.amber,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.amber,
    zIndex: 40,
  },
});
