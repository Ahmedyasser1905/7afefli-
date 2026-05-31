// apps/mobile/src/components/booking/SlotPicker.tsx
// Core booking component — renders the time slot grid with state-aware styling

import React, { useMemo } from 'react';
import { FlatList, TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { useAvailableSlots } from '../../hooks/booking/useAvailableSlots';
import { useSlotLock } from '../../hooks/booking/useSlotLock';
import { colors, typography, spacing, radius } from '../../theme';

interface SlotPickerProps {
  salonId: string;
  serviceId: string;
  date: string;
  barberId?: string;
  openTime: string;
  closeTime: string;
  durationMin: number;
  onConfirm: (slot: { startTime: string; endTime: string }) => void;
}

type SlotState = 'available' | 'booked' | 'selected' | 'locked';

export function SlotPicker({
  salonId,
  serviceId,
  date,
  barberId,
  openTime,
  closeTime,
  durationMin,
  onConfirm,
}: SlotPickerProps) {
  const {
    data: slots = [],
    isLoading,
    isRefetching,
  } = useAvailableSlots({
    salonId,
    serviceId,
    date,
    barberId,
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
    } else {
      // Release any previously locked slot first
      if (activeLockedSlot) releaseLock(activeLockedSlot);
      // Lock the new slot for 5 minutes
      lockSlot(slot.startTime);
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

  const slotStateStyles: Record<SlotState, object> = {
    available: styles.slotAvailable,
    booked: styles.slotBooked,
    selected: styles.slotSelected,
    locked: styles.slotLocked,
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        {Array.from({ length: 9 }).map((_, i) => (
          <View key={i} style={styles.skeleton} />
        ))}
      </View>
    );
  }

  return (
    <View>
      {isRefetching && (
        <View style={styles.refetchBar}>
          <Text style={styles.refetchText}>Mise à jour des créneaux...</Text>
        </View>
      )}

      <FlatList
        data={slots}
        numColumns={3}
        keyExtractor={(item) => item.startTime}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => {
          const state = getSlotState(item);
          return (
            <TouchableOpacity
              style={[styles.slot, slotStateStyles[state]]}
              onPress={() => handleSlotPress(item)}
              disabled={state === 'booked'}
              activeOpacity={0.75}
              accessibilityLabel={`Créneau ${item.startTime}${state === 'booked' ? ', réservé' : ''}`}
              accessibilityState={{ disabled: state === 'booked' }}
            >
              <Text
                style={[
                  styles.slotTime,
                  state === 'booked' && styles.slotTimeBooked,
                  state === 'selected' && styles.slotTimeSelected,
                ]}
              >
                {item.startTime}
              </Text>
              {state === 'booked' && <Text style={styles.bookedIcon}>✕</Text>}
              {state === 'selected' && <Text style={styles.selectedIcon}>✓</Text>}
            </TouchableOpacity>
          );
        }}
      />

      {/* Sticky confirmation bar — appears when a slot is locked */}
      {selectedSlot && (
        <View style={styles.confirmBar}>
          <View>
            <Text style={styles.confirmTime}>
              {selectedSlot.startTime} → {selectedSlot.endTime}
            </Text>
            <Text style={styles.confirmLock}>
              🔒 Réservé pour {getLockSecondsLeft(selectedSlot.startTime)}s
            </Text>
          </View>
          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={() => onConfirm(selectedSlot)}
            accessibilityRole="button"
            accessibilityLabel="Confirmer le créneau"
          >
            <Text style={styles.confirmBtnText}>Confirmer →</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    padding: spacing.md,
  },
  slot: {
    flex: 1,
    margin: spacing.xs,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 44,
    justifyContent: 'center',
  },
  slotAvailable: {
    backgroundColor: colors.slotAvailable,
  },
  slotBooked: {
    backgroundColor: colors.slotBooked,
    opacity: 0.5,
  },
  slotSelected: {
    backgroundColor: colors.slotSelected,
    borderColor: colors.amber,
  },
  slotLocked: {
    backgroundColor: colors.slotLocked,
    borderColor: colors.slotLockedBorder,
  },
  slotTime: {
    ...typography.label,
    color: colors.textPrimary,
  },
  slotTimeBooked: {
    color: colors.textMuted,
  },
  slotTimeSelected: {
    color: colors.ink,
    fontFamily: 'DMSans_700Bold',
  },
  bookedIcon: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  selectedIcon: {
    fontSize: 10,
    color: colors.ink,
    marginTop: 2,
  },
  confirmBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.graphite,
    borderRadius: radius.lg,
    padding: spacing.lg,
    margin: spacing.md,
    borderWidth: 1,
    borderColor: colors.amber,
  },
  confirmTime: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  confirmLock: {
    ...typography.caption,
    color: colors.warning,
    marginTop: 2,
  },
  confirmBtn: {
    backgroundColor: colors.amber,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  confirmBtnText: {
    ...typography.label,
    color: colors.ink,
    fontFamily: 'DMSans_700Bold',
  },
  loadingContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    gap: spacing.sm,
  },
  skeleton: {
    width: '30%',
    height: 44,
    backgroundColor: colors.graphite,
    borderRadius: radius.md,
  },
  refetchBar: {
    backgroundColor: colors.amberDim,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  refetchText: {
    ...typography.caption,
    color: colors.amber,
  },
});
