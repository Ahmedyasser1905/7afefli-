// apps/mobile/src/components/booking/ServiceCard.tsx

import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius } from '../../theme';
import { formatDZD, formatDuration } from '@barberdz/shared/utils/formatters';
import type { Service } from '@barberdz/shared/types';

interface ServiceCardProps {
  service: Service;
  isSelected: boolean;
  onSelect: (service: Service) => void;
}

export function ServiceCard({ service, isSelected, onSelect }: ServiceCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.cardSelected]}
      onPress={() => onSelect(service)}
      activeOpacity={0.7}
      accessibilityLabel={`${service.service_name}, ${formatDZD(service.price)}, ${formatDuration(service.duration_minutes)}`}
      accessibilityState={{ selected: isSelected }}
    >
      <View style={styles.left}>
        <Text style={[styles.name, isSelected && styles.nameSelected]}>
          {service.service_name}
        </Text>
        {service.description && (
          <Text style={styles.description} numberOfLines={1}>
            {service.description}
          </Text>
        )}
      </View>
      <View style={styles.right}>
        <Text style={[styles.price, isSelected && styles.priceSelected]}>
          {formatDZD(service.price)}
        </Text>
        <View style={[styles.durationBadge, isSelected && styles.durationBadgeSelected]}>
          <Text style={[styles.duration, isSelected && styles.durationSelected]}>
            {formatDuration(service.duration_minutes)}
          </Text>
        </View>
      </View>
      {isSelected && <View style={styles.selectedDot} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.graphite,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: colors.amber,
    backgroundColor: '#1A1800',
  },
  left: {
    flex: 1,
    marginRight: spacing.md,
  },
  name: {
    ...typography.bodyMd,
    color: colors.textPrimary,
    fontFamily: 'DMSans_500Medium',
  },
  nameSelected: {
    color: colors.amber,
  },
  description: {
    ...typography.bodySm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  right: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  price: {
    ...typography.bodyMd,
    color: colors.textPrimary,
    fontFamily: 'DMSans_700Bold',
  },
  priceSelected: {
    color: colors.amber,
  },
  durationBadge: {
    backgroundColor: colors.steel,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  durationBadgeSelected: {
    backgroundColor: colors.amberDim,
  },
  duration: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  durationSelected: {
    color: colors.amber,
  },
  selectedDot: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.amber,
  },
});
