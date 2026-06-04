// apps/mobile/src/screens/barber/CalendarScreen.tsx
// Full-day timeline view with realtime reservation blocks + pending panel

import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Image, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import Ionicons from '@react-native-vector-icons/ionicons';
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
  const durationMin = eh * 60 + em - (sh * 60 + sm);
  return (durationMin / 60) * HOUR_HEIGHT;
}

const DEFAULT_AVATAR =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDqBwevJA_-4C8CiV0jhFk0kQ1wMed3SXsDLtkuYojI_z1NOOr9TsG1ppWseymOF1jEuEUK3KfQn_lUckAbPgmIaSRhgIECSEyCop0h_moZW-TI7--iKZxYbB5dZpkgKIpdJVPPVXhmU_beflYOnLuUI7k4eAbhpYAKJUc2JV4h2TvxiIWmmNqIissEk6ErNlsy-GNvPrX3FNFYIJAjGjQyRcvhURmAzdffu9vrnoRvuq2K4ncxHaDMjasu4zspMlyphP4AOIGdHDxi';

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function CalendarScreen() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(today());
  const [isWalkInModalVisible, setIsWalkInModalVisible] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const dates = getNextDays(14);

  // ── Mutations ────────────────────────────────────────────────────────────
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiClient.patch(`/reservations/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barber-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['barber-pending'] });
    },
    onError: (error: unknown) => {
      Alert.alert('Erreur', (error as Error).message || 'Impossible de modifier la réservation');
    },
  });

  const handleConfirm = (id: string) => {
    Alert.alert('Confirmer ?', 'Voulez-vous accepter ce rendez-vous ?', [
      { text: 'Non', style: 'cancel' },
      { text: 'Oui, confirmer', onPress: () => updateStatus.mutate({ id, status: 'Confirmed' }) },
    ]);
  };

  const handleCancel = (id: string) => {
    Alert.alert('Annuler la réservation ?', 'Cette action notifiera le client.', [
      { text: 'Non', style: 'cancel' },
      { text: 'Oui, annuler', style: 'destructive', onPress: () => updateStatus.mutate({ id, status: 'Cancelled' }) },
    ]);
  };

  // ── Fetch salon ───────────────────────────────────────────────────────────
  const { data: salon } = useQuery({
    queryKey: ['barber-salon', user?.id],
    queryFn: async () => {
      if (!user) return null;
      try {
        return await apiClient.get<Record<string, unknown>>('/salons/my-salon');
      } catch {
        return null;
      }
    },
    enabled: !!user,
  });

  const salonId = salon?.id as string | null ?? null;

  // ── Fetch reservations for selected date (newest first in timeline) ───────
  const { data: reservations = [], refetch } = useQuery<Reservation[]>({
    queryKey: ['barber-reservations', salonId, selectedDate],
    queryFn: async () => {
      if (!salonId) return [];
      const data = await apiClient.get<Reservation[]>(
        `/reservations/salon/${salonId}?date=${selectedDate}`,
      );
      // Sort: newest created_at first for list, but timeline uses start_time (positional)
      // Exclude CRÉNEAU BLOQUÉ — these are internal blocks, not client appointments
      return data.filter(
        (r) =>
          ['Pending', 'Confirmed', 'Completed'].includes(r.status) &&
          !(r as Record<string, unknown>).notes?.toString().includes('CRÉNEAU BLOQUÉ'),
      );
    },
    enabled: !!salonId,
  });

  // ── Fetch ALL pending reservations (other days) ───────────────────────────
  const { data: pendingAll = [], isLoading: pendingLoading } = useQuery<Reservation[]>({
    queryKey: ['barber-pending', salonId],
    queryFn: async () => {
      if (!salonId) return [];
      return apiClient.get<Reservation[]>(`/reservations/salon/${salonId}/pending`);
    },
    enabled: !!salonId,
  });

  // Pending reservations that are NOT on the currently selected date
  const pendingOtherDays = pendingAll.filter((r) => r.appointment_date !== selectedDate);

  // Realtime updates
  useRealtimeBookings({ salonId });

  const openHour = salon?.open_time ? parseInt((salon.open_time as string).split(':')[0]) : 8;
  const rawCloseHour = salon?.close_time ? parseInt((salon.close_time as string).split(':')[0]) : 22;
  const closeHour = rawCloseHour === 0 ? 24 : rawCloseHour;
  const TOTAL_HOURS = Math.max(closeHour - openHour, 1);

  const hourLabels = useMemo(() => {
    return Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
      const h = openHour + i;
      return `${String(h).padStart(2, '0')}:00`;
    });
  }, [openHour, TOTAL_HOURS]);

  const monthYearLabel = useMemo(() => {
    const d = new Date(selectedDate);
    return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }, [selectedDate]);

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.headerBar}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerLogo}>7afefli</Text>
          <View style={styles.headerDivider} />
          <Text style={styles.headerSub}>Mon Planning</Text>
        </View>
        <Image
          source={{ uri: user?.user_metadata?.avatar_url || DEFAULT_AVATAR }}
          style={styles.barberAvatar}
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[0]}>
        {/* ── Calendar strip (sticky) ── */}
        <View style={styles.calendarHeader}>
          {/* Month + nav */}
          <View style={styles.monthSelectorRow}>
            <View>
              <Text style={styles.monthLabel}>{monthYearLabel}</Text>
              <Text style={styles.subtitleHint}>Appuyez sur un jour pour voir le planning</Text>
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

          {/* Day cards strip */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekStrip}>
            {dates.map((dateStr) => {
              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === today();
              const dayName = getDayNameShort(dateStr).toUpperCase();
              const dayNum = getDayNumber(dateStr);
              const hasPending = pendingAll.some((r) => r.appointment_date === dateStr && r.status === 'Pending');

              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[styles.dayCard, isSelected && styles.dayCardSelected]}
                  onPress={() => setSelectedDate(dateStr)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dayNameText, isSelected ? styles.textInk : styles.textSecondary]}>
                    {dayName}
                  </Text>
                  <Text style={[styles.dayNumText, isSelected ? styles.textInk : styles.textPrimary]}>
                    {dayNum}
                  </Text>
                  {isToday && <View style={[styles.todayDot, isSelected && styles.todayDotSelected]} />}
                  {hasPending && !isSelected && <View style={styles.pendingDot} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Timeline ── */}
        <View style={[styles.timelineContent, { height: TOTAL_HOURS * HOUR_HEIGHT + HOUR_HEIGHT }]}>
          <View style={styles.timelineVerticalLine} />

          {hourLabels.map((label, i) => (
            <View key={label} style={[styles.hourRow, { top: i * HOUR_HEIGHT }]}>
              <Text style={styles.hourLabel}>{label}</Text>
              <View style={styles.hourLineRule} />
            </View>
          ))}

          {reservations.map((reservation) => {
            const top = timeToPixelOffset(reservation.start_time, openHour);
            const height = durationToHeight(reservation.start_time, reservation.end_time);
            const client = (reservation as Record<string, unknown>).profiles as Record<string, unknown> | undefined;
            const service = (reservation as Record<string, unknown>).services as Record<string, unknown> | undefined;
            const isWalkIn = (reservation.notes as string | null)?.includes('[Sans RDV]');

            const isPending = reservation.status === 'Pending';
            const isConfirmed = reservation.status === 'Confirmed';
            const isCompleted = reservation.status === 'Completed';

            let borderLeftColor = colors.steel;
            let bgBlockColor = 'rgba(44, 44, 44, 0.4)';
            let statusIcon = 'checkmark-circle';
            let iconColor = colors.textMuted;

            if (isPending) {
              borderLeftColor = colors.pending;
              bgBlockColor = 'rgba(52, 152, 219, 0.10)';
              statusIcon = 'hourglass-outline';
              iconColor = colors.pending;
            } else if (isConfirmed) {
              borderLeftColor = colors.success;
              bgBlockColor = 'rgba(46, 204, 113, 0.10)';
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
                    top: top + 6,
                    height: Math.max(height - 12, 44),
                    backgroundColor: bgBlockColor,
                    borderLeftColor,
                  },
                ]}
              >
                <View style={styles.blockTextCol}>
                  <View style={styles.blockTopRow}>
                    <Text style={styles.blockClientText} numberOfLines={1}>
                      {client?.full_name as string || 'Client'}
                    </Text>
                    {isWalkIn && (
                      <View style={styles.walkInBadge}>
                        <Text style={styles.walkInBadgeText}>Sans RDV</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.blockServiceText} numberOfLines={1}>
                    {service?.service_name as string || 'Soin'} • {service?.duration_minutes as number || 30} min
                  </Text>
                  <Text style={styles.blockTimeText}>
                    ⏱ {formatTime(reservation.start_time)} – {formatTime(reservation.end_time)}
                  </Text>
                </View>
                <View style={styles.blockRightCol}>
                  <Ionicons name={statusIcon as unknown as keyof typeof Ionicons.glyphMap} size={20} color={iconColor} />
                  {isPending && (
                    <TouchableOpacity
                      style={styles.quickConfirmBtn}
                      onPress={() => handleConfirm(reservation.id)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="checkmark" size={14} color={colors.ink} />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}

          {reservations.length === 0 && (
            <View style={styles.emptyTimelineCard}>
              <Ionicons name="calendar-outline" size={28} color={colors.textMuted} />
              <Text style={styles.emptyTimelineText}>Aucun rendez-vous ce jour</Text>
            </View>
          )}
        </View>

        {/* ── Pending other days panel ── */}
        {(pendingOtherDays.length > 0 || pendingLoading) && (
          <View style={styles.pendingSection}>
            <View style={styles.pendingSectionHeader}>
              <Ionicons name="hourglass-outline" size={18} color={colors.pending} />
              <Text style={styles.pendingSectionTitle}>
                En attente de confirmation
              </Text>
              {pendingOtherDays.length > 0 && (
                <View style={styles.pendingCount}>
                  <Text style={styles.pendingCountText}>{pendingOtherDays.length}</Text>
                </View>
              )}
            </View>

            {pendingLoading ? (
              <ActivityIndicator color={colors.pending} style={{ marginVertical: spacing.md }} />
            ) : pendingOtherDays.length === 0 ? (
              <Text style={styles.emptyPendingText}>Aucune demande en attente</Text>
            ) : (
              pendingOtherDays.map((r) => {
                const client = (r as Record<string, unknown>).profiles as Record<string, unknown> | undefined;
                const service = (r as Record<string, unknown>).services as Record<string, unknown> | undefined;
                const isWalkIn = (r.notes as string | null)?.includes('[Sans RDV]');
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={styles.pendingCard}
                    onPress={() => setSelectedReservation(r)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.pendingCardLeft}>
                      <View style={styles.pendingDateBadge}>
                        <Text style={styles.pendingDateDay}>
                          {getDayNumber(r.appointment_date)}
                        </Text>
                        <Text style={styles.pendingDateMonth}>
                          {new Date(r.appointment_date).toLocaleDateString('fr-FR', { month: 'short' })}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.pendingCardCenter}>
                      <View style={styles.pendingNameRow}>
                        <Text style={styles.pendingClientName} numberOfLines={1}>
                          {client?.full_name as string || 'Client'}
                        </Text>
                        {isWalkIn && (
                          <View style={styles.walkInBadge}>
                            <Text style={styles.walkInBadgeText}>Sans RDV</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.pendingServiceText} numberOfLines={1}>
                        {service?.service_name as string || 'Service'} • {formatTime(r.start_time)}
                      </Text>
                    </View>
                    <View style={styles.pendingCardActions}>
                      <TouchableOpacity
                        style={styles.confirmBtn}
                        onPress={() => handleConfirm(r.id)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="checkmark" size={16} color={colors.ink} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.rejectBtn}
                        onPress={() => handleCancel(r.id)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="close" size={16} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── FAB ── */}
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
        onCancel={handleCancel}
        onConfirm={handleConfirm}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink },

  // Header
  headerBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerLogo: { fontFamily: 'Syne_700Bold', fontSize: 18, color: colors.amber },
  headerDivider: {
    width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.15)',
  },
  headerSub: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: colors.textSecondary },
  barberAvatar: {
    width: 34, height: 34, borderRadius: radius.full,
    borderWidth: 2, borderColor: colors.amber,
  },

  // Calendar strip
  calendarHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  monthSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  monthLabel: {
    fontFamily: 'Syne_700Bold',
    fontSize: 20,
    color: colors.textPrimary,
    textTransform: 'capitalize',
  },
  subtitleHint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  monthNavButtons: { flexDirection: 'row', gap: spacing.sm },
  navBtn: {
    width: 36, height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.carbon,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekStrip: { gap: spacing.sm, paddingBottom: spacing.sm },
  dayCard: {
    width: 54, height: 74,
    borderRadius: radius.lg,
    backgroundColor: colors.carbon,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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
  dayNumText: { fontFamily: 'Syne_700Bold', fontSize: 18 },
  textPrimary: { color: colors.textPrimary },
  textSecondary: { color: colors.textSecondary },
  textInk: { color: colors.ink },
  todayDot: {
    position: 'absolute', bottom: 7,
    width: 4, height: 4,
    borderRadius: 2, backgroundColor: colors.amber,
  },
  todayDotSelected: { backgroundColor: colors.ink },
  pendingDot: {
    position: 'absolute', top: 7, right: 7,
    width: 6, height: 6,
    borderRadius: 3, backgroundColor: colors.pending,
  },

  // Timeline
  timelineContent: {
    position: 'relative',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  timelineVerticalLine: {
    position: 'absolute',
    left: 52, top: 0, bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  hourRow: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', height: HOUR_HEIGHT,
  },
  hourLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
    color: colors.textMuted,
    width: 42,
    textAlign: 'right',
    marginRight: 10,
    marginTop: -8,
  },
  hourLineRule: {
    flex: 1, height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  reservationBlock: {
    position: 'absolute',
    left: 60, right: 0,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderLeftWidth: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  blockTextCol: { flex: 1, marginRight: spacing.sm },
  blockTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  blockClientText: {
    fontFamily: 'Syne_600SemiBold',
    fontSize: 14,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  walkInBadge: {
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  walkInBadgeText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 9,
    color: colors.amber,
  },
  blockServiceText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
  },
  blockTimeText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 10,
    color: colors.amber,
    marginTop: 3,
  },
  blockRightCol: { alignItems: 'center', gap: 4 },
  quickConfirmBtn: {
    backgroundColor: colors.success,
    width: 24, height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTimelineCard: {
    position: 'absolute',
    left: 60, right: 0, top: 80,
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    borderStyle: 'dashed',
  },
  emptyTimelineText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textMuted,
  },

  // Pending section
  pendingSection: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    backgroundColor: colors.carbon,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(52,152,219,0.2)',
  },
  pendingSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pendingSectionTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 15,
    color: colors.textPrimary,
    flex: 1,
  },
  pendingCount: {
    backgroundColor: colors.pending,
    width: 22, height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingCountText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
    color: colors.ink,
  },
  emptyPendingText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  pendingCardLeft: {},
  pendingDateBadge: {
    width: 44, height: 48,
    backgroundColor: 'rgba(52,152,219,0.12)',
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingDateDay: {
    fontFamily: 'Syne_700Bold',
    fontSize: 18,
    color: colors.pending,
    lineHeight: 20,
  },
  pendingDateMonth: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 10,
    color: colors.pending,
    textTransform: 'uppercase',
  },
  pendingCardCenter: { flex: 1 },
  pendingNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  pendingClientName: {
    fontFamily: 'Syne_600SemiBold',
    fontSize: 14,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  pendingServiceText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  pendingCardActions: { flexDirection: 'row', gap: spacing.sm },
  confirmBtn: {
    width: 34, height: 34,
    borderRadius: 17,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: {
    width: 34, height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // FAB
  fabButton: {
    position: 'absolute',
    bottom: 24, right: 20,
    backgroundColor: colors.amber,
    width: 58, height: 58,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.amber,
    zIndex: 40,
  },
});
