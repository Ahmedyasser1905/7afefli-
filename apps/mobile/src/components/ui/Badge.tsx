// apps/mobile/src/components/ui/Badge.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius } from '../../theme';

type BadgeVariant =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'trial'
  | 'active'
  | 'expired'
  | 'sponsored';

interface BadgeProps {
  label: string;
  variant: BadgeVariant;
}

const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
  pending:    { bg: '#1A2A3D', text: colors.pending },
  confirmed:  { bg: '#1A3D2A', text: colors.success },
  cancelled:  { bg: '#3D1A1A', text: colors.error },
  completed:  { bg: '#2A2A2A', text: colors.textSecondary },
  trial:      { bg: '#3A2F00', text: colors.warning },
  active:     { bg: '#1A3D2A', text: colors.success },
  expired:    { bg: '#3D1A1A', text: colors.error },
  sponsored:  { bg: colors.amberDim, text: colors.amber },
};

export function Badge({ label, variant }: BadgeProps) {
  const { bg, text } = variantColors[variant];

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  label: {
    ...typography.caption,
    fontFamily: 'DMSans_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
