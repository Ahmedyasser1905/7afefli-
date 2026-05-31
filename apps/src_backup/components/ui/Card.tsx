// apps/mobile/src/components/ui/Card.tsx

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, spacing, shadows } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
  bordered?: boolean;
}

export function Card({ children, style, elevated = false, bordered = false }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        elevated && styles.elevated,
        bordered && styles.bordered,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  elevated: {
    backgroundColor: colors.graphite,
    ...shadows.md,
  },
  bordered: {
    borderWidth: 1,
    borderColor: colors.steel,
  },
});
