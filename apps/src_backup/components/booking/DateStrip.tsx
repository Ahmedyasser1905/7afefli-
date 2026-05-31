// apps/mobile/src/components/booking/DateStrip.tsx
// Horizontal 14-day date selector

import React from 'react';
import { ScrollView, TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius } from '../../theme';
import { getNextDays, getDayNameShort, getDayNumber, today } from '../../../../packages/shared/utils/formatters';

interface DateStripProps {
  selectedDate: string | null;
  onDateSelect: (date: string) => void;
  daysCount?: number;
}

export function DateStrip({ selectedDate, onDateSelect, daysCount = 14 }: DateStripProps) {
  const dates = getNextDays(daysCount);
  const todayStr = today();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {dates.map((dateStr) => {
        const isSelected = dateStr === selectedDate;
        const isToday = dateStr === todayStr;

        return (
          <TouchableOpacity
            key={dateStr}
            style={[
              styles.dateCell,
              isSelected && styles.dateCellSelected,
              isToday && !isSelected && styles.dateCellToday,
            ]}
            onPress={() => onDateSelect(dateStr)}
            activeOpacity={0.7}
            accessibilityLabel={`${getDayNameShort(dateStr)} ${getDayNumber(dateStr)}`}
            accessibilityState={{ selected: isSelected }}
          >
            <Text
              style={[
                styles.dayName,
                isSelected && styles.dayNameSelected,
              ]}
            >
              {getDayNameShort(dateStr)}
            </Text>
            <Text
              style={[
                styles.dayNum,
                isSelected && styles.dayNumSelected,
              ]}
            >
              {getDayNumber(dateStr)}
            </Text>
            {isToday && (
              <View style={[styles.todayDot, isSelected && styles.todayDotSelected]} />
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  dateCell: {
    width: 52,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.graphite,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  dateCellSelected: {
    backgroundColor: colors.amber,
  },
  dateCellToday: {
    borderWidth: 1,
    borderColor: colors.amber,
  },
  dayName: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  dayNameSelected: {
    color: colors.ink,
  },
  dayNum: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 18,
    color: colors.textPrimary,
  },
  dayNumSelected: {
    color: colors.ink,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.amber,
  },
  todayDotSelected: {
    backgroundColor: colors.ink,
  },
});
