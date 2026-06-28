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
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, radius } from '../../theme';
import Ionicons from '@react-native-vector-icons/ionicons';
import { apiClient } from '../../lib/apiClient';
import { supabase } from '../../lib/supabase';
import { useTranslations } from '../../hooks/useTranslations';

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
  is_trial_active: boolean | null;
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

const formatDate = (dateStr: string | null, locale: string): string => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(locale === 'ar' ? 'ar-DZ' : 'fr-FR', {
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

// ---------- Component ----------

export function SubscriptionScreen() {
  const user = useAuthStore((s) => s.user);
  const { t, locale } = useTranslations();
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  // Track whether we just opened a payment URL so we know to poll on return
  const awaitingPaymentReturn = React.useRef(false);
  const pollIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const pollAttemptsRef = React.useRef(0);

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

  // Fetch salon's current subscription details from backend API (single source of truth)
  const {
    data: subscription,
    isLoading: subLoading,
    refetch: refetchSub,
  } = useQuery<MySubscription>({
    queryKey: ['my-salon-subscription', user?.id],
    queryFn: async () => {
      const data = await apiClient.get<MySubscription>('/subscriptions/my-plan');
      return data;
    },
    enabled: !!user,
    staleTime: 0,  // always revalidate on focus — webhook may have updated the DB
  });

  // Stop any running poll
  const stopPolling = React.useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    pollAttemptsRef.current = 0;
  }, []);

  // Poll subscription every 3s for up to 30s after returning from payment.
  // The Chargily webhook fires asynchronously — the app may return to foreground
  // before the webhook has updated the DB. Polling bridges this timing gap.
  const startPaymentPolling = React.useCallback(() => {
    stopPolling();
    pollAttemptsRef.current = 0;
    pollIntervalRef.current = setInterval(async () => {
      pollAttemptsRef.current += 1;
      const result = await refetchSub();
      const newStatus = result.data?.status;
      // Stop once we confirm activation OR after 10 attempts (30s)
      if (newStatus === 'Active' || pollAttemptsRef.current >= 10) {
        stopPolling();
        awaitingPaymentReturn.current = false;
      }
    }, 3000);
  }, [refetchSub, stopPolling]);

  // Force refetch on screen focus
  useFocusEffect(
    React.useCallback(() => {
      refetchPlans();
      refetchSub();
      return () => stopPolling(); // clean up poll on blur
    }, [refetchPlans, refetchSub, stopPolling])
  );

  // Force refetch when app transitions back to active (foreground)
  React.useEffect(() => {
    const appStateSub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        refetchPlans();
        refetchSub();
        // If we were waiting for a payment to complete, start polling
        if (awaitingPaymentReturn.current) {
          startPaymentPolling();
        }
      }
    });
    return () => {
      appStateSub.remove();
      stopPolling();
    };
  }, [refetchPlans, refetchSub, startPaymentPolling, stopPolling]);

  // Derived state
  const status = subscription?.status || 'Trial';
  const isTrialActive = subscription?.is_trial_active ?? (status === 'Trial');
  const trialPlanName = subscription?.plan_details?.name || 'Pro';
  const trialEnds = subscription?.trial_ends_at || null;
  const subEnds = subscription?.ends_at || null;
  const daysLeft = status === 'Trial' ? getDaysLeft(trialEnds) : status === 'Active' ? getDaysLeft(subEnds) : 0;

  const formatDuration = (days: number): string => {
    if (days === 30 || days === 31) return t('barber.sub_per_month');
    if (days === 90) return t('barber.sub_per_quarter');
    if (days === 365 || days === 366) return t('barber.sub_per_year');
    return `/${days}${t('barber.sub_per_days')}`;
  };

  const formatDaysLeft = (n: number | null) => {
    if (n === null) return '—';
    return `${n} ${n !== 1 ? t('barber.sub_day_plural') : t('barber.sub_day_singular')}`;
  };

  const isLoading = plansLoading || subLoading;
  // HIGH-4: Use actual query loading states so the pull-to-refresh spinner
  // actually appears while data is being refetched.
  const isRefreshing = plansLoading || subLoading;

  const handleRefresh = () => {
    refetchPlans();
    refetchSub();
  };

  const handleSubscribe = async (plan: PlanItem) => {
    setProcessingPlan(plan.slug);
    try {
      const result = await apiClient.post<{ checkout_url: string | null; id?: string; activated?: boolean }>(
        '/payments/checkout',
        { plan: plan.slug }
      );

      // Free/zero-price plan: backend activates it directly (Chargily rejects amount=0)
      if (result.activated === true) {
        Toast.show({
          type: 'success',
          text1: t('common.success'),
          text2: t('barber.sub_activated_free'),
        });
        // Refresh subscription status to reflect the change immediately
        refetchSub();
        refetchPlans();
        return;
      }

      // Paid plan: open Chargily checkout URL in the browser
      if (result.checkout_url) {
        // Mark that we expect a payment return so AppState handler starts polling
        awaitingPaymentReturn.current = true;
        await Linking.openURL(result.checkout_url);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('barber.sub_payment_error');
      awaitingPaymentReturn.current = false;
      Toast.show({
        type: 'error',
        text1: t('common.error'),
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
          <Text style={styles.headerTitle}>{t('barber.subscription')}</Text>
          <Text style={styles.headerSubtitle}>{t('barber.sub_subtitle')}</Text>
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
                {status === 'Active'
                  ? t('barber.sub_status_active')
                  : status === 'Trial'
                    ? (isTrialActive ? t('barber.sub_trial_badge').replace('{plan}', trialPlanName) : t('barber.sub_status_trial'))
                    : t('barber.sub_status_expired')}
              </Text>
            </View>
            {subscription?.plan_details?.name && (
              <Text style={styles.currentPlanName}>{t('barber.sub_plan_label').replace('{name}', subscription.plan_details.name)}</Text>
            )}
          </View>

          <View style={styles.statusDetails}>
            {status === 'Trial' && (
              <>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.detailLabel}>{t('barber.sub_trial_ends')}</Text>
                  <Text style={styles.detailValue}>{formatDate(trialEnds, locale)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="hourglass-outline" size={18} color={colors.warning} />
                  <Text style={styles.detailLabel}>{t('barber.sub_days_left')}</Text>
                  <Text style={[styles.detailValue, { color: (daysLeft ?? 0) <= 7 ? colors.error : colors.warning }]}>
                    {formatDaysLeft(daysLeft ?? null)}
                  </Text>
                </View>
              </>
            )}
            {status === 'Active' && (
              <>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.detailLabel}>{t('barber.sub_starts')}</Text>
                  <Text style={styles.detailValue}>{formatDate(subscription?.starts_at ?? null, locale)}</Text>
                </View>
                
                {Number(subscription?.plan_details?.price || 0) === 0 ? (
                  <View style={styles.detailRow}>
                    <Ionicons name="infinite-outline" size={18} color={colors.success} />
                    <Text style={styles.detailLabel}>{t('barber.sub_duration')}</Text>
                    <Text style={[styles.detailValue, { color: colors.success }]}>{t('barber.sub_unlimited')}</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.detailRow}>
                      <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                      <Text style={styles.detailLabel}>{t('barber.sub_expires')}</Text>
                      <Text style={styles.detailValue}>{formatDate(subEnds, locale)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="hourglass-outline" size={18} color={colors.success} />
                      <Text style={styles.detailLabel}>{t('barber.sub_days_left')}</Text>
                      <Text style={[styles.detailValue, { color: colors.success }]}>
                        {formatDaysLeft(daysLeft ?? null)}
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
                  {t('barber.sub_expired_msg')}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Plans — Smart display based on current plan */}
        {(() => {
          const currentSlug = subscription?.plan_details?.slug || '';
          const isActive = status === 'Active';

          // Find current plan details from the catalog
          const currentPlanDetails = subscription?.plan_details || plans.find(p => p.slug === currentSlug);

          // Filter plans to show
          const plansToShow = plans.filter(p => {
            // Never show the free plan as a purchasable option
            if (p.price === 0) return false;

            // If active paid: only show upgrades above current plan
            if (isActive && currentPlanDetails) {
              return p.sort_order > currentPlanDetails.sort_order;
            }

            // During active trial: user already has trial plan (e.g. Pro) for free.
            // Only show plans above the trial plan as upgrade options.
            if (isTrialActive && currentPlanDetails) {
              return p.sort_order > currentPlanDetails.sort_order;
            }

            // Expired or no trial plan info: show all paid plans
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
                    <Text style={styles.currentPlanBtnText}>{t('barber.sub_current_plan')}</Text>
                  </View>
                </View>
              )}

              {/* Upgrade / Subscribe section */}
              {plansToShow.length > 0 && (
                <Text style={styles.sectionTitle}>
                  {isActive ? t('barber.sub_upgrade_title') : t('barber.sub_choose_title')}
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
                        <Text style={styles.recommendedText}>{t('barber.sub_upgrade_badge')}</Text>
                      </View>
                    )}
                    {!isUpgrade && plan.is_recommended && (
                      <View style={styles.recommendedBadge}>
                        <Text style={styles.recommendedText}>{t('barber.sub_recommended_badge')}</Text>
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
                            {isUpgrade ? t('barber.sub_upgrade_btn').replace('{name}', plan.name) : t('barber.sub_subscribe_btn').replace('{name}', plan.name)}
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
                    {t('barber.sub_best_plan')}
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
            <Text style={styles.emptyText}>{t('barber.sub_no_plans')}</Text>
          </View>
        )}

        {/* Payment Info */}
        <View style={styles.infoCard}>
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.textSecondary} />
          <Text style={styles.infoText}>
            {t('barber.sub_payment_info')}
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
