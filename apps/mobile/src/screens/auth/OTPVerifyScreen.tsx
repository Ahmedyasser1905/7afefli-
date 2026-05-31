import React, { useState, useEffect, useRef } from 'react';
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

export default function OTPVerifyScreen({ route, navigation }: any) {
  const { phone, fullName, role } = route.params || { phone: '', fullName: '', role: '' };
  
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Resend code countdown timer
  const [countdown, setCountdown] = useState(60);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    startTimer();
    return () => stopTimer();
  }, []);

  const startTimer = () => {
    setCountdown(60);
    stopTimer();
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          stopTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleVerify = async () => {
    if (!code || code.trim().length !== 6) {
      const msg = 'Veuillez entrer un code de 6 chiffres';
      setErrorMsg(msg);
      Alert.alert('Erreur', msg);
      return;
    }

    setErrorMsg(null);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: phone,
        token: code.trim(),
        type: 'sms',
      });

      if (error) throw error;

      if (data.session) {
        // If registration info is passed, write or upsert the profile in Supabase
        if (fullName || role) {
          try {
            await supabase
              .from('profiles')
              .upsert({
                id: data.session.user.id,
                full_name: fullName || 'New User',
                role: role || 'Client',
                phone_number: phone,
              });
          } catch (upsertErr) {
            console.error('Error updating profile during verification:', upsertErr);
          }
        }

        // Fetch role from profiles table first
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.session.user.id)
          .single();

        // Update the Zustand store with session and role atomically
        useAuthStore.setState({
          session: data.session,
          user: data.session.user,
          role: profile?.role ?? role ?? 'Client',
          isLoading: false
        });
      }
    } catch (err: any) {
      console.error(err);
      const msg = err.message || 'Code incorrect ou expiré';
      setErrorMsg(msg);
      Alert.alert('Erreur de validation', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: phone,
      });

      if (error) throw error;
      
      startTimer();
      setCode('');
      setErrorMsg('Nouveau code envoyé par SMS');
      Alert.alert('Code envoyé', 'Un nouveau code de confirmation a été envoyé par SMS.');
    } catch (err: any) {
      console.error(err);
      const msg = err.message || 'Impossible de renvoyer le code';
      setErrorMsg(msg);
      Alert.alert('Erreur', msg);
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
        {/* Custom Header Bar */}
        <View style={styles.headerBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.amber} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Vérification</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          
          <View style={styles.headerContainer}>
            <View style={styles.iconContainer}>
              <Ionicons name="shield-checkmark-outline" size={40} color={colors.amber} />
            </View>
            <Text style={styles.title}>Code de validation</Text>
            <Text style={styles.subtitle}>
              Saisissez le code de 6 chiffres envoyé au {'\n'}
              <Text style={styles.phoneHighlight}>{phone}</Text>
            </Text>
          </View>

          <View style={styles.card}>
            {errorMsg && (
              <View style={[styles.messageBox, errorMsg.includes('envoyé') && styles.successBox]}>
                <Ionicons
                  name={errorMsg.includes('envoyé') ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                  size={20}
                  color={errorMsg.includes('envoyé') ? colors.success : colors.error}
                />
                <Text style={[styles.messageText, errorMsg.includes('envoyé') && styles.successText]}>
                  {errorMsg}
                </Text>
              </View>
            )}

            <View style={styles.form}>
              <Text style={styles.label}>Code de confirmation</Text>
              <TextInput
                style={styles.codeInput}
                placeholder="000000"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={setCode}
                editable={!isLoading}
                autoFocus
              />

              <TouchableOpacity
                style={[styles.submitButton, isLoading && styles.disabledButton]}
                onPress={handleVerify}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.ink} />
                ) : (
                  <>
                    <Text style={styles.submitButtonText}>Vérifier le code</Text>
                    <Ionicons name="checkmark" size={20} color={colors.ink} style={{ marginLeft: spacing.sm }} />
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.resendContainer}>
                {countdown > 0 ? (
                  <Text style={styles.countdownText}>
                    Renvoyer le code dans <Text style={{ color: colors.amber }}>{countdown}s</Text>
                  </Text>
                ) : (
                  <TouchableOpacity onPress={handleResend} disabled={isLoading}>
                    <Text style={styles.resendText}>Renvoyer le code par SMS</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 18,
    color: colors.textPrimary,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    justifyContent: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
    marginTop: spacing.md,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.carbon,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: spacing.md,
    ...shadows.amber,
  },
  title: {
    fontFamily: 'Syne_700Bold',
    fontSize: 24,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.bodyMd,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  phoneHighlight: {
    color: colors.amber,
    fontFamily: 'DMSans_700Bold',
  },
  card: {
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    ...shadows.lg,
  },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3E1C1A',
    borderColor: colors.error,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  messageText: {
    ...typography.bodySm,
    color: '#FF8A80',
    marginLeft: spacing.sm,
    flex: 1,
  },
  successBox: {
    backgroundColor: '#1E3524',
    borderColor: colors.success,
  },
  successText: {
    color: '#A5D6A7',
  },
  form: {
    width: '100%',
  },
  label: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  codeInput: {
    backgroundColor: colors.graphite,
    color: colors.textPrimary,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 28,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 10,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: spacing.xl,
  },
  submitButton: {
    backgroundColor: colors.amber,
    borderRadius: radius.md,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
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
  resendContainer: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  countdownText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
  },
  resendText: {
    ...typography.label,
    color: colors.amber,
    fontFamily: 'DMSans_700Bold',
  },
});
