import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { colors, typography, spacing, radius, shadows } from '../../theme';
import Ionicons from "@react-native-vector-icons/ionicons";
import type { UserRole } from '@barberdz/shared/types';

const INTERIOR_IMAGE = 'https://lh3.googleusercontent.com/aida-public/AB6AXuAZy2Mt7FE0kGK9BOxV5oCaUrKiv5AdMc4W3peRRlDoBgY8MldYttQi3NU01BuRbRAjCmGE7Tb3Iuf9ofpVUvJw3aI1cDw9CArKY69YTGfVtcLnOM4_fglrm54PJrYlp8QTi5XjLA7a5obci4gDPx706DbTymY52zNNR_5laSQJhQaXERblCS1kdf2S1OFZUP-vG1mdBPSZtA41zA3OlKyH4Thilegd-H2reMM3HO4zJrfNhvZaaPlAZ2tarGLzJKz5Fh4SDLnwz0Ie';
const DEFAULT_AVATAR = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDhsTHtiP3Z4tCtsj3LGHwYS5xdJSlpMbLr-LvZld6LDrXErLk7k8pnjAS32G_HSNI0P2IuYAfQwpOp6Wr_9ufZKN6Klf7rxMQhmAnJmKwnPZIuuttQO7lWVDMWVmvbYLskVk5Ocfp_zGhXguCLwBCGAf8i0IbCjWKcjYkjEhCD3lEeJlMSlIAkiPwLvg1yvPehfA1FUh8sJwyUIeVjhtiKmRuyLFwa9Jo3HVhFr1t6_hj4T5WdrFjZki5vffu7I-q1rZHS5Owb9XUe';

export default function RoleSelectScreen() {
  const { user, setRole } = useAuthStore();
  const selected: UserRole = 'Client';
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error logging out:', err);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    
    setErrorMsg(null);
    setIsLoading(true);

    try {
      // Update the user profile role in the database
      const { error } = await supabase
        .from('profiles')
        .update({ role: selected })
        .eq('id', user.id);

      if (error) throw error;

      // Update the role in the global store
      setRole(selected);
    } catch (err: unknown) {
      console.error(err);
      const msg = err.message || 'Impossible de mettre à jour le rôle';
      setErrorMsg(msg);
      Alert.alert('Erreur', msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* Top Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backButton} onPress={handleLogout} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.amber} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>7afefli</Text>
        <View style={styles.profileIndicator}>
          <Image source={{ uri: DEFAULT_AVATAR }} style={styles.profileImage} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Bienvenue !</Text>
          <Text style={styles.heroSubtitle}>
            Bienvenue sur 7afefli ! Votre compte sera configuré en tant que client. Seul un administrateur peut vous attribuer le rôle de coiffeur.
          </Text>
        </View>

        {errorMsg && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={20} color={colors.error} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Cards Grid */}
        <View style={styles.cardsContainer}>
          {/* Client Card (auto-selected) */}
          <View
            style={[
              styles.roleCard,
              styles.activeCard,
            ]}
          >
            <View style={[styles.iconContainer, styles.activeIconContainer]}>
              <Ionicons
                name="person"
                size={28}
                color={colors.ink}
              />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Client</Text>
              <Text style={styles.cardDescription}>
                Je souhaite prendre rendez-vous chez un coiffeur.
              </Text>
            </View>
            <View style={[styles.radioIndicator, styles.activeRadio]}>
              <View style={styles.radioDot} />
            </View>
          </View>
        </View>

        {/* Visual Context Bento Card */}
        <View style={styles.bentoCard}>
          <Image source={{ uri: INTERIOR_IMAGE }} style={styles.bentoImage} resizeMode="cover" />
          <View style={styles.bentoOverlay} />
          <View style={styles.bentoContent}>
            <View style={styles.bentoBadge}>
              <Text style={styles.bentoBadgeText}>EXPÉRIENCE PREMIUM</Text>
            </View>
            <Text style={styles.bentoText}>
              Le savoir-faire et la précision pour l'homme algérien moderne.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.submitButton, isLoading && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <>
              <Text style={styles.submitButtonText}>C'est parti !</Text>
              <Ionicons name="arrow-forward" size={20} color={colors.ink} style={{ marginLeft: spacing.sm }} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  headerBar: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: colors.ink,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 20,
    color: colors.amber,
  },
  profileIndicator: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 110, // Avoid overlapping the sticky button
  },
  heroSection: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  heroTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 28,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  heroSubtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: colors.textSecondary,
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
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: '#FF8A80',
    marginLeft: spacing.sm,
    flex: 1,
  },
  cardsContainer: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  activeCard: {
    borderColor: colors.amber,
    backgroundColor: '#1E1A14',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.graphite,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  activeIconContainer: {
    backgroundColor: colors.amber,
  },
  cardContent: {
    flex: 1,
    paddingRight: spacing.md,
  },
  cardTitle: {
    fontFamily: 'Syne_600SemiBold',
    fontSize: 18,
    color: colors.amber,
    marginBottom: 4,
  },
  cardDescription: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  radioIndicator: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeRadio: {
    borderColor: colors.amber,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.amber,
  },
  bentoCard: {
    height: 160,
    borderRadius: radius.lg,
    overflow: 'hidden',
    position: 'relative',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  bentoImage: {
    width: '100%',
    height: '100%',
  },
  bentoOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 15, 15, 0.65)',
  },
  bentoContent: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
  },
  bentoBadge: {
    backgroundColor: 'rgba(232, 160, 32, 0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
  },
  bentoBadgeText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 10,
    color: colors.amber,
    letterSpacing: 1,
  },
  bentoText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(15, 15, 15, 0.85)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  submitButton: {
    backgroundColor: colors.amber,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    ...shadows.amber,
  },
  submitButtonText: {
    fontFamily: 'Syne_600SemiBold',
    fontSize: 16,
    color: colors.ink,
  },
  disabledButton: {
    backgroundColor: colors.amberDim,
    opacity: 0.6,
  },
});
