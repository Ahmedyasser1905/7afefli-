// apps/mobile/src/screens/client/ClientSubscriptionScreen.tsx
// Premium subscription plans screen for clients

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, radius } from '../../theme';
import Ionicons from '@react-native-vector-icons/ionicons';

interface Plan {
  id: string;
  name: string;
  price: number;
  duration_days: number;
  features: string[];
  description?: string;
}

export function ClientSubscriptionScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);

  // Fetch available subscription plans
  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ['subscription-plans'],
    queryFn: () => apiClient.get<Plan[]>('/subscription-plans'),
    staleTime: 5 * 60 * 1000,
  });

  const handleSubscribe = async (plan: Plan) => {
    if (!user) return;

    Alert.alert(
      `S'abonner au plan ${plan.name}`,
      `Prix : ${plan.price} DZD${plan.duration_days > 0 ? ` / ${plan.duration_days} jours` : ' (illimité)'}\n\nVous allez être redirigé vers la page de paiement Chargily.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Continuer',
          onPress: async () => {
            setLoadingPlanId(plan.id);
            try {
              const response = await apiClient.post<{ checkout_url: string }>(
                '/payments/initiate',
                {
                  plan_id: plan.id,
                  user_id: user.id,
                },
              );
              if (response?.checkout_url) {
                await Linking.openURL(response.checkout_url);
              } else {
                throw new Error('URL de paiement manquante');
              }
            } catch (error: unknown) {
              Toast.show({
                type: 'error',
                text1: 'Erreur de paiement',
                text2: (error as Error).message || 'Impossible d\'initier le paiement.',
              });
            } finally {
              setLoadingPlanId(null);
            }
          },
        },
      ],
    );
  };

  const getPlanIcon = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes('gold') || lower.includes('premium')) return 'diamond';
    if (lower.includes('silver') || lower.includes('standard')) return 'star';
    return 'leaf';
  };

  const getPlanColor = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes('gold') || lower.includes('premium')) return '#FFD700';
    if (lower.includes('silver') || lower.includes('standard')) return '#C0C0C0';
    return colors.amber;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Abonnement Premium</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Hero Section */}
      <View style={styles.hero}>
        <Ionicons name="diamond-outline" size={44} color={colors.amber} />
        <Text style={styles.heroTitle}>Passez au niveau supérieur</Text>
        <Text style={styles.heroSubtitle}>
          Profitez de fonctionnalités exclusives et d'avantages premium
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <ActivityIndicator color={colors.amber} size="large" style={{ marginTop: 60 }} />
        ) : plans.length === 0 ? (
          <Text style={styles.emptyText}>Aucun plan disponible pour le moment.</Text>
        ) : (
          plans.map((plan) => {
            const planColor = getPlanColor(plan.name);
            const isThisLoading = loadingPlanId === plan.id;
            const features: string[] = Array.isArray(plan.features)
              ? plan.features
              : typeof plan.features === 'string'
              ? JSON.parse(plan.features)
              : [];

            return (
              <View key={plan.id} style={[styles.planCard, { borderColor: `${planColor}30` }]}>
                {/* Plan Header */}
                <View style={styles.planHeader}>
                  <View style={[styles.planIconWrap, { backgroundColor: `${planColor}18` }]}>
                    <Ionicons name={getPlanIcon(plan.name) as any} size={26} color={planColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.planName, { color: planColor }]}>{plan.name}</Text>
                    {plan.description ? (
                      <Text style={styles.planDesc}>{plan.description}</Text>
                    ) : null}
                  </View>
                  <View style={styles.priceWrap}>
                    <Text style={[styles.planPrice, { color: planColor }]}>
                      {plan.price === 0 ? 'Gratuit' : `${plan.price} DZD`}
                    </Text>
                    {plan.duration_days > 0 && (
                      <Text style={styles.planDuration}>/ {plan.duration_days}j</Text>
                    )}
                  </View>
                </View>

                {/* Features */}
                {features.length > 0 && (
                  <View style={styles.featuresList}>
                    {features.map((feature, i) => (
                      <View key={i} style={styles.featureRow}>
                        <Ionicons name="checkmark-circle" size={16} color={planColor} />
                        <Text style={styles.featureText}>{feature}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Subscribe Button */}
                {plan.price > 0 ? (
                  <TouchableOpacity
                    style={[styles.subscribeBtn, { borderColor: planColor, backgroundColor: `${planColor}18` }]}
                    onPress={() => handleSubscribe(plan)}
                    disabled={isThisLoading}
                    activeOpacity={0.8}
                  >
                    {isThisLoading ? (
                      <ActivityIndicator color={planColor} size="small" />
                    ) : (
                      <>
                        <Ionicons name="card-outline" size={18} color={planColor} />
                        <Text style={[styles.subscribeBtnText, { color: planColor }]}>
                          S'abonner — {plan.price} DZD
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.subscribeBtn, { borderColor: colors.textMuted, backgroundColor: 'rgba(255,255,255,0.04)' }]}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.textMuted} />
                    <Text style={[styles.subscribeBtnText, { color: colors.textMuted }]}>Plan actuel</Text>
                  </View>
                )}
              </View>
            );
          })
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.carbon,
  },
  headerTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 18,
    color: colors.textPrimary,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  heroTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 22,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  heroSubtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  emptyText: {
    fontFamily: 'DMSans_400Regular',
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 60,
    fontSize: 14,
  },
  planCard: {
    backgroundColor: colors.carbon,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  planIconWrap: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planName: {
    fontFamily: 'Syne_700Bold',
    fontSize: 18,
    marginBottom: 2,
  },
  planDesc: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  priceWrap: {
    alignItems: 'flex-end',
  },
  planPrice: {
    fontFamily: 'Syne_700Bold',
    fontSize: 20,
  },
  planDuration: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: colors.textMuted,
  },
  featuresList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textPrimary,
    flex: 1,
  },
  subscribeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  subscribeBtnText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
  },
});
