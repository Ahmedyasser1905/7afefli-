// apps/mobile/src/components/auth/PhoneInputForm.tsx
// Shared phone number entry UI for PhoneInputScreen (login) and PhoneEntryScreen (post-signup).
// DRY-2 fix: extracted from duplicate code in both auth screens.

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing } from '../../theme';

interface PhoneInputFormProps {
  mode: 'login' | 'post-signup';
  onSubmit: (phone: string) => void | Promise<void>;
  title: string;
  subtitle?: string;
  isLoading?: boolean;
  error?: string | null;
}

export function PhoneInputForm({
  mode,
  onSubmit,
  title,
  subtitle,
  isLoading,
  error,
}: PhoneInputFormProps) {
  const [phone, setPhone] = useState('');

  const handleSubmit = async () => {
    const cleaned = phone.trim();
    if (!cleaned || cleaned.length < 9) return;
    await onSubmit(cleaned);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="+213 6XX XXX XXX"
        placeholderTextColor={colors.textMuted}
        keyboardType="phone-pad"
        autoFocus
        accessibilityLabel="Numéro de téléphone"
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isLoading}
        accessibilityRole="button"
        activeOpacity={0.8}
      >
        {isLoading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.buttonText}>
            {mode === 'login' ? 'Envoyer le code' : 'Confirmer'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    backgroundColor: colors.ink,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.steel,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 18,
    color: colors.textPrimary,
    backgroundColor: colors.carbon,
    marginBottom: spacing.md,
  },
  button: {
    backgroundColor: colors.amber,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  error: {
    color: colors.error,
    marginBottom: spacing.md,
    fontSize: 14,
  },
});
