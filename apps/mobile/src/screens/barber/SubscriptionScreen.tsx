import Toast from 'react-native-toast-message';
// apps/mobile/src/screens/barber/SubscriptionScreen.tsx
// Subscription plan management for salon owners — fully dynamic (Supabase direct)

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, radius } from '../../theme';
import Ionicons from '@react-native-vector-icons/ionicons';
import { apiClient } from '../../lib/apiClient';
import { supabase } from '../../lib/supabase';

// ---------- Types ----------

interface MySubscription {
  id: string | null;
  salon_id: string;
  status: 'Trial' | 'Active' | 'Expired';
  plan: string;
  plan_details: PlanItem | null;
  trial_ends_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string | null;
}

interface PlanItem {
  id: string;
  name: string;
  slug: string;
  price: number;
  duration_days: number;
  features: string[];
  icon: string;
  is_recommended: boolean;
  sort_order: number;
}

// ---------- Helpers ----------

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const getDaysLeft = (dateStr: string | null): number | null => {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

const formatPrice = (price: number): string => {
  return price.toLocaleString('fr-DZ');
};

const formatDuration = (days: number): string => {
  if (days === 30 || days === 31) return '/mois';
  if (days === 90) return '/trimestre';
  if (days === 365 || days === 366) return '/an';
  return `/${days}j`;
};

// ---------- Component ----------

export function SubscriptionScreen() {
  const user = useAuthStore((s) => s.user);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  // Fetch available plans from backend API (single source of truth)
  const {
    data: plans = [],
    isLoading: plansLoading,
    refetch: refetchPlans,
  } = useQuery<PlanItem[]>({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const data = await apiClient.get<PlanItem[]>('/subscriptions/plans');
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  // Fetch salon + subscription in one query (avoids RLS issues on subscriptions table)
  const {
    data: salonData,
    isLoading: salonLoading,
    refetch: refetchSalon,
  } = useQuery({
    queryKey: ['my-salon-subscription', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salons')
        .select('*, subscriptions:user_subscriptions(*, plan_details:plans(*))')
        .eq('owner_id', user!.id)
        .maybeSingle();
      if (error) console.warn('Salon query error:', error.message);
      return data;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  // Extract subscription from salon data
  const salon = salonData as any | null;
  const rawSubs = (salonData as any)?.subscriptions;
  const subRecord = Array.isArray(rawSubs) ? rawSubs[0] : rawSubs;

  const subscription: MySubscription | null = subRecord ? {
    id: subRecord.id,
    salon_id: subRecord.salon_id,
    status: subRecord.status,
    plan: subRecord.plan,
    plan_details: subRecord.plan_details || null,
    trial_ends_at: subRecord.trial_ends_at,
    starts_at: subRecord.starts_at,
    ends_at: subRecord.ends_at,
    created_at: subRecord.created_at,
  } : salon ? {
    id: null,
    salon_id: (salon as any).id,
    status: (salon as any).subscription_status || 'Trial',
    plan: 'Basic',
    plan_details: null,
    trial_ends_at: (salon as any).trial_ends_at || null,
    starts_at: null,
    ends_at: null,
    created_at: null,
  } : null;

  const subLoading = salonLoading;
  const refetchSub = refetchSalon;

  // Derived state
  const status = subscription?.status || (salon as any)?.subscription_status || 'Trial';
  const trialEnds = subscription?.trial_ends_at || (salon as any)?.trial_ends_at as string | null;
  const subEnds = subscription?.ends_at || (salon as any)?.subscription_ends_at as string | null;
  const daysLeft = status === 'Trial' ? getDaysLeft(trialEnds) : status === 'Active' ? getDaysLeft(subEnds) : 0;

  const isLoading = plansLoading || subLoading;
  const isRefreshing = false;

  const handleRefresh = () => {
    refetchPlans();
    refetchSub();
  };

  const handleSubscribe = async (plan: PlanItem) => {
    setProcessingPlan(plan.slug);
    try {
      const result = await apiClient.post<{ checkout_url: string; id: string }>(
        '/payments/checkout',
        { plan: plan.slug, amount: plan.price }
      );

      if (result.checkout_url) {
        await Linking.openURL(result.checkout_url);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors du paiement';
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: msg
      });
    } finally {
      setProcessingPlan(null);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.amber} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.amber}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Abonnement</Text>
          <Text style={styles.headerSubtitle}>Gérez votre formule 7afefli</Text>
        </View>

        {/* Current Plan Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={[
              styles.statusBadge,
              status === 'Active' ? styles.badgeActive :
              status === 'Trial' ? styles.badgeTrial : styles.badgeExpired
            ]}>
              <Ionicons
                name={status === 'Active' ? 'checkmark-circle' : status === 'Trial' ? 'time' : 'alert-circle'}
                size={16}
                color={status === 'Active' ? colors.success : status === 'Trial' ? colors.warning : colors.error}
              />
              <Text style={[
                styles.statusBadgeText,
                { color: status === 'Active' ? colors.success : status === 'Trial' ? colors.warning : colors.error }
              ]}>
                {status === 'Active' ? 'Actif' : status === 'Trial' ? 'Essai Gratuit' : 'Expiré'}
              </Text>
            </View>
            {subscription?.plan && subscription.plan !== 'trial' && (
              <Text style={styles.currentPlanName}>Plan {subscription.plan}</Text>
            )}
          </View>

          <View style={styles.statusDetails}>
            {status === 'Trial' && (
              <>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.detailLabel}>Fin de l'essai</Text>
                  <Text style={styles.detailValue}>{formatDate(trialEnds)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="hourglass-outline" size={18} color={colors.warning} />
                  <Text style={styles.detailLabel}>Jours restants</Text>
                  <Text style={[styles.detailValue, { color: (daysLeft ?? 0) <= 7 ? colors.error : colors.warning }]}>
                    {daysLeft !== null ? `${daysLeft} jour${daysLeft !== 1 ? 's' : ''}` : '—'}
                  </Text>
                </View>
              </>
            )}
            {status === 'Active' && (
              <>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.detailLabel}>Début</Text>
                  <Text style={styles.detailValue}>{formatDate(subscription?.starts_at ?? null)}</Text>
                </View>
                
                {subscription?.plan_details?.price === 0 ? (
                  <View style={styles.detailRow}>
                    <Ionicons name="infinite-outline" size={18} color={colors.success} />
                    <Text style={styles.detailLabel}>Durée</Text>
                    <Text style={[styles.detailValue, { color: colors.success }]}>Illimitée (Gratuit)</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.detailRow}>
                      <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                      <Text style={styles.detailLabel}>Expire le</Text>
                      <Text style={styles.detailValue}>{formatDate(subEnds)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="hourglass-outline" size={18} color={colors.success} />
                      <Text style={styles.detailLabel}>Jours restants</Text>
                      <Text style={[styles.detailValue, { color: colors.success }]}>
                        {daysLeft !== null ? `${daysLeft} jour${daysLeft !== 1 ? 's' : ''}` : '—'}
                      </Text>
                    </View>
                  </>
                )}
              </>
            )}
            {status === 'Expired' && (
              <View style={styles.expiredBanner}>
                <Ionicons name="warning-outline" size={22} color={colors.error} />
                <Text style={styles.expiredText}>
                  Votre abonnement a expiré. Votre salon n'est plus visible aux clients.
                  Renouvelez pour réapparaître.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Plans — Smart display based on current plan */}
        {(() => {
          const currentSlug = subscription?.plan?.toLowerCase() || '';
          const isActive = status === 'Active';

          // Find current plan details from the catalog
          const currentPlanDetails = subscription?.plan_details || plans.find(p => p.slug === currentSlug);

          // Filter plans to show
          const plansToShow = plans.filter(p => {
            // Ne jamais afficher un plan gratuit comme option d'achat
            if (p.price === 0) return false;
            
            // Si actif, ne montrer que les plans supérieurs
            if (isActive && currentPlanDetails) {
              return p.sort_order > currentPlanDetails.sort_order;
            }
            
            // En essai ou expiré : montrer tous les plans payants
            return true;
          });

          return (
            <>
              {/* Current Plan Card (when active) */}
              {isActive && currentPlanDetails && (
                <View style={[styles.planCard, styles.planCardCurrent]}>
                  <View style={styles.planHeader}>
                    <View style={[styles.planIconContainer, { backgroundColor: 'rgba(46,204,113,0.12)' }]}>
                      <Ionicons name={(currentPlanDetails.icon || 'star-outline') as any} size={24} color={colors.success} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planName}>{currentPlanDetails.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                        <Text style={[styles.planPrice, { color: colors.success }]}>{formatPrice(currentPlanDetails.price)}</Text>
                        <Text style={[styles.planCurrency, { color: colors.success }]}> DZD</Text>
                        <Text style={styles.planPeriod}>{formatDuration(currentPlanDetails.duration_days)}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.featureList}>
                    {(Array.isArray(currentPlanDetails.features) ? currentPlanDetails.features : []).map((feature: string, idx: number) => (
                      <View key={idx} style={styles.featureItem}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                        <Text style={styles.featureText}>{feature}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.currentPlanBtn}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                    <Text style={styles.currentPlanBtnText}>Votre plan actuel</Text>
                  </View>
                </View>
              )}

              {/* Upgrade / Subscribe section */}
              {plansToShow.length > 0 && (
                <Text style={styles.sectionTitle}>
                  {isActive ? 'Passer au supérieur' : 'Choisir une formule'}
                </Text>
              )}

              {plansToShow.map((plan) => {
                const features: string[] = Array.isArray(plan.features) ? plan.features : [];
                // It is an upgrade if the new plan has a higher sort_order
                const isUpgrade = isActive && currentPlanDetails && plan.sort_order > currentPlanDetails.sort_order;

                return (
                  <View
                    key={plan.id}
                    style={[
                      styles.planCard,
                      (plan.is_recommended || isUpgrade) && styles.planCardRecommended,
                    ]}
                  >
                    {isUpgrade && (
                      <View style={styles.recommendedBadge}>
                        <Text style={styles.recommendedText}>⬆️ Upgrade</Text>
                      </View>
                    )}
                    {!isUpgrade && plan.is_recommended && (
                      <View style={styles.recommendedBadge}>
                        <Text style={styles.recommendedText}>⭐ Recommandé</Text>
                      </View>
                    )}

                    <View style={styles.planHeader}>
                      <View style={styles.planIconContainer}>
                        <Ionicons name={(plan.icon || 'star-outline') as any} size={24} color={colors.amber} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.planName}>{plan.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                          <Text style={styles.planPrice}>{formatPrice(plan.price)}</Text>
                          <Text style={styles.planCurrency}> DZD</Text>
                          <Text style={styles.planPeriod}>{formatDuration(plan.duration_days)}</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.featureList}>
                      {features.map((feature, idx) => (
                        <View key={idx} style={styles.featureItem}>
                          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                          <Text style={styles.featureText}>{feature}</Text>
                        </View>
                      ))}
                    </View>

                    <TouchableOpacity
                      style={[styles.subscribeBtn, styles.subscribeBtnRecommended]}
                      onPress={() => handleSubscribe(plan)}
                      disabled={!!processingPlan}
                      activeOpacity={0.7}
                    >
                      {processingPlan === plan.slug ? (
                        <ActivityIndicator color={colors.ink} size="small" />
                      ) : (
                        <>
                          <Ionicons name={isUpgrade ? 'arrow-up-circle' : 'card-outline'} size={18} color={colors.ink} />
                          <Text style={[styles.subscribeBtnText, styles.subscribeBtnTextRecommended]}>
                            {isUpgrade ? 'Passer au Premium' : "S'abonner"}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}

              {/* All good message for highest tier */}
              {isActive && plansToShow.length === 0 && (
                <View style={styles.emptyState}>
                  <Ionicons name="trophy" size={48} color={colors.amber} />
                  <Text style={[styles.emptyText, { color: colors.amber }]}>
                    Vous avez le meilleur plan ! 🎉
                  </Text>
                </View>
              )}
            </>
          );
        })()}

        {/* Empty state if no plans */}
        {plans.length === 0 && !plansLoading && (
          <View style={styles.emptyState}>
            <Ionicons name="cart-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>Aucune formule disponible pour le moment.</Text>
          </View>
        )}

        {/* Payment Info */}
        <View style={styles.infoCard}>
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.textSecondary} />
          <Text style={styles.infoText}>
            Paiement sécurisé par Chargily Pay. Vous serez redirigé vers la page de paiement.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 24,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Status Card
  statusCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: spacing.xl,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeActive: { backgroundColor: 'rgba(46,204,113,0.12)' },
  badgeTrial: { backgroundColor: 'rgba(241,196,15,0.12)' },
  badgeExpired: { backgroundColor: 'rgba(231,76,60,0.12)' },
  statusBadgeText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
  },
  currentPlanName: {
    fontFamily: 'Syne_700Bold',
    fontSize: 15,
    color: colors.amber,
  },
  statusDetails: {},
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    gap: spacing.sm,
  },
  detailLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
  },
  detailValue: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: colors.textPrimary,
  },
  expiredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: 'rgba(231,76,60,0.08)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(231,76,60,0.2)',
  },
  expiredText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.error,
    flex: 1,
    lineHeight: 18,
  },

  // Section
  sectionTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 18,
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },

  // Plan Cards
  planCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  planCardRecommended: {
    borderColor: 'rgba(232,160,32,0.4)',
    backgroundColor: 'rgba(232,160,32,0.04)',
  },
  planCardCurrent: {
    borderColor: 'rgba(46,204,113,0.3)',
  },
  recommendedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(232,160,32,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: spacing.sm,
  },
  recommendedText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
    color: colors.amber,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  planIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(232,160,32,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planName: {
    fontFamily: 'Syne_700Bold',
    fontSize: 18,
    color: colors.textPrimary,
  },
  planPrice: {
    fontFamily: 'Syne_700Bold',
    fontSize: 28,
    color: colors.amber,
  },
  planCurrency: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: colors.amber,
  },
  planPeriod: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 2,
  },
  featureList: {
    gap: 8,
    marginBottom: spacing.lg,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
  },

  // Buttons
  subscribeBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(232,160,32,0.3)',
    backgroundColor: 'rgba(232,160,32,0.08)',
  },
  subscribeBtnRecommended: {
    backgroundColor: colors.amber,
    borderColor: colors.amber,
  },
  subscribeBtnText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: colors.amber,
  },
  subscribeBtnTextRecommended: {
    color: colors.ink,
  },
  currentPlanBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.3)',
    backgroundColor: 'rgba(46,204,113,0.08)',
  },
  currentPlanBtnText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: colors.success,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  emptyText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // Info Card
  infoCard: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.carbon,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  infoText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },
});
