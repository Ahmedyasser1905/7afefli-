import Toast from 'react-native-toast-message';
// apps/mobile/src/screens/barber/CalendarScreen.tsx
// Professional full-day timeline with overlap handling, future date support, and working nav

import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Image, Alert, ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import { colors, spacing, radius, shadows } from '../../theme';
import { useRealtimeBookings } from '../../hooks/barber/useRealtimeBookings';
import { useAuthStore } from '../../store/authStore';
import { getDayNameShort, getDayNumber, today, formatTime } from '@barberdz/shared/utils/formatters';
import Ionicons from '@react-native-vector-icons/ionicons';
import type { Reservation } from '@barberdz/shared/types';
import { AddWalkInModal } from '../../components/barber/AddWalkInModal';
import { ReservationDetailModal } from '../../components/barber/ReservationDetailModal';
import { useTranslations } from '../../hooks/useTranslations';
import { DEFAULT_AVATAR } from '../../lib/constants';

const HOUR_HEIGHT = 88;
const SCREEN_WIDTH = Dimensions.get('window').width;
const TIMELINE_LEFT = 60; // px reserved for hour labels
const TIMELINE_RIGHT_PAD = 16;
const TIMELINE_WIDTH = SCREEN_WIDTH - TIMELINE_LEFT - TIMELINE_RIGHT_PAD - spacing.lg * 2;

function algToday(): string {
  const t = new Date(Date.now() + 60 * 60 * 1000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

function addDays(dateStr: string, n: number): string {
  // Parse without timezone shift: treat YYYY-MM-DD as local noon
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function timeToPixelOffset(time: string, openHour: number): number {
  const minutes = timeToMinutes(time) - openHour * 60;
  return (minutes / 60) * HOUR_HEIGHT;
}

function durationToHeight(startTime: string, endTime: string): number {
  const dur = timeToMinutes(endTime) - timeToMinutes(startTime);
  return (dur / 60) * HOUR_HEIGHT;
}

/** Resolve overlapping reservations into columns so they don't stack */
function resolveOverlaps(reservations: Reservation[]): Array<Reservation & { col: number; totalCols: number }> {
  const sorted = [...reservations].sort((a, b) =>
    timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
  );

  // Group into clusters of overlapping events
  const clusters: Reservation[][] = [];
  for (const r of sorted) {
    let placed = false;
    for (const cluster of clusters) {
      const overlaps = cluster.some(
        (c) => timeToMinutes(r.start_time) < timeToMinutes(c.end_time) &&
               timeToMinutes(r.end_time) > timeToMinutes(c.start_time)
      );
      if (overlaps) {
        cluster.push(r);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([r]);
  }

  const result: Array<Reservation & { col: number; totalCols: number }> = [];
  for (const cluster of clusters) {
    const cols: Reservation[][] = [];
    for (const r of cluster) {
      let placed = false;
      for (let c = 0; c < cols.length; c++) {
        const lastInCol = cols[c][cols[c].length - 1];
        if (timeToMinutes(r.start_time) >= timeToMinutes(lastInCol.end_time)) {
          cols[c].push(r);
          result.push({ ...r, col: c, totalCols: 0 }); // totalCols patched below
          placed = true;
          break;
        }
      }
      if (!placed) {
        cols.push([r]);
        result.push({ ...r, col: cols.length - 1, totalCols: 0 });
      }
    }
    // Patch totalCols for this cluster
    const totalCols = cols.length;
    for (const item of result) {
      if (cluster.some((c) => c.id === item.id)) {
        item.totalCols = totalCols;
      }
    }
  }
  return result;
}


export function CalendarScreen() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const { t, locale } = useTranslations();
  // selectedDate can be any valid YYYY-MM-DD, not limited to the next 14 days
  const [selectedDate, setSelectedDate] = useState(algToday());
  const [isWalkInModalVisible, setIsWalkInModalVisible] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const stripScrollRef = useRef<ScrollView>(null);

  // Build a 30-day window centered on selectedDate so users can scroll past/future
  const dates = useMemo(() => {
    const base = algToday();
    // -7 past days + today + 22 future days = 30 days
    return Array.from({ length: 30 }, (_, i) => addDays(base, i - 7));
  }, []);

  const navigateDay = useCallback((delta: number) => {
    setSelectedDate((prev) => addDays(prev, delta));
  }, []);

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
      Toast.show({ type: 'error', text1: t('common.error'), text2: (error as Error).message || t('barber.cancel_reservation_failed') });
    },
  });

  const handleConfirm = useCallback((id: string) => {
    Alert.alert(t('barber.confirm_title'), t('barber.confirm_question'), [
      { text: t('common.no'), style: 'cancel' },
      { text: t('barber.confirm_yes'), onPress: () => updateStatus.mutate({ id, status: 'Confirmed' }) },
    ]);
  }, [updateStatus, t]);

  const handleCancel = useCallback((id: string) => {
    Alert.alert(t('barber.confirm_title'), t('barber.confirm_question'), [
      { text: t('common.no'), style: 'cancel' },
      { text: t('common.cancel'), style: 'destructive', onPress: () => updateStatus.mutate({ id, status: 'Cancelled' }) },
    ]);
  }, [updateStatus, t]);

  const handleComplete = useCallback((id: string) => {
    Alert.alert(t('barber.confirm_title'), t('barber.confirm_question'), [
      { text: t('common.no'), style: 'cancel' },
      { text: t('common.yes'), onPress: () => updateStatus.mutate({ id, status: 'Completed' }) },
    ]);
  }, [updateStatus, t]);

  // ── Fetch salon ───────────────────────────────────────────────────────────
  const { data: salon } = useQuery({
    // FIX-6: Use canonical ['my-salon', user?.id] key to share cache with DashboardScreen
    queryKey: ['my-salon', user?.id],
    queryFn: async () => {
      if (!user) return null;
      try { return await apiClient.get<Record<string, unknown>>('/salons/my-salon'); }
      catch { return null; }
    },
    enabled: !!user,
  });

  const salonId = (salon?.id as string) ?? null;

  // ── Fetch reservations for selected date ──────────────────────────────────
  const { data: reservations = [], isLoading: resLoading, refetch } = useQuery<Reservation[]>({
    queryKey: ['barber-reservations', salonId, selectedDate],
    queryFn: async () => {
      if (!salonId) return [];
      const data = await apiClient.get<Reservation[]>(
        `/reservations/salon/${salonId}?date=${selectedDate}`,
      );
      return (data || []).filter(
        (r) => !((r as unknown) as Record<string, unknown>).notes?.toString().includes('CRÉNEAU BLOQUÉ'),
      );
    },
    enabled: !!salonId,
    staleTime: 0,
    // No refetchInterval — useRealtimeBookings handles live updates via Supabase Realtime
  });

  // ── Fetch ALL pending reservations (across all dates) ─────────────────────
  const { data: pendingAll = [], isLoading: pendingLoading } = useQuery<Reservation[]>({
    queryKey: ['barber-pending', salonId],
    queryFn: async () => {
      if (!salonId) return [];
      return apiClient.get<Reservation[]>(`/reservations/salon/${salonId}/pending`);
    },
    enabled: !!salonId,
    staleTime: 30 * 1000,
  });

  const pendingOtherDays = pendingAll.filter((r) => r.appointment_date !== selectedDate);

  useRealtimeBookings({ salonId });

  // ── Calendar timeline config (dynamic from salon hours) ───────────────────
  const isOpen24h = salon?.open_time === salon?.close_time || (salon?.open_time === '00:00' && salon?.close_time === '00:00');
  const openHour = isOpen24h ? 0 : (salon?.open_time ? parseInt((salon.open_time as string).split(':')[0]) : 8);
  const rawCloseHour = isOpen24h ? 24 : (salon?.close_time ? parseInt((salon.close_time as string).split(':')[0]) : 22);
  const closeHour = rawCloseHour === 0 ? 24 : rawCloseHour;
  const TOTAL_HOURS = Math.max(closeHour - openHour, 1);

  const hourLabels = useMemo(
    () => Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
      const h = openHour + i;
      return `${String(h).padStart(2, '0')}:00`;
    }),
    [openHour, TOTAL_HOURS]
  );

  // Algeria current time for "now" line
  const algNow = new Date(Date.now() + 60 * 60 * 1000);
  const nowMinutes = algNow.getUTCHours() * 60 + algNow.getUTCMinutes();
  const nowTop = ((nowMinutes - openHour * 60) / 60) * HOUR_HEIGHT;
  const showNowLine = selectedDate === algToday() && nowMinutes > openHour * 60 && nowMinutes < closeHour * 60;

  // ── Resolve overlaps for this day's reservations ───────────────────────────
  const resolvedReservations = useMemo(() => resolveOverlaps(reservations), [reservations]);

  const monthYearLabel = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(locale === 'ar' ? 'ar-DZ' : 'fr-FR', { month: 'long', year: 'numeric' });
  }, [selectedDate, locale]);

  const selectedDayLabel = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(locale === 'ar' ? 'ar-DZ' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }, [selectedDate, locale]);

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.headerBar}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerLogo}>7afefli</Text>
          <View style={styles.headerDivider} />
          <Text style={styles.headerSub}>{t('barber.my_planning')}</Text>
        </View>
        <Image
          source={{ uri: user?.user_metadata?.avatar_url || DEFAULT_AVATAR }}
          style={styles.barberAvatar}
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[0]}>
        {/* ── Sticky Calendar Header ── */}
        <View style={styles.calendarHeader}>
          {/* Month label + nav arrows */}
          <View style={styles.monthSelectorRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.monthLabel} numberOfLines={1}>{monthYearLabel}</Text>
              <Text style={styles.selectedDayLabel} numberOfLines={1}>{selectedDayLabel}</Text>
            </View>
            <View style={styles.monthNavButtons}>
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => navigateDay(-1)}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.navBtn, selectedDate === algToday() && styles.navBtnToday]}
                onPress={() => setSelectedDate(algToday())}
                activeOpacity={0.7}
              >
                <Text style={[styles.todayBtnText, selectedDate === algToday() && styles.todayBtnTextActive]}>{t('barber.today_btn')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => navigateDay(1)}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="chevron-forward" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Day strip — 30 day window */}
          <ScrollView
            ref={stripScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.weekStrip}
          >
            {dates.map((dateStr) => {
              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === algToday();
              const isPast = dateStr < algToday();
              const [y, m, d] = dateStr.split('-').map(Number);
              const dayName = new Date(y, m - 1, d).toLocaleDateString(locale === 'ar' ? 'ar-DZ' : 'fr-FR', { weekday: 'short' }).slice(0, 3).toUpperCase();
              const dayNum = d;
              const hasPending = pendingAll.some((r) => r.appointment_date === dateStr && r.status === 'Pending');
              const hasBookings = pendingAll.some((r) => r.appointment_date === dateStr) ||
                                  (isSelected && reservations.length > 0);

              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[
                    styles.dayCard,
                    isSelected && styles.dayCardSelected,
                    isPast && !isSelected && styles.dayCardPast,
                  ]}
                  onPress={() => setSelectedDate(dateStr)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dayNameText, isSelected ? styles.textInk : isPast ? styles.textMuted : styles.textSecondary]}>
                    {dayName}
                  </Text>
                  <Text style={[styles.dayNumText, isSelected ? styles.textInk : isPast ? styles.textMuted : styles.textPrimary]}>
                    {dayNum}
                  </Text>
                  {isToday && <View style={[styles.todayDot, isSelected && styles.todayDotSelected]} />}
                  {hasPending && !isSelected && <View style={styles.pendingDot} />}
                  {hasBookings && !hasPending && !isSelected && <View style={styles.bookingDot} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Timeline ── */}
        {resLoading ? (
          <View style={styles.loadingTimeline}>
            <ActivityIndicator color={colors.amber} />
            <Text style={styles.loadingText}>{t('common.loading')}</Text>
          </View>
        ) : (
          <View style={[styles.timelineContent, { height: TOTAL_HOURS * HOUR_HEIGHT + HOUR_HEIGHT }]}>
            <View style={styles.timelineVerticalLine} />

            {/* Hour grid */}
            {hourLabels.map((label, i) => (
              <View key={label} style={[styles.hourRow, { top: i * HOUR_HEIGHT }]}>
                <Text style={styles.hourLabel}>{label}</Text>
                <View style={styles.hourLineRule} />
              </View>
            ))}

            {/* Current time indicator */}
            {showNowLine && (
              <View style={[styles.nowLine, { top: nowTop }]}>
                <View style={styles.nowDot} />
                <View style={styles.nowLineRule} />
              </View>
            )}

            {/* Reservation blocks — overlap-resolved */}
            {resolvedReservations.map((reservation) => {
              const top = timeToPixelOffset(reservation.start_time, openHour);
              const height = Math.max(durationToHeight(reservation.start_time, reservation.end_time) - 8, 44);
              const colWidth = TIMELINE_WIDTH / reservation.totalCols;
              const left = TIMELINE_LEFT + reservation.col * colWidth + 2;
              const width = colWidth - 4;

              const client = ((reservation as unknown) as Record<string, unknown>).profiles as Record<string, unknown> | undefined;
              const service = ((reservation as unknown) as Record<string, unknown>).services as Record<string, unknown> | undefined;
              const isWalkIn = reservation.is_walk_in === true;

              let walkInName = '';
              if (isWalkIn && reservation.notes) {
                const match = (reservation.notes as string).match(/Client:\s*(.*?)(?:\s*-\s*Tel:|\s*\n|$)/);
                walkInName = match?.[1]?.trim() || '';
              }
              const displayName = walkInName || (client?.full_name as string) || t('barber.client_fallback');

              const isPending   = reservation.status === 'Pending';
              const isConfirmed = reservation.status === 'Confirmed';
              const isCompleted = reservation.status === 'Completed';
              const isCancelled = reservation.status === 'Cancelled';

              let borderColor: string = colors.steel;
              let bgColor: string = 'rgba(44,44,44,0.5)';
              if (isPending)   { borderColor = colors.pending;  bgColor = 'rgba(52,152,219,0.12)'; }
              if (isConfirmed) { borderColor = colors.success;  bgColor = 'rgba(46,204,113,0.12)'; }
              if (isCompleted) { borderColor = colors.steel;    bgColor = 'rgba(90,90,90,0.10)'; }
              if (isCancelled) { borderColor = colors.error;    bgColor = 'rgba(231,76,60,0.08)'; }

              return (
                <TouchableOpacity
                  key={reservation.id}
                  onPress={() => setSelectedReservation(reservation)}
                  activeOpacity={0.85}
                  style={[styles.reservationBlock, {
                    top: top + 4,
                    height,
                    left,
                    width,
                    backgroundColor: bgColor,
                    borderLeftColor: borderColor,
                  }]}
                >
                  <Text style={styles.blockClientText} numberOfLines={1}>{displayName}</Text>
                  {height > 52 && (
                    <Text style={styles.blockServiceText} numberOfLines={1}>
                      {service?.service_name as string || t('barber.service_fallback')}
                    </Text>
                  )}
                  <Text style={styles.blockTimeText}>
                    {formatTime(reservation.start_time)}–{formatTime(reservation.end_time)}
                  </Text>
                  {isPending && height > 60 && (
                    <TouchableOpacity
                      style={styles.quickConfirmBtn}
                      onPress={() => handleConfirm(reservation.id)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="checkmark" size={10} color={colors.ink} />
                    </TouchableOpacity>
                  )}
                  {isConfirmed && height > 72 && (
                    <TouchableOpacity
                      style={styles.quickCompleteBtn}
                      onPress={() => handleComplete(reservation.id)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="checkmark-done" size={10} color={colors.ink} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}

            {reservations.length === 0 && (
              <View style={styles.emptyTimelineCard}>
                <Ionicons name="calendar-outline" size={28} color={colors.textMuted} />
                <Text style={styles.emptyTimelineText}>{t('barber.no_reservations')}</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Pending other days panel ── */}
        {(pendingOtherDays.length > 0 || pendingLoading) && (
          <View style={styles.pendingSection}>
            <View style={styles.pendingSectionHeader}>
              <Ionicons name="hourglass-outline" size={18} color={colors.pending} />
              <Text style={styles.pendingSectionTitle}>{t('barber.filter_pending')}</Text>
              {pendingOtherDays.length > 0 && (
                <View style={styles.pendingCount}>
                  <Text style={styles.pendingCountText}>{pendingOtherDays.length}</Text>
                </View>
              )}
            </View>

            {pendingLoading ? (
              <ActivityIndicator color={colors.pending} style={{ marginVertical: spacing.md }} />
            ) : (
              pendingOtherDays.map((r) => {
                const client = ((r as unknown) as Record<string, unknown>).profiles as Record<string, unknown> | undefined;
                const service = ((r as unknown) as Record<string, unknown>).services as Record<string, unknown> | undefined;
                const isWalkIn = r.is_walk_in === true;
                const [ry, rm, rd] = r.appointment_date.split('-').map(Number);
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={styles.pendingCard}
                    onPress={() => {
                      setSelectedDate(r.appointment_date);
                      setSelectedReservation(r);
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={styles.pendingDateBadge}>
                      <Text style={styles.pendingDateDay}>{rd}</Text>
                      <Text style={styles.pendingDateMonth}>
                        {new Date(ry, rm - 1, rd).toLocaleDateString(locale === 'ar' ? 'ar-DZ' : 'fr-FR', { month: 'short' })}
                      </Text>
                    </View>
                    <View style={styles.pendingCardCenter}>
                      <View style={styles.pendingNameRow}>
                        <Text style={styles.pendingClientName} numberOfLines={1}>
                          {client?.full_name as string || t('barber.client_fallback')}
                        </Text>
                        {isWalkIn && <View style={styles.walkInBadge}><Text style={styles.walkInBadgeText}>{t('barber.walkin_badge')}</Text></View>}
                      </View>
                      <Text style={styles.pendingServiceText} numberOfLines={1}>
                        {service?.service_name as string || t('barber.service_fallback')} • {formatTime(r.start_time)}
                      </Text>
                    </View>
                    <View style={styles.pendingCardActions}>
                      <TouchableOpacity style={styles.confirmBtn} onPress={() => handleConfirm(r.id)} activeOpacity={0.8}>
                        <Ionicons name="checkmark" size={16} color={colors.ink} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.rejectBtn} onPress={() => handleCancel(r.id)} activeOpacity={0.8}>
                        <Ionicons name="close" size={16} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── FAB ── */}
      <TouchableOpacity style={styles.fabButton} onPress={() => setIsWalkInModalVisible(true)} activeOpacity={0.8}>
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
        reservation={selectedReservation as unknown as Record<string, unknown>}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
        onComplete={handleComplete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink },
  headerBar: {
    height: 56, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerLogo: { fontFamily: 'Syne_700Bold', fontSize: 18, color: colors.amber },
  headerDivider: { width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.15)' },
  headerSub: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: colors.textSecondary },
  barberAvatar: { width: 34, height: 34, borderRadius: radius.full, borderWidth: 2, borderColor: colors.amber },

  calendarHeader: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm,
    backgroundColor: colors.ink, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  monthSelectorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  monthLabel: { fontFamily: 'Syne_700Bold', fontSize: 20, color: colors.textPrimary, textTransform: 'capitalize' },
  selectedDayLabel: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: colors.textSecondary, marginTop: 2, textTransform: 'capitalize' },
  monthNavButtons: { flexDirection: 'row', gap: spacing.xs },
  navBtn: {
    width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.carbon,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center',
  },
  navBtnToday: { backgroundColor: 'rgba(232,160,32,0.15)', borderColor: colors.amber },
  todayBtnText: { fontFamily: 'DMSans_600SemiBold', fontSize: 10, color: colors.textSecondary },
  todayBtnTextActive: { color: colors.amber },
  weekStrip: { gap: spacing.xs, paddingBottom: spacing.sm },
  dayCard: {
    width: 50, height: 68, borderRadius: radius.lg, backgroundColor: colors.carbon,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  dayCardSelected: { backgroundColor: colors.amber, borderColor: colors.amber, ...shadows.amber },
  dayCardPast: { opacity: 0.5 },
  dayNameText: { fontFamily: 'DMSans_500Medium', fontSize: 9, letterSpacing: 0.5, marginBottom: 3 },
  dayNumText: { fontFamily: 'Syne_700Bold', fontSize: 17 },
  textPrimary: { color: colors.textPrimary },
  textSecondary: { color: colors.textSecondary },
  textMuted: { color: colors.textMuted },
  textInk: { color: colors.ink },
  todayDot: { position: 'absolute', bottom: 6, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.amber },
  todayDotSelected: { backgroundColor: colors.ink },
  pendingDot: { position: 'absolute', top: 5, right: 5, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.pending },
  bookingDot: { position: 'absolute', top: 5, right: 5, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },

  loadingTimeline: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  loadingText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: colors.textMuted },

  timelineContent: { position: 'relative', marginHorizontal: spacing.lg, marginTop: spacing.md },
  timelineVerticalLine: { position: 'absolute', left: TIMELINE_LEFT - 8, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  hourRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', height: HOUR_HEIGHT },
  hourLabel: { fontFamily: 'DMSans_700Bold', fontSize: 10, color: colors.textMuted, width: TIMELINE_LEFT - 12, textAlign: 'right', marginRight: 10, marginTop: -7 },
  hourLineRule: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.04)' },

  nowLine: { position: 'absolute', left: TIMELINE_LEFT - 12, right: 0, flexDirection: 'row', alignItems: 'center', zIndex: 10 },
  nowDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error, marginRight: 4 },
  nowLineRule: { flex: 1, height: 2, backgroundColor: colors.error, opacity: 0.6 },

  reservationBlock: {
    position: 'absolute', borderRadius: radius.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderLeftWidth: 3,
    paddingHorizontal: 8, paddingVertical: 6, overflow: 'hidden',
  },
  blockClientText: { fontFamily: 'Syne_600SemiBold', fontSize: 12, color: colors.textPrimary, marginBottom: 1 },
  blockServiceText: { fontFamily: 'DMSans_400Regular', fontSize: 10, color: colors.textSecondary, marginBottom: 1 },
  blockTimeText: { fontFamily: 'DMSans_700Bold', fontSize: 9, color: colors.amber },
  quickConfirmBtn: {
    backgroundColor: colors.success, borderRadius: 8, width: 18, height: 18,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  quickCompleteBtn: {
    backgroundColor: '#8B5CF6', borderRadius: 8, width: 18, height: 18,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  walkInBadge: { backgroundColor: 'rgba(255,193,7,0.15)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  walkInBadgeText: { fontFamily: 'DMSans_500Medium', fontSize: 9, color: colors.amber },

  emptyTimelineCard: {
    position: 'absolute', left: TIMELINE_LEFT, right: 0, top: 80,
    backgroundColor: colors.carbon, borderRadius: radius.lg, padding: spacing.xl,
    alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
  },
  emptyTimelineText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: colors.textMuted },

  pendingSection: {
    marginHorizontal: spacing.lg, marginTop: spacing.xl,
    backgroundColor: colors.carbon, borderRadius: radius.xl, padding: spacing.lg,
    borderWidth: 1, borderColor: 'rgba(52,152,219,0.2)',
  },
  pendingSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  pendingSectionTitle: { fontFamily: 'Syne_700Bold', fontSize: 15, color: colors.textPrimary, flex: 1 },
  pendingCount: { backgroundColor: colors.pending, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  pendingCountText: { fontFamily: 'DMSans_700Bold', fontSize: 11, color: colors.ink },

  pendingCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  pendingDateBadge: { width: 44, height: 48, backgroundColor: 'rgba(52,152,219,0.12)', borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  pendingDateDay: { fontFamily: 'Syne_700Bold', fontSize: 18, color: colors.pending, lineHeight: 20 },
  pendingDateMonth: { fontFamily: 'DMSans_400Regular', fontSize: 10, color: colors.pending, textTransform: 'uppercase' },
  pendingCardCenter: { flex: 1 },
  pendingNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  pendingClientName: { fontFamily: 'Syne_600SemiBold', fontSize: 14, color: colors.textPrimary, flexShrink: 1 },
  pendingServiceText: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  pendingCardActions: { flexDirection: 'row', gap: spacing.sm },
  confirmBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', alignItems: 'center', justifyContent: 'center' },

  fabButton: {
    position: 'absolute', bottom: 24, right: 20,
    backgroundColor: colors.amber, width: 58, height: 58,
    borderRadius: radius.full, alignItems: 'center', justifyContent: 'center',
    ...shadows.amber, zIndex: 40,
  },
});
