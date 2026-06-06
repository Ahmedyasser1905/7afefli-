// @ts-nocheck
// apps/mobile/src/screens/client/BookingConfirmScreen.tsx
// Success screen after booking — shows confirmation details with animation

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import { colors, spacing, radius } from '../../theme';
import Ionicons from '@react-native-vector-icons/ionicons';
import { formatDate, formatTime, formatDZD } from '@barberdz/shared/utils/formatters';

export function BookingConfirmScreen() {
  const route = useRoute<Record<string, unknown>>();
  const navigation = useNavigation<Record<string, unknown>>();
  const { reservationId } = route.params;

  // Animation refs
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    // Checkmark pop-in animation
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  // Fetch reservation details
  const { data: reservation } = useQuery({
    queryKey: ['reservation-confirm', reservationId],
    queryFn: async () => {
      const data = await apiClient.get<Record<string, unknown>>(`/reservations/${reservationId}`);
      return data;
    },
    enabled: !!reservationId,
  });

  const salon   = (reservation as Record<string, unknown>)?.salons ?? (reservation as Record<string, unknown>)?.salon;
  const service = (reservation as Record<string, unknown>)?.services ?? (reservation as Record<string, unknown>)?.service;

  const handleGoHome = () => {
    // Reset current stack (Home or Explore) to its first screen
    navigation.popToTop();
    
    // Switch to Home tab
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate('Home');
    }
  };

  const handleViewAppointments = () => {
    // Reset current stack (Home or Explore) to its first screen
    navigation.popToTop();
    
    // Navigate to appointments tab
    navigation.getParent()?.navigate('Appointments');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Success checkmark animation */}
        <Animated.View
          style={[
            styles.checkContainer,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={48} color={colors.ink} />
          </View>
          <View style={styles.pulseRing} />
        </Animated.View>

        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.title}>Rendez-vous confirmé !</Text>
          <Text style={styles.subtitle}>
            Votre réservation a été enregistrée avec succès
          </Text>
        </Animated.View>

        {/* Booking details card */}
        {reservation && (
          <Animated.View
            style={[
              styles.detailsCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Salon name */}
            <View style={styles.detailRow}>
              <View style={styles.detailIconContainer}>
                <Ionicons name="business" size={18} color={colors.amber} />
              </View>
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>Salon</Text>
                <Text style={styles.detailValue}>
                  {salon?.name || 'Salon'}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Service */}
            <View style={styles.detailRow}>
              <View style={styles.detailIconContainer}>
                <Ionicons name="cut" size={18} color={colors.amber} />
              </View>
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>Service</Text>
                <Text style={styles.detailValue}>
                  {service?.service_name || 'Service'}
                </Text>
              </View>
              {service?.price && (
                <Text style={styles.priceTag}>
                  {formatDZD(service.price)}
                </Text>
              )}
            </View>

            <View style={styles.divider} />

            {/* Date & Time */}
            <View style={styles.detailRow}>
              <View style={styles.detailIconContainer}>
                <Ionicons name="calendar" size={18} color={colors.amber} />
              </View>
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>Date & Heure</Text>
                <Text style={styles.detailValue}>
                  {reservation.appointment_date
                    ? formatDate(reservation.appointment_date)
                    : ''}
                </Text>
                <Text style={styles.detailTime}>
                  {formatTime(reservation.start_time)} – {formatTime(reservation.end_time)}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Status */}
            <View style={styles.detailRow}>
              <View style={styles.detailIconContainer}>
                <Ionicons name="hourglass" size={18} color={colors.amber} />
              </View>
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>Statut</Text>
                <View style={styles.statusBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>
                    {({
                        Confirmed: 'Confirmé',
                        Pending:   'En attente de confirmation',
                        Cancelled: 'Annulé',
                        Completed: 'Terminé',
                      } as Record<string, string>)[reservation.status as string]
                      ?? 'En attente de confirmation'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Notes / Phone */}
            {reservation.notes && (
              <>
                <View style={styles.divider} />
                <View style={styles.detailRow}>
                  <View style={styles.detailIconContainer}>
                    <Ionicons name="call" size={18} color={colors.amber} />
                  </View>
                  <View style={styles.detailText}>
                    <Text style={styles.detailLabel}>Téléphone / Notes</Text>
                    <Text style={styles.detailValue}>
                      {reservation.notes}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </Animated.View>
        )}

        {/* Action buttons */}
        <Animated.View
          style={[
            styles.buttonsContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleViewAppointments}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.ink} />
            <Text style={styles.primaryButtonText}>Voir mes rendez-vous</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleGoHome}
            activeOpacity={0.7}
          >
            <Ionicons name="home-outline" size={18} color={colors.amber} />
            <Text style={styles.secondaryButtonText}>Retour à l'accueil</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  checkContainer: {
    marginBottom: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: colors.amber,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  pulseRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: 'rgba(232, 160, 32, 0.2)',
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: 'Syne_700Bold',
    fontSize: 24,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  detailsCard: {
    width: '100%',
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: spacing.xl,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  detailIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(232, 160, 32, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailText: {
    flex: 1,
  },
  detailLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: 2,
  },
  detailTime: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  priceTag: {
    fontFamily: 'Syne_700Bold',
    fontSize: 15,
    color: colors.amber,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginVertical: spacing.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFA726',
  },
  statusText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: '#FFA726',
  },
  buttonsContainer: {
    width: '100%',
    gap: spacing.md,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.amber,
    height: 54,
    borderRadius: radius.md,
    gap: spacing.sm,
    elevation: 4,
    shadowColor: colors.amber,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  primaryButtonText: {
    fontFamily: 'Syne_600SemiBold',
    fontSize: 16,
    color: colors.ink,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    height: 48,
    borderRadius: radius.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(232, 160, 32, 0.3)',
  },
  secondaryButtonText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: colors.amber,
  },
});
