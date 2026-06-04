// apps/mobile/src/screens/barber/DashboardScreen.tsx
// Barber's first screen — today's stats + live booking feed

import React, { useState, useMemo, useCallback } from 'react';
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

const DEFAULT_AVATAR = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDqBwevJA_-4C8CiV0jhFk0kQ1wMed3SXsDLtkuYojI_z1NOOr9TsG1ppWseymOF1jEuEUK3KfQn_lUckAbPgmIaSRhgIECSEyCop0h_moZW-TI7--iKZxYbB5dZpkgKIpdJVPPVXhmU_beflYOnLuUI7k4eAbhpYAKJUc2JV4h2TvxiIWmmNqIissEk6ErNlsy-GNvPrX3FNFYIJAjGjQyRcvhURmAzdffu9vrnoRvuq2K4ncxHaDMjasu4zspMlyphP4AOIGdHDxi';

export function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [isWalkInModalVisible, setIsWalkInModalVisible] = useState(false);
  const [isBlockTimeModalVisible, setIsBlockTimeModalVisible] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  // Fetch barber's salon
  const { data: salon, isLoading: isSalonLoading } = useQuery({
    queryKey: ['barber-salon', user?.id],
    queryFn: async () => {
      if (!user) return null;
      return apiClient.get('/salons/my-salon');
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const salonId = salon?.id ?? null;

  // Fetch today's bookings with server-side date filter
  const { data: todaysBookings = [], isLoading: isBookingsLoading, refetch } = useQuery<Reservation[]>({
    queryKey: ['barber-reservations', salonId, today()],
    queryFn: async () => {
      if (!salonId) return [];
      // Use server-side date filter to avoid downloading all reservations
      const data = await apiClient.get<Reservation[]>(`/reservations/salon/${salonId}?date=${today()}`);
      return data;
    },
    enabled: !!salonId,
  });

  // Realtime subscription — invalidates cache automatically via useRealtimeBookings hook
  useRealtimeBookings({
    salonId,
    onNewBooking: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  // Separate blocks from real reservations
  const allItems = useMemo(() => {
    return [...todaysBookings].sort((a, b) =>
      b.start_time.localeCompare(a.start_time)
    );
  }, [todaysBookings]);

  // Current Algeria time (UTC+1) in "HH:MM" — used to hide past reservations instantly
  const nowTimeStr = useMemo(() => {
    const algeriaTime = new Date(Date.now() + 60 * 60 * 1000);
    return `${String(algeriaTime.getUTCHours()).padStart(2, '0')}:${String(algeriaTime.getUTCMinutes()).padStart(2, '0')}`;
  }, []); // computed once on mount; dashboard is for TODAY so this is fine

  const blockedItems = useMemo(
    () => allItems.filter((r) => (r as any).notes?.includes('CRÉNEAU BLOQUÉ')),
    [allItems],
  );

  const bookingItems = useMemo(
    () =>
      allItems.filter((r) => {
        if ((r as any).notes?.includes('CRÉNEAU BLOQUÉ')) return false;
        if (r.status === 'Completed' || r.status === 'Cancelled') return false;
        // Hide reservations whose end_time has already passed — no action needed
        const endTime = (r.end_time ?? '').slice(0, 5); // "HH:MM"
        if (endTime && endTime < nowTimeStr) return false;
        return true;
      }),
    [allItems, nowTimeStr],
  );

  // Combine for FlatList: active bookings first, then blocked slots at the bottom
  const listData = useMemo(() => [
    ...bookingItems.map(item => ({ ...item, _type: 'booking' as const })),
    ...(blockedItems.length > 0 ? [{ _type: 'blocked-header' as const, id: '__blocked_header__' }] : []),
    ...blockedItems.map(item => ({ ...item, _type: 'blocked' as const })),
  ], [bookingItems, blockedItems]);

  // Statistics — exclude blocks from counts
  const stats = useMemo(() => {
    const active = bookingItems.filter((r) => r.status === 'Confirmed' || r.status === 'Pending');
    const pending = bookingItems.filter((r) => r.status === 'Pending');
    const revenue = bookingItems
      .filter((r) => r.status === 'Completed' || r.status === 'Confirmed')
      .reduce((sum, r) => {
        const svc = (r as Record<string, unknown>).services as Record<string, unknown> | undefined;
        return sum + ((svc?.price as number) ?? 0);
      }, 0);
    return { total: active.length, pending: pending.length, revenue };
  }, [bookingItems]);

  // Update status mutation
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiClient.patch(`/reservations/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barber-reservations'] });
    },
    onError: (error: any) => {
      Alert.alert('Erreur', error.message || 'Impossible d\'annuler la réservation');
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
      Alert.alert('Succès', 'Le créneau a été débloqué ✅');
    },
    onError: (error: any) => {
      Alert.alert('Erreur', error.message || 'Impossible de débloquer ce créneau');
    },
  });

  const handleConfirm = useCallback((id: string) => {
    Alert.alert('Confirmer ?', 'Voulez-vous accepter ce rendez-vous ?', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui, confirmer',
        onPress: () => {
          updateStatus.mutate({ id, status: 'Confirmed' });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        },
      },
    ]);
  }, [updateStatus]);

  const handleCancel = useCallback((id: string) => {
    Alert.alert('Annuler la réservation ?', 'Cette action notifiera le client.', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui, annuler',
        style: 'destructive',
        onPress: () => updateStatus.mutate({ id, status: 'Cancelled' }),
      },
    ]);
  }, [updateStatus]);

  const toggleSalonStatus = useMutation({
    mutationFn: async (forceClosed: boolean) => {
      await apiClient.patch(`/salons/${salonId}`, { force_closed: forceClosed });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barber-salon'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error) => {
      Alert.alert('Erreur', error.message);
    }
  });

  const handleQuickAction = (action: string) => {
    if (action === 'walk-in') {
      setIsWalkInModalVisible(true);
    } else if (action === 'block-time') {
      setIsBlockTimeModalVisible(true);
    } else {
      Alert.alert('Gestion du salon', `L'action "${action}" sera bientôt disponible.`);
    }
  };

  const renderHeader = () => {
    const barberName = user?.user_metadata?.full_name?.split(' ')[0] || 'Ahmed';
    const avatarUrl = user?.user_metadata?.avatar_url || DEFAULT_AVATAR;

    return (
      <View style={styles.dashboardHeader}>
        {/* Profile and Greeting Title bar */}
        <View style={styles.topProfileBar}>
          <View style={styles.profileMeta}>
            <Image source={{ uri: avatarUrl }} style={styles.profileThumb} />
            <View style={{ flex: 1 }}>
              <Text style={styles.greetingTitle} numberOfLines={1}>Bonjour, {barberName} 👋</Text>
              <Text style={styles.salonNameSub} numberOfLines={1}>{salon?.name || 'Mon salon coiffeur'}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.statusToggleButton, salon?.force_closed ? styles.statusClosed : styles.statusOpen]}
            onPress={() => toggleSalonStatus.mutate(!salon?.force_closed)}
            disabled={toggleSalonStatus.isPending}
            activeOpacity={0.8}
          >
            {toggleSalonStatus.isPending ? (
              <ActivityIndicator color={colors.ink} size="small" />
            ) : (
              <>
                <View style={[styles.statusToggleDot, { backgroundColor: colors.ink }]} />
                <Text style={styles.statusToggleText}>
                  {salon?.force_closed ? 'Fermé' : 'Ouvert'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Bento Stats Grid */}
        <View style={styles.bentoContainer}>
          <View style={styles.bentoRow}>
            {/* Today's Bookings */}
            <View style={styles.bentoItem}>
              <Ionicons name="calendar" size={24} color={colors.amber} style={styles.bentoIcon} />
              <View>
                <Text style={styles.bentoLabel}>Réservations</Text>
                <Text style={styles.bentoValue}>{stats.total}</Text>
              </View>
            </View>

            {/* Pending Requests */}
            <View style={styles.bentoItem}>
              <Ionicons name="hourglass" size={24} color={colors.warning} style={styles.bentoIcon} />
              <View>
                <Text style={styles.bentoLabel}>En attente</Text>
                <Text style={[styles.bentoValue, { color: colors.warning }]}>{stats.pending}</Text>
              </View>
            </View>
          </View>

          {/* Daily Revenue (Wide card) */}
          <View style={styles.bentoWideItem}>
            <Ionicons name="wallet" size={26} color={colors.success} style={styles.bentoIconWide} />
            <View>
              <Text style={styles.bentoLabel}>Revenus estimés (Jour)</Text>
              <Text style={[styles.bentoValue, { color: colors.success }]}>
                {formatDZD(stats.revenue)}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Shop Management Actions */}
        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionHeaderTitle}>Gestion du Salon</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => handleQuickAction('walk-in')}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={24} color={colors.amber} />
              <Text style={styles.actionCardText}>Ajouter sans RDV</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => handleQuickAction('block-time')}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={24} color={colors.amber} />
              <Text style={styles.actionCardText}>Bloquer heures</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionHeaderTitle}>Réservations du Jour</Text>
      </View>
    );
  };

  const handleUnblock = useCallback((id: string) => {
    Alert.alert(
      '🔓 Débloquer ce créneau ?',
      'Le créneau redeviendra disponible pour les clients.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Débloquer',
          style: 'destructive',
          onPress: () => unblockTime.mutate(id),
        },
      ]
    );
  }, [unblockTime]);

  // Render a CRÉNEAU BLOQUÉ item as a distinct locked card
  const renderBlockedItem = ({ item }: { item: Record<string, unknown> }) => (
    <View style={styles.blockedCard}>
      <View style={styles.blockedLeft}>
        <View style={styles.blockedIconWrap}>
          <Ionicons name="lock-closed" size={20} color={colors.amber} />
        </View>
        <View>
          <Text style={styles.blockedLabel}>Créneau bloqué</Text>
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
            <Text style={styles.unblockBtnText}>Débloquer</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderBookingItem = ({ item }: { item: Record<string, unknown> }) => {
    const client = item.profiles;
    const service = item.services;

    const isPending = item.status === 'Pending';
    const isConfirmed = item.status === 'Confirmed';
    const isCancelled = item.status === 'Cancelled';
    const isCompleted = item.status === 'Completed';

    const isWalkIn = item.notes?.includes('[Sans RDV]');
    let displayClientName = client?.full_name;
    if (isWalkIn && item.notes) {
      const match = item.notes.match(/Client:\s*(.*?)(?:\s*-\s*Tel:|\s*\n|$)/);
      if (match && match[1]) {
        displayClientName = match[1].trim();
      }
    }
    if (!displayClientName || displayClientName.trim() === '') {
      displayClientName = item.client_phone || client?.phone_number || 'Client Inconnu';
    }

    let borderLeftColor: string = colors.steel;
    if (isPending) borderLeftColor = colors.pending;
    if (isConfirmed) borderLeftColor = colors.success;
    if (isCancelled) borderLeftColor = colors.error;

    return (
      <TouchableOpacity 
        style={[styles.bookingCard, { borderLeftColor }]} 
        onPress={() => setSelectedReservation(item)}
        activeOpacity={0.8}
      >
        <View style={styles.cardLeftBlock}>
          <Image
            source={{ uri: client?.avatar_url || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDhsTHtiP3Z4tCtsj3LGHwYS5xdJSlpMbLr-LvZld6LDrXErLk7k8pnjAS32G_HSNI0P2IuYAfQwpOp6Wr_9ufZKN6Klf7rxMQhmAnJmKwnPZIuuttQO7lWVDMWVmvbYLskVk5Ocfp_zGhXguCLwBCGAf8i0IbCjWKcjYkjEhCD3lEeJlMSlIAkiPwLvg1yvPehfA1FUh8sJwyUIeVjhtiKmRuyLFwa9Jo3HVhFr1t6_hj4T5WdrFjZki5vffu7I-q1rZHS5Owb9XUe' }}
            style={styles.clientAvatar}
          />
          <View style={styles.bookingDetails}>
            <Text style={styles.clientName}>{displayClientName}</Text>
            <Text style={styles.serviceName}>
              {service?.service_name || 'Service'} • {item.salon_staff ? (item.salon_staff.custom_name || item.salon_staff.profiles?.full_name) : 'N\'importe quel coiffeur'}
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
                onPress={() => handleConfirm(item.id)}
                activeOpacity={0.7}
              >
                <Ionicons name="checkmark" size={16} color={colors.ink} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconCancelBtn}
                onPress={() => handleCancel(item.id)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={16} color={colors.ink} />
              </TouchableOpacity>
            </View>
          ) : (
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
                {isConfirmed ? 'Confirmé' : isCancelled ? 'Annulé' : isCompleted ? 'Terminé' : item.status}
              </Text>
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
        renderItem={({ item }) => {
          if (item._type === 'blocked-header') {
            return (
              <View style={styles.blockedSectionHeader}>
                <Ionicons name="lock-closed" size={14} color={colors.amber} />
                <Text style={styles.blockedSectionTitle}>Créneaux bloqués</Text>
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
            <Text style={styles.emptyTitle}>Aucune réservation aujourd'hui</Text>
            <Text style={styles.emptySubtitle}>
              Les nouveaux rendez-vous clients apparaîtront ici en temps réel.
            </Text>
          </View>
        }
      />

      {salonId && (
        <AddWalkInModal
          visible={isWalkInModalVisible}
          onClose={() => setIsWalkInModalVisible(false)}
          salonId={salonId}
          onSuccess={() => refetch()}
        />
      )}

      <ReservationDetailModal
        visible={!!selectedReservation}
        onClose={() => setSelectedReservation(null)}
        reservation={selectedReservation}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
      />

      <BlockTimeModal
        visible={isBlockTimeModalVisible}
        onClose={() => setIsBlockTimeModalVisible(false)}
        salonId={salonId}
        onSuccess={() => {
          refetch();
          Alert.alert('Succès', 'Le créneau a été bloqué');
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
});
