// apps/mobile/src/components/ui/Button.tsx

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, typography, spacing, radius } from '../../theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  style,
}: ButtonProps) {
  const variantStyles = variants[variant];

  return (
    <TouchableOpacity
      style={[
        styles.base,
        variantStyles.container,
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.ink : colors.amber}
          size="small"
        />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, variantStyles.text, disabled && styles.disabledText]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    minHeight: 48,
  },
  text: {
    ...typography.label,
    fontFamily: 'DMSans_700Bold',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  disabledText: {
    color: colors.textMuted,
  },
});

const variants: Record<ButtonVariant, { container: ViewStyle; text: TextStyle }> = {
  primary: {
    container: { backgroundColor: colors.amber },
    text: { color: colors.ink },
  },
  secondary: {
    container: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: colors.amber,
    },
    text: { color: colors.amber },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    text: { color: colors.textPrimary },
  },
  destructive: {
    container: { backgroundColor: colors.error },
    text: { color: '#FFFFFF' },
  },
};
