import Toast from 'react-native-toast-message';
// apps/mobile/src/screens/auth/PhoneEntryScreen.tsx
// Shown after login if user has no phone number in profile

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { colors, typography, spacing, radius, shadows } from '../../theme';
import Ionicons from "@react-native-vector-icons/ionicons";
import { useTranslations } from '../../hooks/useTranslations';

// Algeria flag displayed as emoji instead of external image
const ALGERIA_FLAG_EMOJI = '🇩🇿';

export default function PhoneEntryScreen() {
  const { t, isRTL } = useTranslations();
  const user = useAuthStore((s) => s.user);
  const setNeedsPhone = useAuthStore((s) => s.setNeedsPhone);
  const [phone, setPhone] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!phone.trim() || phone.trim().length < 9) {
      const msg = t('auth.invalid_phone');
      setErrorMsg(msg);
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: msg
      });
      return;
    }

    setErrorMsg(null);
    setIsLoading(true);

    // Normalize phone number
    let formattedPhone = phone.trim();
    if (!formattedPhone.startsWith('+')) {
      if (formattedPhone.startsWith('0')) {
        formattedPhone = formattedPhone.substring(1);
      }
      formattedPhone = `+213${formattedPhone}`;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ phone_number: formattedPhone })
        .eq('id', user?.id);

      if (error) {
        console.warn('[PhoneEntry] Failed to save phone:', error);
      }

      // Mark phone as done — navigate to main app
      setNeedsPhone(false);
    } catch (err: unknown) {
      console.error(err);
      // Still proceed even if save fails
      setNeedsPhone(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    setNeedsPhone(false);
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <View style={styles.headerBar}>
          <Text style={styles.headerLogo}>7afefli</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="call" size={40} color={colors.amber} />
            </View>
          </View>

          <View style={styles.headlineContainer}>
            <Text style={[styles.headlineTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{t('auth.phone_entry_title')}</Text>
            <Text style={[styles.headlineSubtitle, { textAlign: isRTL ? 'right' : 'left' }]}>
              {t('auth.phone_entry_sub')}
            </Text>
          </View>

          {errorMsg && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={20} color={colors.error} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          <View style={styles.form}>
            <View style={styles.phoneInputCard}>
              <View style={styles.countryCodeContainer}>
                <Text style={styles.flagEmoji}>{ALGERIA_FLAG_EMOJI}</Text>
                <Text style={styles.countryCodeText}>+213</Text>
              </View>
              <TextInput
                style={[styles.phoneInput, { textAlign: isRTL ? 'right' : 'left' }]}
                placeholder="5 50 12 34 56"
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                editable={!isLoading}
                maxLength={10}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>{t('auth.continue')}</Text>
                  <Ionicons name="arrow-forward" size={18} color={colors.ink} style={{ marginLeft: spacing.sm }} />
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkip}
              disabled={isLoading}
            >
              <Text style={styles.skipButtonText}>{t('auth.skip_step')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  keyboardContainer: {
    flex: 1,
  },
  headerBar: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    backgroundColor: colors.ink,
  },
  headerLogo: {
    fontFamily: 'Syne_700Bold',
    fontSize: 20,
    color: colors.amber,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(232, 160, 32, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(232, 160, 32, 0.2)',
  },
  headlineContainer: {
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  headlineTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 24,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  headlineSubtitle: {
    ...typography.bodyMd,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3E1C1A',
    borderColor: colors.error,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    ...typography.bodySm,
    color: '#FF8A80',
    marginLeft: spacing.sm,
    flex: 1,
  },
  form: {
    width: '100%',
  },
  phoneInputCard: {
    flexDirection: 'row',
    backgroundColor: colors.carbon,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    height: 56,
  },
  countryCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.graphite,
    paddingHorizontal: spacing.md,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.05)',
    gap: spacing.sm,
  },
  flagEmoji: {
    fontSize: 20,
    lineHeight: 24,
  },
  countryCodeText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 16,
    color: colors.textPrimary,
  },
  phoneInput: {
    flex: 1,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
  },
  submitButton: {
    backgroundColor: colors.amber,
    borderRadius: radius.md,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: spacing.xl,
    ...shadows.amber,
  },
  submitButtonText: {
    fontFamily: 'Syne_600SemiBold',
    color: colors.ink,
    fontSize: 16,
  },
  disabledButton: {
    backgroundColor: colors.amberDim,
    opacity: 0.6,
  },
  skipButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  skipButtonText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
});
