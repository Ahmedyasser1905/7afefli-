import Toast from 'react-native-toast-message';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, shadows } from '../../theme';
import Ionicons from '@react-native-vector-icons/ionicons';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useTranslations } from '../../hooks/useTranslations';

export default function ForgotPasswordScreen({ navigation }: { navigation: Record<string, unknown> }) {
  const { t, isRTL } = useTranslations();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const setNeedsPasswordReset = useAuthStore(s => s.setNeedsPasswordReset);

  const handleSendOtp = async () => {
    if (!email.trim()) {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('auth.enter_email')
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) {
        throw error;
      }
      
      setNeedsPasswordReset(true);
      
      Toast.show({
        type: 'success',
        text1: t('auth.email_sent'),
        text2: t('auth.check_inbox_otp')
      });
      
      (navigation as any).navigate('VerifyCode', { email: email.trim() });
    } catch (err: unknown) {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: (err as any)?.message || t('auth.error_check_email')
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => { if ((navigation as any).canGoBack()) { (navigation as any).goBack(); } }} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerLogo}>7afefli</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.iconContainer}>
            <View style={styles.iconWrap}>
              <Ionicons name="lock-closed" size={48} color={colors.amber} />
            </View>
          </View>

          <View style={styles.headlineContainer}>
            <Text style={styles.headlineTitle}>{t('auth.forgot_password_title')}</Text>
            <Text style={styles.headlineSubtitle}>
              {t('auth.forgot_password_sub')}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputFieldContainer}>
              <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { textAlign: isRTL ? 'right' : 'left' }]}
                placeholder={t('auth.email_placeholder')}
                placeholderTextColor={colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                editable={!isLoading}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.disabledButton]}
              onPress={handleSendOtp}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>{t('auth.receive_otp')}</Text>
                  <Ionicons name="send-outline" size={18} color={colors.ink} style={{ marginLeft: spacing.sm }} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: { flex: 1, backgroundColor: colors.ink },
  keyboardContainer: { flex: 1 },
  headerBar: {
    height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
    backgroundColor: colors.ink,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerLogo: { fontFamily: 'Syne_700Bold', fontSize: 20, color: colors.amber },
  scrollContainer: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  iconContainer: { alignItems: 'center', marginTop: spacing.xxl, marginBottom: spacing.xl },
  iconWrap: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(232,160,32,0.12)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(232,160,32,0.25)',
  },
  headlineContainer: { marginBottom: spacing.xl, alignItems: 'center' },
  headlineTitle: { fontFamily: 'Syne_700Bold', fontSize: 24, color: colors.textPrimary, textAlign: 'center' },
  headlineSubtitle: {
    fontFamily: 'DMSans_400Regular', fontSize: 14, color: colors.textSecondary,
    marginTop: spacing.sm, textAlign: 'center', lineHeight: 20, paddingHorizontal: spacing.lg,
  },
  form: { width: '100%', gap: spacing.lg },
  inputFieldContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.carbon,
    borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    height: 56, paddingHorizontal: spacing.md,
  },
  inputIcon: { marginRight: spacing.sm },
  input: { flex: 1, color: colors.textPrimary, fontSize: 15, fontFamily: 'DMSans_400Regular' },
  submitButton: {
    backgroundColor: colors.amber, borderRadius: radius.md, height: 56,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', ...shadows.amber,
  },
  submitButtonText: { fontFamily: 'Syne_600SemiBold', color: colors.ink, fontSize: 16 },
  disabledButton: { backgroundColor: colors.amberDim, opacity: 0.6 },
});
