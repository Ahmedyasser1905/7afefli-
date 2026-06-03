// apps/mobile/src/components/booking/SlotPicker.tsx
// Core booking component — renders the time slot grid with state-aware styling

import React, { useMemo } from 'react';
import { FlatList, TouchableOpacity, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { useAvailableSlots } from '../../hooks/booking/useAvailableSlots';
import { useSlotLock } from '../../hooks/booking/useSlotLock';
import { colors, spacing, radius, shadows } from '../../theme';
import Ionicons from "@react-native-vector-icons/ionicons";

interface SlotPickerProps {
  salonId: string;
  serviceId: string;
  date: string;
  staffId?: string;
  openTime: string;
  closeTime: string;
  durationMin: number;
  onConfirm: (slot: { startTime: string; endTime: string }) => void;
  onSlotSelect?: (slot: { startTime: string; endTime: string } | null) => void;
}

type SlotState = 'available' | 'booked' | 'selected' | 'locked';

export function SlotPicker({
  salonId,
  serviceId,
  date,
  staffId,
  openTime,
  closeTime,
  durationMin,
  onConfirm,
  onSlotSelect,
}: SlotPickerProps) {
  const {
    data: slots = [],
    isLoading,
    isRefetching,
  } = useAvailableSlots({
    salonId,
    serviceId,
    date,
    staffId,
    openTime,
    closeTime,
    durationMin,
  });

  const {
    lockSlot,
    releaseLock,
    isSlotLocked,
    isSlotLockedByMe,
    getLockSecondsLeft,
    activeLockedSlot,
  } = useSlotLock();

  const handleSlotPress = (slot: {
    startTime: string;
    endTime: string;
    isAvailable: boolean;
  }) => {
    if (!slot.isAvailable) return;

    if (isSlotLockedByMe(slot.startTime)) {
      // Tapping own locked slot → deselect
      releaseLock(slot.startTime);
      onSlotSelect?.(null);
    } else {
      // Release any previously locked slot first
      if (activeLockedSlot) releaseLock(activeLockedSlot);
      // Lock the new slot for 5 minutes
      lockSlot(slot.startTime);
      onSlotSelect?.({ startTime: slot.startTime, endTime: slot.endTime });
    }
  };

  const selectedSlot = useMemo(
    () => slots.find((s) => isSlotLockedByMe(s.startTime)),
    [slots, activeLockedSlot],
  );

  const getSlotState = (slot: {
    startTime: string;
    isAvailable: boolean;
  }): SlotState => {
    if (!slot.isAvailable) return 'booked';
    if (isSlotLockedByMe(slot.startTime)) return 'selected';
    if (isSlotLocked(slot.startTime)) return 'locked';
    return 'available';
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.amber} size="large" />
      </View>
    );
  }

  // Segment slots into Morning and Afternoon for premium layout grouping
  const morningSlots = slots.filter((s) => parseInt(s.startTime.split(':')[0]) < 12);
  const afternoonSlots = slots.filter((s) => parseInt(s.startTime.split(':')[0]) >= 12);

  const renderSlotItem = ({ item }: { item: typeof slots[0] }) => {
    const state = getSlotState(item);
    const secondsLeft = getLockSecondsLeft(item.startTime);

    return (
      <TouchableOpacity
        style={[
          styles.slotCell,
          state === 'available' && styles.slotAvailable,
          state === 'booked' && styles.slotBooked,
          state === 'selected' && styles.slotSelected,
          state === 'locked' && styles.slotLocked,
        ]}
        onPress={() => handleSlotPress(item)}
        disabled={state === 'booked'}
        activeOpacity={0.8}
      >
        {state === 'locked' ? (
          <View style={styles.lockedCellContent}>
            <View style={styles.lockedTimeRow}>
              <Ionicons name="lock-closed" size={10} color={colors.warning} />
              <Text style={styles.lockedTimeText}>{item.startTime}</Text>
            </View>
            <Text style={styles.lockCountdownText}>Held {Math.max(0, Math.floor(secondsLeft / 60))}:{String(secondsLeft % 60).padStart(2, '0')}</Text>
          </View>
        ) : (
          <>
            <Text
              style={[
                styles.slotTime,
                state === 'available' && styles.slotTimeAvailable,
                state === 'booked' && styles.slotTimeBooked,
                state === 'selected' && styles.slotTimeSelected,
              ]}
            >
              {item.startTime}
            </Text>
            {state === 'selected' && <Text style={styles.selectedTag}>Selected</Text>}
            {state === 'booked' && <Ionicons name="close" size={12} color={colors.textMuted} style={styles.bookedIcon} />}
          </>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {isRefetching && (
        <View style={styles.refetchBar}>
          <Text style={styles.refetchText}>Mise à jour des créneaux...</Text>
        </View>
      )}

      {/* Morning Grid */}
      {morningSlots.length > 0 && (
        <View style={styles.gridSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="sunny-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.sectionTitle}>Matinée</Text>
          </View>
          <FlatList
            data={morningSlots}
            numColumns={3}
            keyExtractor={(item) => item.startTime}
            renderItem={renderSlotItem}
            scrollEnabled={false}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      )}

      {/* Afternoon Grid */}
      {afternoonSlots.length > 0 && (
        <View style={styles.gridSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="partly-sunny-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.sectionTitle}>Après-midi</Text>
          </View>
          <FlatList
            data={afternoonSlots}
            numColumns={3}
            keyExtractor={(item) => item.startTime}
            renderItem={renderSlotItem}
            scrollEnabled={false}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      )}

      {/* Empty state — no slots at all */}
      {!isLoading && slots.length === 0 && (
        <View style={styles.emptySlots}>
          <Ionicons name="calendar-outline" size={40} color={colors.textMuted} />
          <Text style={styles.emptySlotsTitle}>Aucun créneau disponible</Text>
          <Text style={styles.emptySlotsSubtitle}>
            Ce salon est fermé ce jour ou tous les créneaux sont réservés.{'\n'}
            Essayez une autre date.
          </Text>
        </View>
      )}

      {/* All-booked state — slots exist but none available */}
      {!isLoading && slots.length > 0 && slots.every(s => !s.isAvailable) && (
        <View style={styles.emptySlots}>
          <Ionicons name="time-outline" size={40} color={colors.textMuted} />
          <Text style={styles.emptySlotsTitle}>Tous les créneaux sont pris</Text>
          <Text style={styles.emptySlotsSubtitle}>
            Il ne reste plus de place pour ce jour.{'\n'}
            Choisissez une autre date.
          </Text>
        </View>
      )}

      {/* Booking Legend */}

      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.amber }]} />
          <Text style={styles.legendLabel}>Sélectionné</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.slotAvailable, borderColor: colors.success, borderWidth: 1 }]} />
          <Text style={styles.legendLabel}>Disponible</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.carbon }]} />
          <Text style={styles.legendLabel}>Réservé</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
          <Text style={styles.legendLabel}>Verrouillé</Text>
        </View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 160,
  },
  loadingContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refetchBar: {
    backgroundColor: 'rgba(232, 160, 32, 0.1)',
    paddingVertical: 6,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  refetchText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.amber,
  },
  gridSection: {
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  slotCell: {
    flex: 1,
    height: 52,
    margin: 4,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  slotAvailable: {
    backgroundColor: '#1E3A2A',
    borderColor: 'rgba(46, 204, 113, 0.2)',
  },
  slotBooked: {
    backgroundColor: colors.carbon,
    opacity: 0.35,
  },
  slotSelected: {
    backgroundColor: colors.amber,
    borderColor: colors.amber,
    ...shadows.amber,
  },
  slotLocked: {
    backgroundColor: colors.slotLocked,
    borderColor: colors.warning,
  },
  slotTime: {
    fontFamily: 'Syne_700Bold',
    fontSize: 15,
  },
  slotTimeAvailable: {
    color: colors.success,
  },
  slotTimeBooked: {
    color: colors.textMuted,
  },
  slotTimeSelected: {
    color: colors.ink,
  },
  selectedTag: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 8,
    color: colors.ink,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  bookedIcon: {
    marginTop: 2,
  },
  lockedCellContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  lockedTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lockedTimeText: {
    fontFamily: 'Syne_700Bold',
    fontSize: 13,
    color: colors.warning,
  },
  lockCountdownText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 8,
    color: colors.warning,
    opacity: 0.8,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
  },
  legendLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  confirmBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.amber,
    ...shadows.amber,
  },
  confirmInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  confirmTime: {
    fontFamily: 'Syne_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  confirmLock: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    color: colors.warning,
    marginTop: 2,
  },
  confirmBtn: {
    backgroundColor: colors.amber,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  confirmBtnText: {
    fontFamily: 'Syne_600SemiBold',
    fontSize: 13,
    color: colors.ink,
  },
  emptySlots: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  emptySlotsTitle: {
    fontFamily: 'Syne_600SemiBold',
    fontSize: 16,
    color: colors.textPrimary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  emptySlotsSubtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
    lineHeight: 20,
  },
});
