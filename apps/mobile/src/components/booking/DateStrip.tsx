// apps/mobile/src/components/booking/DateStrip.tsx
// Horizontal 14-day date selector

import React from 'react';
import { ScrollView, TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { colors, spacing, radius, shadows } from '../../theme';
import { getNextDays, getDayNameShort, getDayNumber, today } from '@barberdz/shared/utils/formatters';

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
        const dayName = getDayNameShort(dateStr).toUpperCase();
        const dayNum = getDayNumber(dateStr);

        return (
          <TouchableOpacity
            key={dateStr}
            style={[
              styles.dateCell,
              isSelected && styles.dateCellSelected,
              isToday && !isSelected && styles.dateCellToday,
            ]}
            onPress={() => onDateSelect(dateStr)}
            activeOpacity={0.8}
            accessibilityLabel={`${dayName} ${dayNum}`}
            accessibilityState={{ selected: isSelected }}
          >
            <Text
              style={[
                styles.dayName,
                isSelected ? styles.dayNameSelected : styles.dayNameUnselected,
              ]}
            >
              {dayName}
            </Text>
            <Text
              style={[
                styles.dayNum,
                isSelected ? styles.dayNumSelected : styles.dayNumUnselected,
              ]}
            >
              {dayNum}
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  dateCell: {
    width: 64,
    height: 80,
    borderRadius: radius.lg,
    backgroundColor: colors.carbon,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  dateCellSelected: {
    backgroundColor: colors.amber,
    borderColor: colors.amber,
    ...shadows.amber,
  },
  dateCellToday: {
    borderColor: colors.amber,
    borderWidth: 1.5,
  },
  dayName: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  dayNameUnselected: {
    color: colors.textSecondary,
  },
  dayNameSelected: {
    color: colors.ink,
    fontFamily: 'DMSans_700Bold',
  },
  dayNum: {
    fontFamily: 'Syne_700Bold',
    fontSize: 20,
  },
  dayNumUnselected: {
    color: colors.textPrimary,
  },
  dayNumSelected: {
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
});
