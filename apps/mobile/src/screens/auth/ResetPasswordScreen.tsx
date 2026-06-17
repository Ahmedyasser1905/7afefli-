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

export default function ResetPasswordScreen({ navigation }: any) {
  const { t, isRTL } = useTranslations();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const setNeedsPasswordReset = useAuthStore(s => s.setNeedsPasswordReset);

  const handleSubmit = async () => {
    if (!password || !confirmPassword) {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('auth.fill_both_fields')
      });
      return;
    }

    if (password.length < 6) {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('auth.password_too_short')
      });
      return;
    }

    if (password !== confirmPassword) {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('auth.passwords_mismatch')
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        throw error;
      }
      
      Toast.show({
        type: 'success',
        text1: t('common.success'),
        text2: t('auth.password_reset_ok')
      });
      
      // Débloque l'AppNavigator pour laisser passer l'utilisateur vers ClientApp/BarberApp/AdminApp
      setNeedsPasswordReset(false);
      
    } catch (err: unknown) {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: (err as any)?.message || t('auth.generic_error')
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
          <TouchableOpacity onPress={() => { if (navigation.canGoBack()) { navigation.goBack(); } }} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerLogo}>7afefli</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.iconContainer}>
            <View style={styles.iconWrap}>
              <Ionicons name="key-outline" size={48} color={colors.amber} />
            </View>
          </View>

          <View style={styles.headlineContainer}>
            <Text style={styles.headlineTitle}>{t('auth.new_password_title')}</Text>
            <Text style={styles.headlineSubtitle}>
              {t('auth.new_password_sub')}
            </Text>
          </View>

          <View style={styles.form}>
            {/* Password */}
            <View style={styles.inputFieldContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { textAlign: isRTL ? 'right' : 'left' }]}
                placeholder={t('auth.new_password_placeholder')}
                placeholderTextColor={colors.textSecondary}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                editable={!isLoading}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Confirm Password */}
            <View style={styles.inputFieldContainer}>
              <Ionicons name="lock-closed" size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { textAlign: isRTL ? 'right' : 'left' }]}
                placeholder={t('auth.confirm_password_placeholder')}
                placeholderTextColor={colors.textSecondary}
                secureTextEntry={!showPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!isLoading}
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
                  <Text style={styles.submitButtonText}>{t('common.save')}</Text>
                  <Ionicons name="checkmark" size={20} color={colors.ink} style={{ marginLeft: spacing.sm }} />
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
