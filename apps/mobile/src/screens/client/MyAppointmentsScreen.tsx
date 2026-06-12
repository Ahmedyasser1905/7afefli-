import Toast from 'react-native-toast-message';
// apps/mobile/src/screens/client/MyAppointmentsScreen.tsx
// Client's appointments list — Separated into Upcoming and Past

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { colors, spacing, radius, shadows } from '../../theme';
import Ionicons from "@react-native-vector-icons/ionicons";
import { formatDZD } from '@barberdz/shared/utils/formatters';
import { LeaveReviewModal } from '../../components/client/LeaveReviewModal';
import { cancelAppointmentReminder } from '../../lib/notifications';

// ─── Type definitions ─────────────────────────────────────────────────────────────────────────
interface SalonInfo {
  id: string;
  name: string;
  address: string;
  wilaya: string;
  image_url: string | null;
}

interface ServiceInfo {
  id: string;
  service_name: string;
  price: number;
  duration_minutes: number;
}

interface StaffInfo {
  custom_name: string | null;
  profiles: { full_name: string } | null;
}

interface ReviewInfo {
  id: string;
}

interface ReservationItem {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  salons: SalonInfo | null;
  services: ServiceInfo | null;
  salon_staff: StaffInfo | null;
  reviews: ReviewInfo[] | ReviewInfo | null;
}

const DEFAULT_SALON_IMAGE = 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=300&q=80';

export function MyAppointmentsScreen() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [reviewReservation, setReviewReservation] = useState<ReservationItem | null>(null);

  // Fetch client reservations
  const { data: reservations = [], isLoading, refetch } = useQuery({
    queryKey: ['my-reservations', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const data = await apiClient.get<ReservationItem[]>('/reservations/me');
      return data ?? [];
    },
    enabled: !!user,
    staleTime: 0,
    refetchInterval: 2 * 60 * 1000,
  });

  // RT-2 fix: Realtime subscription — invalidate reservations list when any
  // booking status changes (e.g. Confirmed, Cancelled) so clients see updates
  // without needing to pull-to-refresh.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`client-reservations:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'reservations',
          filter: `client_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['my-reservations', user.id] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  // Cancel reservation mutation
  const cancelMutation = useMutation({
    mutationFn: async (reservationId: string) => {
      await apiClient.patch(`/reservations/${reservationId}/status`, { status: 'Cancelled' });
      return reservationId;
    },
    onSuccess: (reservationId: string) => {
      queryClient.invalidateQueries({ queryKey: ['my-reservations', user?.id] });
      // Cancel any scheduled local reminder for this appointment
      cancelAppointmentReminder(reservationId);
      Toast.show({
        type: 'success',
        text1: 'Succès',
        text2: 'Votre rendez-vous a été annulé.'
      });
    },
    onError: (err: Error) => {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: err.message || 'Impossible d\'annuler le rendez-vous'
      });
    },
  });

  const handleCancelPress = (id: string, name: string) => {
    Alert.alert(
      'Annuler le rendez-vous',
      `Êtes-vous sûr de vouloir annuler votre rendez-vous chez ${name} ?`,
      [
        { text: 'Retour', style: 'cancel' },
        {
          text: 'Annuler le RDV',
          style: 'destructive',
          onPress: () => cancelMutation.mutate(id),
        },
      ]
    );
  };

  // Filter reservations based on active tab — Algeria time (UTC+1)
  const filteredReservations = React.useMemo(() => {
    const algNow = new Date(Date.now() + 60 * 60 * 1000);
    const todayAlg = algNow.toISOString().split('T')[0];
    const nowStr = `${String(algNow.getUTCHours()).padStart(2,'0')}:${String(algNow.getUTCMinutes()).padStart(2,'0')}`;

    return reservations.filter((r: ReservationItem) => {
      const apptDate = r.appointment_date ?? '';
      const endTime  = (r.end_time ?? '').slice(0, 5);
      const isExpired = apptDate < todayAlg || (apptDate === todayAlg && !!endTime && endTime < nowStr);
      // Past = cancelled, completed, OR still-Confirmed/Pending but time has passed
      const effectivelyPast = r.status === 'Cancelled' || r.status === 'Completed' || isExpired;
      return activeTab === 'upcoming' ? !effectivelyPast : effectivelyPast;
    });
  }, [reservations, activeTab]);

  const renderItem = ({ item }: { item: ReservationItem }) => {
    const salon   = item.salons;
    const service = item.services;

    // Visual override: expired Confirmed → Terminé, expired Pending → Annulé
    const algNow   = new Date(Date.now() + 60 * 60 * 1000);
    const nowStr   = `${String(algNow.getUTCHours()).padStart(2,'0')}:${String(algNow.getUTCMinutes()).padStart(2,'0')}`;
    const todayAlg = algNow.toISOString().split('T')[0];
    const apptDate = item.appointment_date ?? '';
    const endTime  = (item.end_time ?? '').slice(0, 5);
    const isExpired = apptDate < todayAlg || (apptDate === todayAlg && !!endTime && endTime < nowStr);
    const effectiveStatus = isExpired && item.status === 'Confirmed' ? 'Completed'
      : isExpired && item.status === 'Pending' ? 'Cancelled'
      : item.status;

    const isPending   = effectiveStatus === 'Pending';
    const isConfirmed = effectiveStatus === 'Confirmed';
    const isCancelled = effectiveStatus === 'Cancelled';
    const isCompleted = effectiveStatus === 'Completed';
    const isUpcoming  = activeTab === 'upcoming';

    const statusLabel: Record<string, string> = {
      Pending:   'En attente',
      Confirmed: 'Confirmé',
      Cancelled: 'Annulé',
      Completed: 'Terminé',
    };

    // Format date: "2026-06-04" → "04 juin 2026"
    const formattedDate = new Date(item.appointment_date + 'T00:00:00')
      .toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    // Format time: "22:40:00" → "22:40"
    const formattedTime = item.start_time?.slice(0, 5) ?? '';

    const displayCover = salon?.image_url || DEFAULT_SALON_IMAGE;

    return (
      <View style={[styles.appointmentCard, isCancelled && styles.cardCancelled]}>
        {/* Status badges */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.salonInfoBlock}>
            <Image source={{ uri: displayCover }} style={styles.salonThumb} />
            <View style={styles.salonTextCol}>
              <Text style={styles.salonName} numberOfLines={1}>
                {salon?.name || 'Salon 7afefli'}
              </Text>
              <Text style={styles.salonAddress} numberOfLines={1}>
                {salon?.address || `${salon?.wilaya}, Algérie`}
              </Text>
            </View>
          </View>

          <View style={[
            styles.statusBadge,
            isConfirmed && styles.statusConfirmed,
            isPending   && styles.statusPending,
            isCancelled && styles.statusCancelled,
            isCompleted && styles.statusCompleted,
          ]}>
            <Text style={[
              styles.statusText,
              isConfirmed && styles.statusConfirmedText,
              isPending   && styles.statusPendingText,
              isCancelled && styles.statusCancelledText,
              isCompleted && styles.statusCompletedText,
            ]}>
              {statusLabel[effectiveStatus] ?? effectiveStatus}
            </Text>
          </View>
        </View>

        {/* Date and Time info block */}
        <View style={styles.detailsBlock}>
          <View style={styles.detailsRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.amber} />
            <Text style={styles.detailsDateText}>
              {formattedDate} à {formattedTime}
            </Text>
          </View>
          
          <View style={styles.detailsRow}>
            <Ionicons name="cut-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.detailsServiceText}>
              {service?.service_name || 'Coupe homme'} • {service?.duration_minutes || 30} min
            </Text>
          </View>

          <View style={styles.detailsRow}>
            <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.detailsServiceText}>
              Coiffeur : {item.salon_staff ? (item.salon_staff.custom_name || item.salon_staff.profiles?.full_name) : 'N\'importe quel coiffeur'}
            </Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Prix payé :</Text>
            <Text style={styles.priceValue}>{service ? formatDZD(service.price) : '0 DZD'}</Text>
          </View>
          
          {item.notes && (
            <View style={[styles.detailsRow, { marginTop: 4, alignItems: 'flex-start' }]}>
              <Ionicons name="call-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.detailsServiceText, { flex: 1 }]}>
                {item.notes}
              </Text>
            </View>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {isUpcoming && !isCancelled && (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => handleCancelPress(item.id, salon?.name || 'le salon')}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
          )}
          {!isUpcoming && effectiveStatus === 'Completed' && (Array.isArray(item.reviews) ? item.reviews.length === 0 : !item.reviews) && (
            <TouchableOpacity
              style={styles.reviewBtn}
              onPress={() => setReviewReservation(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="star" size={16} color={colors.ink} style={{ marginRight: 6 }} />
              <Text style={styles.reviewBtnText}>Évaluer</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar */}
      <View style={styles.headerBar}>
        <Text style={styles.headerLogo}>7afefli</Text>
        <Text style={styles.headerPageTitle}>Mes Rendez-vous</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Mes Réservations</Text>
          <Text style={styles.pageSubtitle}>Gérez vos rendez-vous de coiffure</Text>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
            onPress={() => setActiveTab('upcoming')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>
              À venir
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'past' && styles.activeTab]}
            onPress={() => setActiveTab('past')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'past' && styles.activeTabText]}>
              Passés / Annulés
            </Text>
          </TouchableOpacity>
        </View>

        {/* List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.amber} size="large" />
          </View>
        ) : (
          <FlatList
            data={filteredReservations}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onRefresh={refetch}
            refreshing={isLoading}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="calendar" size={48} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>Aucun rendez-vous</Text>
                <Text style={styles.emptySubtitle}>
                  Vous n'avez pas de rendez-vous dans cette section.
                </Text>
              </View>
            }
          />
        )}
      </View>
      <LeaveReviewModal
        visible={!!reviewReservation}
        onClose={() => setReviewReservation(null)}
        reservation={reviewReservation as unknown as Record<string, unknown>}
        onSuccess={() => refetch()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  headerBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerLogo: {
    fontFamily: 'Syne_700Bold',
    fontSize: 18,
    color: colors.amber,
  },
  headerPageTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: colors.textPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  titleSection: {
    marginBottom: spacing.lg,
  },
  pageTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 26,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.carbon,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  activeTab: {
    backgroundColor: colors.graphite,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  tabText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.amber,
    fontFamily: 'DMSans_700Bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  appointmentCard: {
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: spacing.md,
  },
  cardCancelled: {
    opacity: 0.65,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  salonInfoBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  salonThumb: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.graphite,
  },
  salonTextCol: {
    flex: 1,
  },
  salonName: {
    fontFamily: 'Syne_600SemiBold',
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  salonAddress: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  statusConfirmed: {
    backgroundColor: 'rgba(46, 204, 113, 0.1)',
    borderColor: 'rgba(46, 204, 113, 0.2)',
  },
  statusPending: {
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    borderColor: 'rgba(52, 152, 219, 0.2)',
  },
  statusCancelled: {
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderColor: 'rgba(231, 76, 60, 0.2)',
  },
  statusText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusConfirmedText: {
    color: colors.success,
  },
  statusPendingText: {
    color: colors.pending,
  },
  statusCancelledText: {
    color: colors.error,
  },
  statusCompleted: {
    backgroundColor: 'rgba(90, 90, 90, 0.15)',
    borderColor: 'rgba(90, 90, 90, 0.3)',
  },
  statusCompletedText: {
    color: colors.textMuted,
  },
  detailsBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.03)',
    gap: 8,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailsDateText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
    color: colors.textPrimary,
  },
  detailsServiceText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  priceLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textMuted,
  },
  priceValue: {
    fontFamily: 'Syne_700Bold',
    fontSize: 14,
    color: colors.amber,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.03)',
  },
  cancelBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.error,
  },
  cancelBtnText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: colors.error,
  },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.amber,
  },
  reviewBtnText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
    color: colors.ink,
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
});
