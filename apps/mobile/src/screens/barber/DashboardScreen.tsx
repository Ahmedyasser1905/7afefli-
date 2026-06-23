import Toast from 'react-native-toast-message';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { apiClient } from '../../lib/apiClient';
import { colors, spacing, radius, shadows } from '../../theme';
import { useRealtimeBookings } from '../../hooks/barber/useRealtimeBookings';
import { useAuthStore } from '../../store/authStore';
import { formatTime, formatDZD, today } from '@barberdz/shared/utils/formatters';
import Ionicons from "@react-native-vector-icons/ionicons";
import type { Reservation } from '@barberdz/shared/types';
import { AddWalkInModal } from '../../components/barber/AddWalkInModal';
import { ReservationDetailModal } from '../../components/barber/ReservationDetailModal';
import { BlockTimeModal } from '../../components/barber/BlockTimeModal';
import { NotificationBell } from '../../components/shared/NotificationBell';
import { useTranslations } from '../../hooks/useTranslations';
const DEFAULT_AVATAR = 'https://phfwutugsyiutqgippqg.supabase.co/storage/v1/object/public/portfolio/defaults/default-avatar.png';

export function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const { t, locale } = useTranslations();

  // HIGH-2: Use a single canonical query key ['my-salon', user?.id] so this screen
  // shares the same React Query cache entry as MySalonScreen and SalonSetupScreen.
  // Invalidate only that key to avoid stale Dashboard state after salon creation.
  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['my-salon', user?.id] });
    }, [queryClient, user?.id])
  );

  const [isWalkInModalVisible, setIsWalkInModalVisible] = useState(false);
  const [isBlockTimeModalVisible, setIsBlockTimeModalVisible] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'Confirmed' | 'Pending' | 'Cancelled' | 'Completed'>('all');
  const [viewMode, setViewMode] = useState<'day' | 'month' | 'all'>('day');
  const [viewDate, setViewDate]   = useState(today());
  const [viewMonth, setViewMonth] = useState(today().slice(0, 7)); // YYYY-MM

  // Fetch barber's salon — HIGH-2: canonical key matches MySalonScreen/SalonSetupScreen
  const { data: salon, isLoading: isSalonLoading } = useQuery<Record<string, unknown> | null>({
    queryKey: ['my-salon', user?.id],
    queryFn: async () => {
      if (!user) return null;
      return apiClient.get<Record<string, unknown>>('/salons/my-salon');
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const salonId = (salon?.id as string) ?? null;

  const navigation = useNavigation();

  const hasServices = useMemo(() => {
    const svcs = salon?.services as unknown[] | undefined;
    return !!(svcs && svcs.length > 0);
  }, [salon]);

  const hasBarbers = useMemo(() => {
    const staff = salon?.salon_staff as unknown[] | undefined;
    return !!(staff && staff.length > 0);
  }, [salon]);

  // FIX-7: portfolio_photos is NOT required by the backend — removed false 'incomplete' warning trigger.
  const isComplete = useMemo(() => {
    return !!(
      salon &&
      salon.name &&
      salon.address &&
      salon.wilaya &&
      salon.commune &&
      salon.phone &&
      salon.description &&
      salon.latitude !== null && salon.latitude !== undefined &&
      salon.longitude !== null && salon.longitude !== undefined &&
      salon.open_time &&
      salon.close_time &&
      salon.image_url &&
      hasServices &&
      hasBarbers
    );
  }, [salon, hasServices, hasBarbers]);

  // Fetch bookings — day mode uses ?date= for server-side filter; month/all fetch all then filter client-side
  const { data: bookingsRaw = [], isLoading: isBookingsLoading, refetch } = useQuery<Reservation[]>({
    queryKey: ['barber-reservations', salonId, viewMode === 'day' ? viewDate : 'all'],
    queryFn: async () => {
      if (!salonId) return [];
      // Day mode: server-side date filter (fast)
      // Month/All mode: fetch all without date filter (client-side filter below)
      const url = viewMode === 'day'
        ? `/reservations/salon/${salonId}?date=${viewDate}`
        : `/reservations/salon/${salonId}`;
      const data = await apiClient.get<Reservation[]>(url);
      return data ?? [];
    },
    enabled: !!salonId,
    staleTime: 0,
    // No refetchInterval — Realtime subscription (useRealtimeBookings) handles
    // live updates and invalidates this query automatically on new bookings.
  });


  // Realtime subscription — invalidates cache automatically via useRealtimeBookings hook
  useRealtimeBookings({
    salonId,
    onNewBooking: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  // Sort all raw bookings
  const allItems = useMemo(() => {
    return [...bookingsRaw].sort((a, b) => {
      if (a.appointment_date !== b.appointment_date)
        return b.appointment_date.localeCompare(a.appointment_date);
      return b.start_time.localeCompare(a.start_time);
    });
  }, [bookingsRaw]);

  // Filter by selected period (month view = client-side)
  const periodItems = useMemo(() => {
    if (viewMode === 'day')   return allItems;
    if (viewMode === 'month') return allItems.filter(r => (r.appointment_date as string)?.startsWith(viewMonth));
    return allItems;
  }, [allItems, viewMode, viewMonth]);

  const blockedItems = useMemo(
    () => periodItems.filter((r) => (r as any).notes?.includes('CRÉNEAU BLOQUÉ')),
    [periodItems],
  );

  // All real bookings (no blocks) — used for filter tabs
  const realBookings = useMemo(
    () => periodItems.filter((r) => !(r as any).notes?.includes('CRÉNEAU BLOQUÉ')),
    [periodItems],
  );

  // Algeria time helper
  const getNowStr = () => {
    const t = new Date(Date.now() + 60 * 60 * 1000);
    return `${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`;
  };

  // Period navigation helpers — parse without UTC shift
  const goToPrevDay  = useCallback(() => {
    setViewDate((prev) => {
      const [y, m, d] = prev.split('-').map(Number);
      const dt = new Date(y, m - 1, d - 1);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    });
  }, []);
  const goToNextDay  = useCallback(() => {
    setViewDate((prev) => {
      const [y, m, d] = prev.split('-').map(Number);
      const dt = new Date(y, m - 1, d + 1);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    });
  }, []);
  const goToPrevMonth = useCallback(() => {
    setViewMonth((prev) => {
      const [y, m] = prev.split('-').map(Number);
      const dt = new Date(y, m - 2, 1);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    });
  }, []);
  const goToNextMonth = useCallback(() => {
    setViewMonth((prev) => {
      const [y, m] = prev.split('-').map(Number);
      const dt = new Date(y, m, 1);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    });
  }, []);

  // Human-readable period label — parse date locally to avoid UTC shift
  const periodLabel = useMemo(() => {
    if (viewMode === 'day') {
      const [y, m, d] = viewDate.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      if (viewDate === today()) return t('barber.today');
      return dt.toLocaleDateString(locale === 'ar' ? 'ar-DZ' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    }
    if (viewMode === 'month') {
      const [y, m] = viewMonth.split('-').map(Number);
      return new Date(y, m - 1, 1).toLocaleDateString(locale === 'ar' ? 'ar-DZ' : 'fr-FR', { month: 'long', year: 'numeric' });
    }
    return t('barber.period_all');
  }, [viewMode, viewDate, viewMonth, t, locale]);

  const revenuePeriodLabel = viewMode === 'day' ? t('barber.period_day') : viewMode === 'month' ? t('barber.period_month') : t('barber.period_total');

  const bookingItems = useMemo(() => {
    const nowAlgBk = new Date(Date.now() + 60 * 60 * 1000); // UTC+1 Algeria
    const nowStr = `${String(nowAlgBk.getUTCHours()).padStart(2, '0')}:${String(nowAlgBk.getUTCMinutes()).padStart(2, '0')}`;
    // Use Algeria date (not UTC!) to avoid midnight edge case
    const todayAlg = `${nowAlgBk.getUTCFullYear()}-${String(nowAlgBk.getUTCMonth()+1).padStart(2,'0')}-${String(nowAlgBk.getUTCDate()).padStart(2,'0')}`;
    return realBookings.filter((r) => {
      const endTime = (r.end_time ?? '').slice(0, 5);
      const apptDate = r.appointment_date as string ?? '';
      // Expired = past Algeria-date OR (today Algeria + end_time passed)
      const isExpiredConfirmed = r.status === 'Confirmed' && (
        apptDate < todayAlg ||
        (apptDate === todayAlg && endTime && endTime < nowStr)
      );
      const isExpiredPending = r.status === 'Pending' && (
        apptDate < todayAlg ||
        (apptDate === todayAlg && endTime && endTime < nowStr)
      );

      switch (selectedFilter) {
        case 'all':
          // Show everything — all statuses together
          return true;
        case 'Confirmed':
          return r.status === 'Confirmed' && !isExpiredConfirmed;
        case 'Pending':
          return r.status === 'Pending' && !isExpiredPending;
        case 'Cancelled':
          return r.status === 'Cancelled';
        case 'Completed':
          return r.status === 'Completed' || isExpiredConfirmed || isExpiredPending;
        default:
          return true;
      }
    });
  }, [realBookings, selectedFilter]);

  // Combine for FlatList: bookings first, then blocked slots
  // Blocked slots only appear in Jour mode (irrelevant in month/all historical views)
  const showBlocks = selectedFilter === 'all' && viewMode === 'day';
  const listData = useMemo(() => [
    ...bookingItems.map(item => ({ ...item, _type: 'booking' as const })),
    ...(showBlocks && blockedItems.length > 0
      ? [{ _type: 'blocked-header' as const, id: '__blocked_header__' }]
      : []),
    ...(showBlocks ? blockedItems.map(item => ({ ...item, _type: 'blocked' as const })) : []),
  ], [bookingItems, blockedItems, showBlocks]);

  // Statistics — always derived from periodItems (period-aware)
  const stats = useMemo(() => {
    const periodRealBookings = periodItems.filter((r) => !(r as any).notes?.includes('CR\u00c9NEAU BLOQU\u00c9'));
    const nowAlgS  = new Date(Date.now() + 60 * 60 * 1000);
    const nowStrS  = `${String(nowAlgS.getUTCHours()).padStart(2, '0')}:${String(nowAlgS.getUTCMinutes()).padStart(2, '0')}`;
    const todayAlg = `${nowAlgS.getUTCFullYear()}-${String(nowAlgS.getUTCMonth()+1).padStart(2,'0')}-${String(nowAlgS.getUTCDate()).padStart(2,'0')}`;
    const total = periodRealBookings.filter((r) =>
      r.status === 'Completed' || r.status === 'Confirmed'
    ).length;
    const pending = periodRealBookings.filter((r) => {
      if (r.status !== 'Pending') return false;
      const apptDate = (r.appointment_date as string) ?? '';
      const endTime  = (r.end_time ?? '').slice(0, 5);
      return !(apptDate < todayAlg || (apptDate === todayAlg && !!endTime && endTime < nowStrS));
    }).length;
    const revenue = periodRealBookings
      .filter((r) => r.status === 'Completed' || r.status === 'Confirmed')
      .reduce((sum, r) => { const svc = (r as any).services; return sum + ((svc?.price as number) ?? 0); }, 0);
    return { total, pending, revenue };
  }, [periodItems]);


  // Update status mutation
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiClient.patch(`/reservations/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barber-reservations'] });
    },
    onError: (error: any) => {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: error.message || t('barber.cancel_reservation_failed')
      });
    }
  });

  // Unblock time mutation
  const unblockTime = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/reservations/block/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barber-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      Toast.show({
        type: 'success',
        text1: t('common.success'),
        text2: t('barber.slot_unblocked')
      });
    },
    onError: (error: any) => {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: error.message || t('barber.unblock_failed')
      });
    },
  });

  // Auto-delete expired blocked slots (silently in the background)
  useEffect(() => {
    if (!salonId || allItems.length === 0) return;
    const nowAlg  = new Date(Date.now() + 60 * 60 * 1000);
    const nowStr  = `${String(nowAlg.getUTCHours()).padStart(2,'0')}:${String(nowAlg.getUTCMinutes()).padStart(2,'0')}`;
    const todayAlg = nowAlg.toISOString().split('T')[0];

    const expiredBlocks = allItems.filter((r) => {
      if (!(r as any).notes?.includes('CR\u00c9NEAU BLOQU\u00c9')) return false;
      const apptDate = (r.appointment_date as string) ?? '';
      const endTime  = (r.end_time ?? '').slice(0, 5);
      return apptDate < todayAlg || (apptDate === todayAlg && !!endTime && endTime < nowStr);
    });

    if (expiredBlocks.length === 0) return;

    // Fire-and-forget: delete each expired block from DB
    Promise.all(
      expiredBlocks.map((block) =>
        apiClient.delete(`/reservations/block/${block.id}`).catch(() => {})
      )
    ).then(() => {
      // Refresh cache after cleanup
      queryClient.invalidateQueries({ queryKey: ['barber-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['slots'] });
    });
  }, [allItems, salonId]);

  const handleConfirm = useCallback((id: string) => {
    Alert.alert(t('barber.confirm_title'), t('barber.confirm_question'), [
      { text: t('common.no'), style: 'cancel' },
      {
        text: t('barber.confirm_yes'),
        onPress: () => {
          updateStatus.mutate({ id, status: 'Confirmed' });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        },
      },
    ]);
  }, [updateStatus, t]);

  const handleCancel = useCallback((id: string) => {
    Alert.alert(t('barber.confirm_title'), t('barber.confirm_question'), [
      { text: t('common.no'), style: 'cancel' },
      {
        text: t('common.cancel'),
        style: 'destructive',
        onPress: () => updateStatus.mutate({ id, status: 'Cancelled' }),
      },
    ]);
  }, [updateStatus, t]);

  const handleComplete = useCallback((id: string) => {
    Alert.alert(t('barber.confirm_title'), t('barber.confirm_question'), [
      { text: t('common.no'), style: 'cancel' },
      {
        text: t('common.yes'),
        onPress: () => {
          updateStatus.mutate({ id, status: 'Completed' });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        },
      },
    ]);
  }, [updateStatus, t]);

  const toggleSalonStatus = useMutation({
    mutationFn: async (isClosed: boolean) => {
      await apiClient.patch(`/salons/${salonId}`, { is_manually_closed: isClosed });
    },
    onSuccess: () => {
      // Use the canonical query key shared by all screens so the status is
      // immediately reflected in the header badge without a manual refresh.
      queryClient.invalidateQueries({ queryKey: ['my-salon', user?.id] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any) => {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: error.message || t('common.error')
      });
    }
  });

  const handleQuickAction = (action: string) => {
    if (action === 'walk-in') {
      setIsWalkInModalVisible(true);
    } else if (action === 'block-time') {
      setIsBlockTimeModalVisible(true);
    } else {
      Toast.show({
        type: 'info',
        text1: t('barber.action_management'),
        text2: `"${action}" ${t('barber.action_soon')}`
      });
    }
  };

  const renderHeader = () => {
    const barberName = user?.user_metadata?.full_name?.split(' ')[0] || t('barber.name_fallback');
    const avatarUrl = user?.user_metadata?.avatar_url || DEFAULT_AVATAR;

    return (
      <View style={styles.dashboardHeader}>
        {/* Profile and Greeting Title bar */}
        <View style={styles.topProfileBar}>
          <View style={styles.profileMeta}>
            <Image source={{ uri: avatarUrl }} style={styles.profileThumb} />
            <View style={{ flex: 1 }}>
              <Text style={styles.greetingTitle} numberOfLines={1}>{t('barber.greeting')}, {barberName} 👋</Text>
              <Text style={styles.salonNameSub} numberOfLines={1}>{(salon?.name as string) || t('barber.my_salon_fallback')}</Text>
            </View>
            <NotificationBell />
          </View>
          <TouchableOpacity
            style={[
              styles.statusToggleButton,
              (salon?.status_label === 'open' || salon?.status_label === 'open_24h') && styles.statusOpen,
              salon?.status_label === 'closed' && styles.statusClosed,
              salon?.status_label === 'manually_closed' && styles.statusWarning,
            ]}
            onPress={() => toggleSalonStatus.mutate(!salon?.is_manually_closed)}
            disabled={toggleSalonStatus.isPending}
            activeOpacity={0.8}
          >
            {toggleSalonStatus.isPending ? (
              <ActivityIndicator color={colors.ink} size="small" />
            ) : (
              <>
                <View style={[styles.statusToggleDot, { backgroundColor: colors.ink }]} />
                <Text style={styles.statusToggleText}>
                  {salon?.status_label === 'open_24h' ? t('barber.status_open_24h') :
                   salon?.status_label === 'open' ? t('barber.status_open') :
                   salon?.status_label === 'manually_closed' ? t('barber.status_closed_temp') : t('barber.status_closed')}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* HIGH-3: Onboarding Completeness Checklist
             Shown when the salon exists but is not yet complete.
             Lists every missing requirement with tappable deep-links. */}
        {Boolean(salon && !isComplete) && (() => {
          // Derive missing items as a list of { label, tab, screen } descriptors
          const missingItems: Array<{ label: string; icon: string; onPress: () => void }> = [];
          if (!salon?.image_url) missingItems.push({ label: t('barber.missing_photo'), icon: 'image-outline', onPress: () => navigation.navigate('Mon Salon' as never) });
          if (!salon?.description) missingItems.push({ label: t('barber.missing_description'), icon: 'document-text-outline', onPress: () => navigation.navigate('Mon Salon' as never) });
          if (!salon?.commune) missingItems.push({ label: t('barber.missing_commune'), icon: 'location-outline', onPress: () => navigation.navigate('SalonSetup' as never) });
          if (!hasServices) missingItems.push({ label: t('barber.missing_service'), icon: 'cut-outline', onPress: () => navigation.navigate('Mon Salon' as never) });
          if (!hasBarbers) missingItems.push({ label: t('barber.missing_barber'), icon: 'person-add-outline', onPress: () => navigation.navigate('Mon Salon' as never) });
          const photos = salon?.portfolio_photos as unknown[] | undefined;
          if (!photos || photos.length === 0) missingItems.push({ label: t('barber.missing_portfolio'), icon: 'images-outline', onPress: () => navigation.navigate('Mon Salon' as never) });

          if (missingItems.length === 0) return null;
          return (
            <View style={{ backgroundColor: 'rgba(239,68,68,0.07)', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: 'rgba(239,68,68,0.18)' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                <Ionicons name="alert-circle" size={20} color="#EF4444" />
                <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 14, color: '#EF4444', flex: 1 }}>
                  {t('barber.salon_incomplete_title')}
                </Text>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: colors.textMuted }}>
                  {missingItems.length}
                </Text>
              </View>
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm, lineHeight: 17 }}>
                {t('barber.salon_incomplete_body')}
              </Text>
              {missingItems.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 9, borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: 'rgba(255,255,255,0.05)' }}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                >
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(239,68,68,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={item.icon as any} size={15} color="#EF4444" />
                  </View>
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: colors.textPrimary, flex: 1 }}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          );
        })()}

        {/* Salon Closed Banner */}
        {Boolean(salon?.is_manually_closed) && (
          <View style={{ backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: radius.md, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <Ionicons name="close-circle" size={20} color="#EF4444" />
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#EF4444', flex: 1 }}>{t('barber.salon_closed_banner')}</Text>
          </View>
        )}

        {/* Salon Approval Pending Banner */}
        {salon && !salon.is_approved && (
          <View style={styles.approvalBanner}>
            <Ionicons name="time-outline" size={16} color={colors.amber} />
            <Text style={styles.approvalText}>
              {t('barber.approval_pending')}
            </Text>
          </View>
        )}

        {/* Bento Stats Grid */}
        <View style={styles.bentoContainer}>
          <View style={styles.bentoRow}>
            {/* Today's Bookings */}
            <View style={styles.bentoItem}>
              <Ionicons name="calendar" size={24} color={colors.amber} style={styles.bentoIcon} />
              <View>
                <Text style={styles.bentoLabel}>{t('barber.stats_appointments')}</Text>
                <Text style={styles.bentoValue}>{stats.total}</Text>
              </View>
            </View>

            {/* Pending Requests */}
            <View style={styles.bentoItem}>
              <Ionicons name="hourglass" size={24} color={colors.warning} style={styles.bentoIcon} />
              <View>
                <Text style={styles.bentoLabel}>{t('barber.filter_pending')}</Text>
                <Text style={[styles.bentoValue, { color: colors.warning }]}>{stats.pending}</Text>
              </View>
            </View>
          </View>

          {/* Daily Revenue (Wide card) */}
          <View style={styles.bentoWideItem}>
            <Ionicons name="wallet" size={26} color={colors.success} style={styles.bentoIconWide} />
            <View>
              <Text style={styles.bentoLabel}>{t('barber.stats_revenue')} ({revenuePeriodLabel})</Text>
              <Text style={[styles.bentoValue, { color: colors.success }]}>
                {formatDZD(stats.revenue)}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Shop Management Actions */}
        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionHeaderTitle}>{t('barber.manage_salon')}</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => handleQuickAction('walk-in')}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={24} color={colors.amber} />
              <Text style={styles.actionCardText}>{t('barber.add_walkin')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => handleQuickAction('block-time')}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={24} color={colors.amber} />
              <Text style={styles.actionCardText}>{t('barber.block_hours')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Period mode selector */}
        <View style={styles.periodModeRow}>
          {(['day', 'month', 'all'] as const).map((mode) => {
            const label = mode === 'day' ? t('barber.period_day') : mode === 'month' ? t('barber.period_month') : t('barber.period_all');
            return (
              <TouchableOpacity
                key={mode}
                style={[styles.periodModeBtn, viewMode === mode && styles.periodModeBtnActive]}
                onPress={() => setViewMode(mode)}
                activeOpacity={0.75}
              >
                <Text style={[styles.periodModeBtnText, viewMode === mode && styles.periodModeBtnTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Date / Month navigation */}
        {viewMode === 'day' && (
          <View style={styles.dateNavRow}>
            <TouchableOpacity style={styles.navArrowBtn} onPress={goToPrevDay} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dateNavLabel}
              onPress={() => setViewDate(today())}
              activeOpacity={0.7}
            >
              <Text style={styles.dateNavLabelText}>{periodLabel}</Text>
              {viewDate !== today() && (
                <Text style={styles.dateNavReturnHint}>{t('barber.return_today')}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.navArrowBtn} onPress={goToNextDay} activeOpacity={0.7}>
              <Ionicons name="chevron-forward" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        )}
        {viewMode === 'month' && (
          <View style={styles.dateNavRow}>
            <TouchableOpacity style={styles.navArrowBtn} onPress={goToPrevMonth} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.dateNavLabel}>
              <Text style={styles.dateNavLabelText}>{periodLabel}</Text>
            </View>
            <TouchableOpacity style={styles.navArrowBtn} onPress={goToNextMonth} activeOpacity={0.7}>
              <Ionicons name="chevron-forward" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        )}
        {viewMode === 'all' && (
          <View style={styles.dateNavRowCenter}>
            <Text style={styles.dateNavLabelText}>{t('barber.all_history')}</Text>
          </View>
        )}

        <View style={styles.filterRow}>
          {(
            [
              { key: 'all',       label: t('barber.filter_all') },
              { key: 'Confirmed', label: t('barber.filter_confirmed') },
              { key: 'Pending',   label: t('barber.filter_pending') },
              { key: 'Completed', label: t('barber.filter_completed') },
              { key: 'Cancelled', label: t('status.cancelled') },
            ] as const
          ).map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.filterBtn, selectedFilter === key && styles.filterBtnActive]}
              onPress={() => setSelectedFilter(key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterBtnText, selectedFilter === key && styles.filterBtnTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const handleUnblock = useCallback((id: string) => {
    Alert.alert(
      t('barber.confirm_title'),
      t('barber.confirm_question'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: () => unblockTime.mutate(id),
        },
      ]
    );
  }, [unblockTime, t]);

  // Render a CRÉNEAU BLOQUÉ item as a distinct locked card
  const renderBlockedItem = ({ item }: { item: Record<string, unknown> }) => (
    <View style={styles.blockedCard}>
      <View style={styles.blockedLeft}>
        <View style={styles.blockedIconWrap}>
          <Ionicons name="lock-closed" size={20} color={colors.amber} />
        </View>
        <View>
          <Text style={styles.blockedLabel}>{t('barber.slot_blocked')}</Text>
          <Text style={styles.blockedTime}>
            {formatTime(item.start_time as string)} – {formatTime(item.end_time as string)}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.unblockBtn}
        onPress={() => handleUnblock(item.id as string)}
        activeOpacity={0.8}
        disabled={unblockTime.isPending}
      >
        {unblockTime.isPending ? (
          <ActivityIndicator size="small" color={colors.ink} />
        ) : (
          <>
            <Ionicons name="lock-open-outline" size={14} color={colors.ink} />
            <Text style={styles.unblockBtnText}>{t('barber.unblock')}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderBookingItem = ({ item }: { item: Record<string, unknown> }) => {
    const client = item.profiles as Record<string, unknown> | undefined;
    const service = item.services as Record<string, unknown> | undefined;

    // Client-side expired check — Algeria date (UTC+1) to fix midnight edge case
    const nowAlg = new Date(Date.now() + 60 * 60 * 1000);
    const nowStr = `${String(nowAlg.getUTCHours()).padStart(2, '0')}:${String(nowAlg.getUTCMinutes()).padStart(2, '0')}`;
    // Derive today's date in Algeria time (NOT UTC)
    const todayAlg = `${nowAlg.getUTCFullYear()}-${String(nowAlg.getUTCMonth()+1).padStart(2,'0')}-${String(nowAlg.getUTCDate()).padStart(2,'0')}`;
    const endTime  = (item.end_time as string ?? '').slice(0, 5);
    const apptDate = (item.appointment_date as string ?? '');
    const isExpired = (
      apptDate < todayAlg ||   // reservation is from a past Algeria-date
      (apptDate === todayAlg && endTime && endTime < nowStr) // today + time passed
    );
    const isExpiredConfirmed = isExpired && item.status === 'Confirmed';
    const isExpiredPending   = isExpired && item.status === 'Pending';

    // Effective status for display
    const effectiveStatus = isExpiredConfirmed ? 'Completed'
      : isExpiredPending ? 'Cancelled'
      : item.status;

    const isPending   = effectiveStatus === 'Pending';
    const isConfirmed = effectiveStatus === 'Confirmed';
    const isCancelled = effectiveStatus === 'Cancelled';
    const isCompleted = effectiveStatus === 'Completed';

    const isWalkIn = item.is_walk_in === true;
    let displayClientName: string = (client?.full_name as string) || '';
    if (isWalkIn && item.notes) {
      const match = (item.notes as string).match(/Client:\s*(.*?)(?:\s*-\s*Tel:|\s*\n|$)/);
      if (match && match[1]) {
        displayClientName = match[1].trim();
      }
    }
    if (!displayClientName || displayClientName.trim() === '') {
      displayClientName = (item.client_phone as string) || (client?.phone_number as string) || t('barber.unknown_client');
    }

    let borderLeftColor: string = colors.steel;
    if (isPending)   borderLeftColor = colors.pending;
    if (isConfirmed) borderLeftColor = colors.success;
    if (isCancelled) borderLeftColor = colors.error;

    return (
      <TouchableOpacity 
        style={[styles.bookingCard, { borderLeftColor }]} 
        onPress={() => setSelectedReservation(item as unknown as Reservation)}
        activeOpacity={0.8}
      >
        <View style={styles.cardLeftBlock}>
          <Image
            source={{ uri: (client?.avatar_url as string) || 'https://phfwutugsyiutqgippqg.supabase.co/storage/v1/object/public/portfolio/defaults/default-avatar.png' }}
            style={styles.clientAvatar}
          />
          <View style={styles.bookingDetails}>
            <Text style={styles.clientName}>{displayClientName}</Text>
            <Text style={styles.serviceName}>
              {(service?.service_name as string) || t('barber.service_fallback')} • {item.salon_staff ? ((item.salon_staff as Record<string,unknown>).custom_name as string || ((item.salon_staff as Record<string,unknown>).profiles as Record<string,unknown>)?.full_name as string) : t('barber.any_barber')}
            </Text>
            <Text style={styles.bookingTime}>
              ⏱️ {formatTime(item.start_time as string)} – {formatTime(item.end_time as string)}
            </Text>
          </View>
        </View>

        <View style={styles.cardRightBlock}>
          {isPending ? (
            <View style={styles.pendingActionButtons}>
              <TouchableOpacity
                style={styles.iconConfirmBtn}
                onPress={() => handleConfirm(item.id as string)}
                activeOpacity={0.7}
              >
                <Ionicons name="checkmark" size={16} color={colors.ink} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconCancelBtn}
                onPress={() => handleCancel(item.id as string)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={16} color={colors.ink} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <View style={[
                styles.statusBadge,
                isConfirmed && styles.badgeConfirmed,
                isCancelled && styles.badgeCancelled,
                isCompleted && styles.badgeCompleted,
              ]}>
                <Text style={[
                  styles.statusBadgeText,
                  isConfirmed && styles.textConfirmed,
                  isCancelled && styles.textCancelled,
                  isCompleted && styles.textCompleted,
                ]}>
                  {isConfirmed ? t('status.confirmed') : isCancelled ? t('status.cancelled') : isCompleted ? t('status.completed') : item.status as string}
                </Text>
              </View>
              {isConfirmed && (
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(139,92,246,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm }}
                  onPress={() => handleComplete(item.id as string)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="checkmark-done" size={12} color="#8B5CF6" />
                  <Text style={{ fontFamily: 'DMSans_600SemiBold', fontSize: 10, color: '#8B5CF6' }}>{t('barber.mark_done')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (isSalonLoading || isBookingsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.amber} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={listData as any[]}
        keyExtractor={(item) => item.id}
        initialNumToRender={8}
        windowSize={5}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        renderItem={({ item }) => {
          if (item._type === 'blocked-header') {
            return (
              <View style={styles.blockedSectionHeader}>
                <Ionicons name="lock-closed" size={14} color={colors.amber} />
                <Text style={styles.blockedSectionTitle}>{t('barber.slots_blocked_header')}</Text>
              </View>
            );
          }
          if (item._type === 'blocked') return renderBlockedItem({ item });
          return renderBookingItem({ item });
        }}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        onRefresh={refetch}
        refreshing={isBookingsLoading}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>{t('barber.no_reservations')}</Text>
            <Text style={styles.emptySubtitle}>
              {t('barber.reservations_title')}
            </Text>
          </View>
        }
      />

      {salonId && (
        <AddWalkInModal
          visible={isWalkInModalVisible}
          onClose={() => setIsWalkInModalVisible(false)}
          salonId={salonId as string}
          onSuccess={() => refetch()}
        />
      )}

      <ReservationDetailModal
        visible={!!selectedReservation}
        onClose={() => setSelectedReservation(null)}
        reservation={selectedReservation as unknown as Record<string, unknown>}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
        onComplete={handleComplete}
      />

      <BlockTimeModal
        visible={isBlockTimeModalVisible}
        onClose={() => setIsBlockTimeModalVisible(false)}
        salonId={salonId}
        onSuccess={() => {
          refetch();
          Toast.show({
            type: 'success',
            text1: t('common.success'),
            text2: t('barber.slot_blocked'),
          });
        }}
      />
    </SafeAreaView>
  );
}

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
  listContainer: {
    paddingBottom: spacing.xxl,
  },
  dashboardHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  topProfileBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  profileMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
    marginRight: spacing.sm,
  },
  profileThumb: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.amber,
  },
  greetingTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 20,
    color: colors.textPrimary,
  },
  salonNameSub: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.amber,
    marginTop: 2,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.carbon,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoContainer: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  approvalBanner: {
    backgroundColor: 'rgba(232,160,32,0.08)',
    borderRadius: radius.md,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(232,160,32,0.25)',
  },
  approvalText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: colors.amber,
    flex: 1,
    lineHeight: 18,
  },
  bentoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bentoItem: {
    flex: 1,
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    gap: spacing.md,
    height: 120,
    justifyContent: 'space-between',
  },
  bentoWideItem: {
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    height: 100,
  },
  bentoIcon: {
    alignSelf: 'flex-start',
  },
  bentoIconWide: {
    alignSelf: 'center',
  },
  bentoLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  bentoValue: {
    fontFamily: 'Syne_700Bold',
    fontSize: 24,
    color: colors.amber,
    marginTop: 4,
  },
  walkInIcon: {
    marginRight: spacing.sm,
  },
  statusToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusOpen: {
    backgroundColor: colors.success,
  },
  statusClosed: {
    backgroundColor: colors.error,
  },
  statusWarning: {
    backgroundColor: colors.warning,
  },
  statusToggleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusToggleText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 10,
    color: colors.ink,
  },
  quickActionsContainer: {
    marginBottom: spacing.xl,
  },
  sectionHeaderTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 90,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  actionCardText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    color: colors.textPrimary,
  },
  bookingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderLeftWidth: 4,
  },
  cardLeftBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  clientAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.graphite,
  },
  bookingDetails: {
    flex: 1,
  },
  clientName: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: colors.textPrimary,
  },
  serviceName: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  bookingTime: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
    color: colors.amber,
    marginTop: 4,
  },
  cardRightBlock: {
    alignItems: 'flex-end',
  },
  pendingActionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconConfirmBtn: {
    backgroundColor: colors.success,
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCancelBtn: {
    backgroundColor: colors.error,
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  badgeConfirmed: {
    backgroundColor: 'rgba(46, 204, 113, 0.1)',
    borderColor: 'rgba(46, 204, 113, 0.2)',
  },
  badgeCancelled: {
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderColor: 'rgba(231, 76, 60, 0.2)',
  },
  badgeCompleted: {
    backgroundColor: 'rgba(90, 90, 90, 0.1)',
    borderColor: 'rgba(90, 90, 90, 0.2)',
  },
  statusBadgeText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  textConfirmed: {
    color: colors.success,
  },
  textCancelled: {
    color: colors.error,
  },
  textCompleted: {
    color: colors.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    fontFamily: 'Syne_600SemiBold',
    fontSize: 16,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xl,
  },
  // ── Filter buttons ────────────────────────────────────────────────────────
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  filterBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: colors.carbon,
  },
  filterBtnActive: {
    backgroundColor: colors.amber,
    borderColor: colors.amber,
  },
  filterBtnText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
  },
  filterBtnTextActive: {
    color: colors.ink,
    fontFamily: 'DMSans_700Bold',
  },
  // ── Blocked time slot card ───────────────────────────────────────────────
  blockedSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  blockedSectionTitle: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 12,
    color: colors.amber,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  blockedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(232, 160, 32, 0.06)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(232, 160, 32, 0.2)',
    borderLeftWidth: 3,
    borderLeftColor: colors.amber,
  },
  blockedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  blockedIconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: 'rgba(232, 160, 32, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
    color: colors.amber,
    marginBottom: 2,
  },
  blockedTime: {
    fontFamily: 'Syne_700Bold',
    fontSize: 15,
    color: colors.textPrimary,
  },
  unblockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.error,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderRadius: radius.sm,
  },
  unblockBtnText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
    color: colors.ink,
  },
  // ── Period mode selector ─────────────────────────────────────────────────
  periodModeRow: {
    flexDirection: 'row',
    backgroundColor: colors.carbon,
    borderRadius: radius.md,
    padding: 3,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  periodModeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center' as const,
    borderRadius: radius.sm,
  },
  periodModeBtnActive: {
    backgroundColor: colors.amber,
  },
  periodModeBtnText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
  },
  periodModeBtnTextActive: {
    color: colors.ink,
  },
  // ── Date / Month navigation ──────────────────────────────────────────────
  dateNavRow: {
    flexDirection: 'row',
    alignItems: 'center' as const,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  dateNavRowCenter: {
    alignItems: 'center' as const,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
  },
  navArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.carbon,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  dateNavLabel: {
    flex: 1,
    alignItems: 'center' as const,
    paddingVertical: spacing.xs,
  },
  dateNavLabelText: {
    fontFamily: 'Syne_700Bold',
    fontSize: 14,
    color: colors.textPrimary,
    textTransform: 'capitalize' as const,
  },
  dateNavReturnHint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 10,
    color: colors.amber,
    marginTop: 2,
  },
});
