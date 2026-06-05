import Toast from 'react-native-toast-message';
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, shadows } from '../../theme';
import Ionicons from '@react-native-vector-icons/ionicons';
import { apiClient } from '../../lib/apiClient';

export default function ForgotPasswordScreen({ navigation }: { navigation: Record<string, unknown> }) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Veuillez entrer votre adresse e-mail'
      });
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.post('/auth/reset-password', { email: email.trim() });
      setIsSent(true);
    } catch (err: unknown) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: (err as Error).message || 'Une erreur est survenue'
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
          <TouchableOpacity onPress={() => (navigation as any).goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerLogo}>7afefli</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.iconContainer}>
            <View style={styles.iconWrap}>
              <Ionicons name={isSent ? 'checkmark-circle' : 'lock-closed'} size={48} color={colors.amber} />
            </View>
          </View>

          <View style={styles.headlineContainer}>
            <Text style={styles.headlineTitle}>
              {isSent ? 'E-mail envoyé !' : 'Mot de passe oublié'}
            </Text>
            <Text style={styles.headlineSubtitle}>
              {isSent
                ? 'Un lien de réinitialisation a été envoyé à votre adresse e-mail. Vérifiez votre boîte de réception.'
                : 'Entrez votre adresse e-mail et nous vous enverrons un lien pour réinitialiser votre mot de passe.'}
            </Text>
          </View>

          {!isSent ? (
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

              <TouchableOpacity
                style={[styles.submitButton, isLoading && styles.disabledButton]}
                onPress={handleSubmit}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.ink} />
                ) : (
                  <>
                    <Text style={styles.submitButtonText}>Envoyer le lien</Text>
                    <Ionicons name="send-outline" size={18} color={colors.ink} style={{ marginLeft: spacing.sm }} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.submitButton}
              onPress={() => (navigation as any).goBack()}
            >
              <Text style={styles.submitButtonText}>Retour à la connexion</Text>
              <Ionicons name="arrow-back-outline" size={18} color={colors.ink} style={{ marginLeft: spacing.sm }} />
            </TouchableOpacity>
          )}
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
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    backgroundColor: colors.ink,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
  iconContainer: {
    alignItems: 'center',
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(232,160,32,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(232,160,32,0.25)',
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
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.lg,
  },
  form: {
    width: '100%',
    gap: spacing.lg,
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
});
