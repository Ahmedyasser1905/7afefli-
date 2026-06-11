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

const INTERIOR_IMAGE = require('../../../assets/splash.png');

export default function PhoneInputScreen({ navigation }: { navigation: Record<string, unknown> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleEmailSubmit = async () => {
    if (!email || !password) {
      const msg = 'Veuillez remplir tous les champs';
      setErrorMsg(msg);
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: msg
      });
      return;
    }

    setErrorMsg(null);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) throw error;

      // onAuthStateChange in AppNavigator will handle the rest:
      // - fetch role + phone from profile
      // - set session + role + needsPhone atomically
      // - navigate to correct screen (or phone entry if needed)

    } catch (err: unknown) {
      console.error(err);
      const msg = err.message || 'Identifiants invalides';
      setErrorMsg(msg);
      Toast.show({
        type: 'error',
        text1: 'Erreur de connexion',
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
        <View style={styles.headerBar}>
          <Text style={styles.headerLogo}>7afefli</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          
          <View style={styles.illustrationContainer}>
            <Image
              source={INTERIOR_IMAGE}
              style={styles.illustrationImage}
              resizeMode="cover"
            />
            <View style={styles.gradientOverlay} />
          </View>

          <View style={styles.headlineContainer}>
            <Text style={styles.headlineTitle}>Connexion</Text>
            <Text style={styles.headlineSubtitle}>
              Connectez-vous à l'aide de votre adresse e-mail.
            </Text>
          </View>

          {errorMsg && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={20} color={colors.error} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          <View style={styles.form}>
            <View style={styles.inputFieldContainer}>
              <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="nom@example.com"
                placeholderTextColor={colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                editable={!isLoading}
              />
            </View>
            <View style={[styles.inputFieldContainer, { marginTop: spacing.md }]}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Mot de passe"
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
            <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={{ alignSelf: 'flex-end', marginTop: spacing.sm }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: colors.amber }}>Mot de passe oublié ?</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.disabledButton, { marginTop: spacing.xl }]}
              onPress={handleEmailSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>Se connecter</Text>
                  <Ionicons name="log-in-outline" size={20} color={colors.ink} style={{ marginLeft: spacing.sm }} />
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              En continuant, vous acceptez nos {'\n'}
              <Text style={styles.linkText}>Conditions d'utilisation</Text> et notre <Text style={styles.linkText}>Politique de confidentialité</Text>
            </Text>
            
            <View style={styles.signUpLinkContainer}>
              <Text style={styles.footerText}>Pas encore de compte ? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('SignUp')} disabled={isLoading}>
                <Text style={styles.signUpLink}>S'inscrire</Text>
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
  },
  illustrationContainer: {
    height: 180,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.carbon,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
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
    height: 60,
    backgroundColor: colors.ink,
    opacity: 0.4,
  },
  headlineContainer: {
    marginBottom: spacing.lg,
  },
  headlineTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 26,
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
    marginBottom: spacing.xl,
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
  signUpLinkContainer: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  signUpLink: {
    ...typography.label,
    color: colors.amber,
    fontFamily: 'DMSans_700Bold',
  },
});
