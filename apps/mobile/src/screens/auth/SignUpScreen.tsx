// @ts-nocheck
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
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { colors, typography, spacing, radius, shadows } from '../../theme';
import Ionicons from "@react-native-vector-icons/ionicons";
import type { UserRole } from '@barberdz/shared/types';

const INTERIOR_IMAGE = require('../../../assets/splash.png');
// Algeria flag displayed as emoji instead of external image
const ALGERIA_FLAG_EMOJI = '🇩🇿';

export default function SignUpScreen({ navigation }: { navigation: Record<string, unknown> }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('Client');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignUp = async () => {
    if (!fullName.trim() || !email.trim() || !password) {
      const msg = 'Veuillez remplir le nom, l\'email et le mot de passe';
      setErrorMsg(msg);
      Toast.show({
        type: 'error',
        text1: `Erreur`,
        text2: msg
      });
      return;
    }

    if (password.length < 6) {
      const msg = 'Le mot de passe doit contenir au moins 6 caractères';
      setErrorMsg(msg);
      Toast.show({
        type: 'error',
        text1: `Erreur`,
        text2: msg
      });
      return;
    }

    // Normalize phone number if provided
    let formattedPhone: string | null = null;
    if (phone.trim().length > 0) {
      if (phone.trim().length < 9) {
        const msg = 'Veuillez entrer un numéro de téléphone valide (min 9 chiffres)';
        setErrorMsg(msg);
        Toast.show({
        type: 'error',
        text1: `Erreur`,
        text2: msg
      });
        return;
      }
      formattedPhone = phone.trim();
      if (!formattedPhone.startsWith('+')) {
        if (formattedPhone.startsWith('0')) {
          formattedPhone = formattedPhone.substring(1);
        }
        formattedPhone = `+213${formattedPhone}`;
      }
    }

    setErrorMsg(null);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: role,
          },
        },
      });

      if (error) throw error;

      if (data.session) {
        // Save phone number to profile if provided
        if (formattedPhone) {
          try {
            await supabase
              .from('profiles')
              .update({ phone_number: formattedPhone })
              .eq('id', data.session.user.id);
          } catch (phoneErr) {
            console.warn('[SignUp] Failed to save phone:', phoneErr);
          }
        }

        // Auto-login on sign-up
        useAuthStore.setState({
          session: data.session,
          user: data.session.user,
          role: role,
          needsPhone: !formattedPhone,
          isLoading: false,
        });
        Toast.show({
        type: 'success',
        text1: `Succès`,
        text2: 'Votre compte a été créé avec succès.'
      });
      } else {
        Alert.alert(
          'Inscription réussie',
          'Veuillez vérifier votre boîte de réception pour confirmer votre adresse e-mail.',
          [{ text: 'OK', onPress: () => navigation.navigate('PhoneInput') }]
        );
      }
    } catch (err: unknown) {
      console.error(err);
      const msg = err.message || 'Une erreur est survenue lors de l\'inscription';
      setErrorMsg(msg);
      Toast.show({
        type: 'error',
        text1: `Erreur d\'inscription`,
        text2: msg
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
        {/* Custom Header Bar */}
        <View style={styles.headerBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => { if (navigation.canGoBack()) { navigation.goBack(); } }}>
            <Ionicons name="arrow-back" size={24} color={colors.amber} />
          </TouchableOpacity>
          <Text style={styles.headerLogo}>Créer un compte</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          
          {/* Top Illustration Card */}
          <View style={styles.illustrationContainer}>
            <Image
              source={INTERIOR_IMAGE}
              style={styles.illustrationImage}
              resizeMode="cover"
            />
            <View style={styles.gradientOverlay} />
          </View>

          {/* Headline Section */}
          <View style={styles.headlineContainer}>
            <Text style={styles.headlineTitle}>Inscrivez-vous</Text>
            <Text style={styles.headlineSubtitle}>Rejoignez 7afefli pour réserver en ligne.</Text>
          </View>

          {errorMsg && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={20} color={colors.error} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          <View style={styles.form}>
            {/* Full Name */}
            <View style={styles.inputFieldContainer}>
              <Ionicons name="person-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Nom complet"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="words"
                value={fullName}
                onChangeText={setFullName}
                editable={!isLoading}
              />
            </View>

            {/* Email */}
            <View style={[styles.inputFieldContainer, { marginTop: spacing.md }]}>
              <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Adresse e-mail"
                placeholderTextColor={colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                editable={!isLoading}
              />
            </View>

            {/* Password */}
            <View style={[styles.inputFieldContainer, { marginTop: spacing.md }]}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Mot de passe (min 6 caractères)"
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

            {/* Phone Number */}
            <Text style={styles.phoneLabel}>Numéro de téléphone</Text>
            <View style={styles.phoneInputCard}>
              <View style={styles.countryCodeContainer}>
                <Text style={styles.flagEmoji}>{ALGERIA_FLAG_EMOJI}</Text>
                <Text style={styles.countryCodeText}>+213</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                placeholder="5 50 12 34 56"
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                editable={!isLoading}
                maxLength={10}
              />
            </View>

            {/* Role Selector */}
            <Text style={styles.roleHeaderLabel}>Je suis...</Text>
            <View style={styles.roleContainer}>
              {[
                { value: 'Client' as UserRole, icon: 'person-outline', title: 'Client', desc: 'Je veux réserver des rendez-vous' },
                { value: 'Coiffeur' as UserRole, icon: 'cut-outline', title: 'Coiffeur / Gérant', desc: 'Je gère mon salon de coiffure' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.roleOption, role === option.value && styles.roleOptionActive]}
                  onPress={() => setRole(option.value)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.roleIconContainer, role === option.value && styles.roleIconContainerActive]}>
                    <Ionicons name={option.icon as any} size={22} color={role === option.value ? colors.ink : colors.textSecondary} />
                  </View>
                  <View style={styles.roleTextContainer}>
                    <Text style={[styles.roleTitle, role === option.value && styles.roleTitleActive]}>{option.title}</Text>
                    <Text style={styles.roleDesc}>{option.desc}</Text>
                  </View>
                  {role === option.value && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.amber} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.disabledButton]}
              onPress={handleSignUp}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>S'inscrire</Text>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={20}
                    color={colors.ink}
                    style={{ marginLeft: spacing.sm }}
                  />
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer / Legal */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              En continuant, vous acceptez nos {'\n'}
              <Text style={styles.linkText}>Conditions d'utilisation</Text> et notre <Text style={styles.linkText}>Politique de confidentialité</Text>
            </Text>

            <View style={styles.loginLinkContainer}>
              <Text style={styles.footerText}>Déjà un compte ? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('PhoneInput')} disabled={isLoading}>
                <Text style={styles.loginLink}>Se connecter</Text>
              </TouchableOpacity>
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
  headerLogo: {
    fontFamily: 'Syne_700Bold',
    fontSize: 18,
    color: colors.textPrimary,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  illustrationContainer: {
    height: 140,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.carbon,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  illustrationImage: {
    width: '100%',
    height: '100%',
    opacity: 0.6,
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
    backgroundColor: colors.ink,
    opacity: 0.4,
  },
  headlineContainer: {
    marginBottom: spacing.md,
  },
  headlineTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 24,
    color: colors.textPrimary,
  },
  headlineSubtitle: {
    ...typography.bodyMd,
    color: colors.textSecondary,
    marginTop: spacing.xs,
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
  inputFieldContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.carbon,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    height: 56,
    paddingHorizontal: spacing.md,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
  },
  phoneLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
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
  roleHeaderLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  roleContainer: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.carbon,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: spacing.md,
  },
  roleOptionActive: {
    borderColor: colors.amber,
    backgroundColor: '#24201A',
  },
  roleIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.graphite,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  roleIconContainerActive: {
    backgroundColor: colors.amber,
  },
  roleTextContainer: {
    flex: 1,
  },
  roleTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  roleTitleActive: {
    color: colors.amber,
  },
  roleDesc: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
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
  footer: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  linkText: {
    color: colors.amber,
    textDecorationLine: 'underline',
  },
  loginLinkContainer: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  loginLink: {
    ...typography.label,
    color: colors.amber,
    fontFamily: 'DMSans_700Bold',
  },
});
