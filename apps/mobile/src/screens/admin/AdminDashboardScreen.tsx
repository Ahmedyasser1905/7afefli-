import Toast from 'react-native-toast-message';
// apps/mobile/src/screens/admin/AdminDashboardScreen.tsx
// Admin dashboard — fully integrated with NestJS backend
// Fixes: radius import, broadcast UI, error states, stats display, double-header removal

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
  Modal,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { colors, spacing, radius, shadows } from '../../theme';
import Ionicons from '@react-native-vector-icons/ionicons';
import { apiClient } from '../../lib/apiClient';
import { NotificationBell } from '../../components/shared/NotificationBell';
import { useNavigation } from '@react-navigation/native';

// ─── Types ───────────────────────────────────────────────────────────────────

type AdminTab = 'salons' | 'users' | 'reservations' | 'analytics' | 'broadcast';

// ─── Component ───────────────────────────────────────────────────────────────

export function AdminDashboardScreen() {
  const queryClient = useQueryClient();
  const navigation = (useNavigation as any)();
  const [activeTab, setActiveTab] = useState<AdminTab>('salons');
  const [selectedUser, setSelectedUser] = useState<Record<string, unknown> | null>(null);

  // Pagination state
  const [salonsPage, setSalonsPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const [resPage, setResPage] = useState(1);

  // Broadcast form
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');

  // ── Data Fetching ─────────────────────────────────────────────────────────

  const {
    data: salonsResponse,
    isLoading: salonsLoading,
    isError: salonsError,
    isRefetching: salonsRefetching,
    refetch: refetchSalons,
  } = useQuery({
    queryKey: ['admin-salons', salonsPage],
    queryFn: () => apiClient.get<any>(`/admin/salons?page=${salonsPage}&limit=20`),
    staleTime: 60_000,
    retry: 2,
  });

  const salons: Record<string, unknown>[] = salonsResponse?.data ?? [];
  const salonsTotalPages = Math.ceil((salonsResponse?.total ?? 0) / 20);

  const {
    data: usersResponse,
    isLoading: usersLoading,
    isError: usersError,
    isRefetching: usersRefetching,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ['admin-users', usersPage],
    queryFn: () => apiClient.get<any>(`/admin/users?page=${usersPage}&limit=20`),
    staleTime: 60_000,
    retry: 2,
  });

  const users: Record<string, unknown>[] = usersResponse?.data ?? [];
  const usersTotalPages = Math.ceil((usersResponse?.total ?? 0) / 20);

  const {
    data: statsData,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useQuery<Record<string, unknown>>({
    queryKey: ['admin-stats'],
    queryFn: () => apiClient.get<Record<string, unknown>>('/admin/stats'),
    staleTime: 60_000,
    retry: 2,
  });

  const {
    data: reservationsResponse,
    isLoading: resLoading,
    isError: resError,
    isRefetching: resRefetching,
    refetch: refetchRes,
  } = useQuery({
    queryKey: ['admin-reservations', resPage],
    queryFn: () => apiClient.get<any>(`/admin/reservations?page=${resPage}&limit=20`),
    staleTime: 60_000,
    enabled: activeTab === 'reservations',
    retry: 2,
  });

  const reservations: Record<string, unknown>[] = reservationsResponse?.data ?? [];
  const resTotalPages = Math.ceil((reservationsResponse?.total ?? 0) / 20);

  const {
    data: analyticsData,
    isLoading: analyticsLoading,
    isError: analyticsError,
    refetch: refetchAnalytics,
  } = useQuery<Record<string, unknown>>({
    queryKey: ['admin-analytics'],
    queryFn: () => apiClient.get<Record<string, unknown>>('/admin/analytics'),
    staleTime: 5 * 60_000,
    enabled: activeTab === 'analytics',
    retry: 2,
  });

  const {
    data: broadcastsData,
    isLoading: broadcastsLoading,
    refetch: refetchBroadcasts,
  } = useQuery({
    queryKey: ['admin-broadcasts'],
    queryFn: () => apiClient.get<any>('/admin/notifications/broadcasts?page=1&limit=10'),
    staleTime: 60_000,
    enabled: activeTab === 'broadcast',
    retry: 2,
  });

  const broadcastHistory: Record<string, unknown>[] = broadcastsData?.data ?? [];

  // ── Computed stats ────────────────────────────────────────────────────────

  const totalSalons       = (statsData?.totalSalons as number)       ?? 0;
  const approvedSalons    = (statsData?.activeSalons as number)       ?? 0;
  const pendingSalons     = (statsData?.pendingSalons as number)      ?? 0;
  const totalUsers        = (statsData?.totalUsers as number)         ?? 0;
  const totalReservations = (statsData?.totalReservations as number)  ?? 0;

  // ── Mutations ─────────────────────────────────────────────────────────────

  const toggleApproval = useMutation({
    mutationFn: ({ salonId, approve }: { salonId: string; approve: boolean }) =>
      apiClient.patch(`/admin/salons/${salonId}/approve`, { approved: approve }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-salons'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      Toast.show({ type: 'success', text1: 'Succès', text2: 'Statut du salon mis à jour' });
    },
    onError: (err: unknown) =>
      Toast.show({ type: 'error', text1: 'Erreur', text2: (err as Error).message }),
  });

  const toggleSponsoring = useMutation({
    mutationFn: ({ salonId, sponsor }: { salonId: string; sponsor: boolean }) =>
      sponsor
        ? apiClient.post(`/admin/salons/${salonId}/sponsor`, { days: 30 })
        : apiClient.delete(`/admin/salons/${salonId}/sponsor`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-salons'] });
      Toast.show({ type: 'success', text1: 'Succès', text2: 'Sponsoring mis à jour' });
    },
    onError: (err: unknown) =>
      Toast.show({ type: 'error', text1: 'Erreur', text2: (err as Error).message }),
  });

  const changeUserRole = useMutation({
    mutationFn: ({ userId, newRole }: { userId: string; newRole: string }) =>
      apiClient.patch(`/admin/users/${userId}/role`, { role: newRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      Toast.show({ type: 'success', text1: 'Succès', text2: 'Rôle mis à jour' });
    },
    onError: (err: unknown) =>
      Toast.show({ type: 'error', text1: 'Erreur', text2: (err as Error).message }),
  });

  const broadcastMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/admin/notifications/broadcast', {
        title: broadcastTitle.trim(),
        body: broadcastBody.trim(),
      }),
    onSuccess: (res: any) => {
      setBroadcastTitle('');
      setBroadcastBody('');
      queryClient.invalidateQueries({ queryKey: ['admin-broadcasts'] });
      Toast.show({
        type: 'success',
        text1: 'Notification envoyée',
        text2: `Envoyé à ${res?.sent ?? '?'} utilisateurs`,
      });
    },
    onError: (err: unknown) =>
      Toast.show({ type: 'error', text1: 'Erreur', text2: (err as Error).message }),
  });

  // ── Actions ───────────────────────────────────────────────────────────────

  const confirmRoleChange = useCallback((userId: string, currentRole: string) => {
    if (currentRole === 'Client') {
      Alert.alert('Promouvoir', 'Promouvoir cet utilisateur en Coiffeur ?', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Promouvoir', onPress: () => changeUserRole.mutate({ userId, newRole: 'Coiffeur' }) },
      ]);
    } else if (currentRole === 'Coiffeur') {
      Alert.alert('Rétrograder', 'Rétrograder cet utilisateur en Client ?', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Rétrograder', style: 'destructive', onPress: () => changeUserRole.mutate({ userId, newRole: 'Client' }) },
      ]);
    }
  }, []);

  const deleteSalon = useCallback((salonId: string, name: string) => {
    Alert.alert('Supprimer le salon', `Supprimer "${name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/admin/salons/${salonId}`);
            queryClient.invalidateQueries({ queryKey: ['admin-salons'] });
            queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
            Toast.show({ type: 'success', text1: 'Salon supprimé' });
          } catch (e: unknown) {
            Toast.show({ type: 'error', text1: 'Erreur', text2: (e as Error).message });
          }
        },
      },
    ]);
  }, [queryClient]);

  const deleteUser = useCallback((userId: string, name: string) => {
    Alert.alert('Supprimer l\'utilisateur', `Supprimer "${name}" ? Cette action est irréversible.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/admin/users/${userId}`);
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
            setSelectedUser(null);
            Toast.show({ type: 'success', text1: 'Utilisateur supprimé' });
          } catch (e: unknown) {
            Toast.show({ type: 'error', text1: 'Erreur', text2: (e as Error).message });
          }
        },
      },
    ]);
  }, [queryClient]);

  const banUser = useCallback((userId: string, name: string) => {
    Alert.alert('Bannir', `Bannir "${name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Bannir',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.patch(`/admin/users/${userId}/ban`, { isBanned: true });
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            setSelectedUser(null);
            Toast.show({ type: 'success', text1: 'Utilisateur banni' });
          } catch (e: unknown) {
            Toast.show({ type: 'error', text1: 'Erreur', text2: (e as Error).message });
          }
        },
      },
    ]);
  }, [queryClient]);

  const deleteReservation = useCallback((resId: string) => {
    Alert.alert('Supprimer la réservation', 'Supprimer cette réservation ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/admin/reservations/${resId}`);
            queryClient.invalidateQueries({ queryKey: ['admin-reservations'] });
            queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
            Toast.show({ type: 'success', text1: 'Réservation supprimée' });
          } catch (e: unknown) {
            Toast.show({ type: 'error', text1: 'Erreur', text2: (e as Error).message });
          }
        },
      },
    ]);
  }, [queryClient]);

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Êtes-vous sûr ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  };

  const handleSendBroadcast = () => {
    if (!broadcastTitle.trim() || !broadcastBody.trim()) {
      Toast.show({ type: 'error', text1: 'Champs requis', text2: 'Remplissez le titre et le message' });
      return;
    }
    Alert.alert('Confirmer', `Envoyer "${broadcastTitle}" à tous les utilisateurs ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Envoyer', onPress: () => broadcastMutation.mutate() },
    ]);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatCurrency = (val: number) =>
    `${val.toLocaleString('fr-DZ')} DZD`;

  // ── Renders ───────────────────────────────────────────────────────────────

  const renderError = (onRetry: () => void) => (
    <View style={styles.errorBox}>
      <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
      <Text style={styles.errorText}>Impossible de charger les données</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
        <Ionicons name="refresh" size={16} color={colors.amber} />
        <Text style={styles.retryText}>Réessayer</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSalonItem = ({ item }: { item: Record<string, unknown> }) => {
    // Backend returns profiles as: profiles:owner_id(full_name, phone_number)
    const ownerName =
      (item.profiles as any)?.full_name ??
      (item.owner as any)?.full_name ??
      'Propriétaire inconnu';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.name as string}</Text>
            <Text style={styles.cardSubtitle}>
              {item.wilaya as string} · {ownerName}
            </Text>
          </View>
          <View style={[styles.badge, item.is_approved ? styles.badgeApproved : styles.badgePending]}>
            <Text style={[styles.badgeText, item.is_approved ? styles.badgeTextApproved : styles.badgeTextPending]}>
              {item.is_approved ? '✓ Approuvé' : '⏳ En attente'}
            </Text>
          </View>
        </View>

        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="star" size={13} color={colors.amber} />
            <Text style={styles.metaText}>
              {item.average_rating != null ? Number(item.average_rating).toFixed(1) : '—'}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.metaText}>
              {(item.open_time as string)?.substring(0, 5) || '—'} – {(item.close_time as string)?.substring(0, 5) || '—'}
            </Text>
          </View>
          {Boolean(item.is_sponsored) && (
            <View style={styles.metaItem}>
              <Ionicons name="star-outline" size={13} color="#9333EA" />
              <Text style={[styles.metaText, { color: '#9333EA' }]}>Sponsorisé</Text>
            </View>
          )}
          {Boolean(item.is_manually_closed) && (
            <View style={styles.metaItem}>
              <Ionicons name="lock-closed" size={13} color={colors.error} />
              <Text style={[styles.metaText, { color: colors.error }]}>Fermé</Text>
            </View>
          )}
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionBtn, item.is_approved ? styles.actionBtnDanger : styles.actionBtnSuccess]}
            onPress={() => toggleApproval.mutate({ salonId: item.id as string, approve: !item.is_approved })}
            activeOpacity={0.7}
          >
            <Ionicons
              name={item.is_approved ? 'close-circle' : 'checkmark-circle'}
              size={16}
              color={item.is_approved ? colors.error : colors.success}
            />
            <Text style={[styles.actionBtnText, { color: item.is_approved ? colors.error : colors.success }]}>
              {item.is_approved ? 'Révoquer' : 'Approuver'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, item.is_sponsored
              ? styles.actionBtnWarning
              : { borderColor: 'rgba(147,51,234,0.3)', backgroundColor: 'rgba(147,51,234,0.08)' }]}
            onPress={() => toggleSponsoring.mutate({ salonId: item.id as string, sponsor: !item.is_sponsored })}
            activeOpacity={0.7}
          >
            <Ionicons name={item.is_sponsored ? 'star' : 'star-outline'} size={16}
              color={item.is_sponsored ? colors.amber : '#9333EA'} />
            <Text style={[styles.actionBtnText, { color: item.is_sponsored ? colors.amber : '#9333EA' }]}>
              {item.is_sponsored ? 'Retiré' : 'Sponsoriser'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnDelete]}
            onPress={() => deleteSalon(item.id as string, item.name as string)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={16} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderUserItem = ({ item }: { item: Record<string, unknown> }) => (
    <TouchableOpacity style={styles.card} onPress={() => setSelectedUser(item)} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View style={styles.userAvatar}>
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url as string }} style={{ width: 40, height: 40, borderRadius: 20 }} />
          ) : (
            <Ionicons name="person" size={20} color={colors.amber} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{(item.full_name as string) || 'Sans nom'}</Text>
          <Text style={styles.cardSubtitle}>{(item.phone_number as string) || 'Pas de téléphone'}</Text>
        </View>
        <View style={[
          styles.badge,
          item.role === 'Admin' ? styles.badgeAdmin :
          item.role === 'Coiffeur' ? styles.badgeBarber : styles.badgeClient,
        ]}>
          <Text style={[
            styles.badgeText,
            item.role === 'Admin' ? styles.badgeTextAdmin :
            item.role === 'Coiffeur' ? styles.badgeTextBarber : styles.badgeTextClient,
          ]}>
            {item.role as string}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </View>

      {item.role !== 'Admin' && (
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionBtn, item.role === 'Client' ? styles.actionBtnSuccess : styles.actionBtnWarning]}
            onPress={() => confirmRoleChange(item.id as string, item.role as string)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={item.role === 'Client' ? 'arrow-up-circle' : 'arrow-down-circle'}
              size={16}
              color={item.role === 'Client' ? colors.success : colors.amber}
            />
            <Text style={[styles.actionBtnText, { color: item.role === 'Client' ? colors.success : colors.amber }]}>
              {item.role === 'Client' ? 'Promouvoir' : 'Rétrograder'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderReservationItem = ({ item }: { item: Record<string, unknown> }) => {
    const statusColor =
      item.status === 'Confirmed' ? colors.success :
      item.status === 'Pending' ? colors.amber :
      item.status === 'Completed' ? '#4A90D9' : colors.error;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {(item.profiles as any)?.full_name ?? 'Client inconnu'}
            </Text>
            <Text style={styles.cardSubtitle}>
              {(item.salons as any)?.name ?? '—'} · {item.appointment_date as string}
            </Text>
            <Text style={styles.cardSubtitle}>
              {item.start_time as string} → {item.end_time as string}
              {(item.services as any)?.service_name ? ` · ${(item.services as any).service_name}` : ''}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: `${statusColor}22` }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>{item.status as string}</Text>
          </View>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnDelete]}
            onPress={() => deleteReservation(item.id as string)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={16} color={colors.error} />
            <Text style={[styles.actionBtnText, { color: colors.error }]}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Administration</Text>
          <Text style={styles.headerSubtitle}>7afefli · Panneau de contrôle</Text>
        </View>
        <View style={styles.headerRight}>
          <NotificationBell />
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Stats ── */}
      {statsLoading ? (
        <ActivityIndicator color={colors.amber} size="small" style={{ marginVertical: 12 }} />
      ) : statsError ? (
        <TouchableOpacity style={styles.statsErrorRow} onPress={() => refetchStats()}>
          <Ionicons name="refresh" size={14} color={colors.amber} />
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: colors.amber, marginLeft: 6 }}>
            Erreur stats — Appuyer pour réessayer
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.statsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statsRow}
          >
            {[
              { icon: 'business', label: 'Salons', value: totalSalons, color: colors.amber },
              { icon: 'checkmark-circle', label: 'Approuvés', value: approvedSalons, color: colors.success },
              { icon: 'time-outline', label: 'En attente', value: pendingSalons, color: colors.warning },
              { icon: 'people', label: 'Utilisateurs', value: totalUsers, color: colors.amber },
              { icon: 'calendar', label: 'Réservations', value: totalReservations, color: '#4A90D9' },
            ].map((s) => (
              <View key={s.label} style={styles.statCard}>
                <Ionicons name={s.icon as any} size={20} color={s.color} />
                <Text style={styles.statNumber}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}
      >
        {([
          { key: 'salons', icon: 'business-outline', label: 'Salons' },
          { key: 'users', icon: 'people-outline', label: 'Utilisateurs' },
          { key: 'reservations', icon: 'calendar-outline', label: 'RDV' },
          { key: 'analytics', icon: 'bar-chart-outline', label: 'Analytics' },
          { key: 'broadcast', icon: 'megaphone-outline', label: 'Diffusion' },
        ] as { key: AdminTab; icon: string; label: string }[]).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon as any}
              size={16}
              color={activeTab === tab.key ? colors.amber : colors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Content ── */}
      <View style={{ flex: 1 }}>

        {activeTab === 'salons' && (
          salonsError ? renderError(() => refetchSalons()) :
          salonsLoading ? <ActivityIndicator color={colors.amber} size="large" style={{ marginTop: 40 }} /> : (
            <FlatList
              data={salons}
              keyExtractor={(item) => item.id as string}
              renderItem={renderSalonItem}
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl
                  refreshing={salonsRefetching}
                  onRefresh={() => { setSalonsPage(1); refetchSalons(); }}
                  tintColor={colors.amber}
                />
              }
              ListEmptyComponent={<Text style={styles.emptyText}>Aucun salon enregistré</Text>}
              ListFooterComponent={
                salonsPage < salonsTotalPages ? (
                  <TouchableOpacity style={styles.loadMoreBtn} onPress={() => setSalonsPage(p => p + 1)}>
                    <Text style={styles.loadMoreText}>Charger plus</Text>
                    <Ionicons name="chevron-down" size={16} color={colors.amber} />
                  </TouchableOpacity>
                ) : null
              }
            />
          )
        )}

        {activeTab === 'users' && (
          usersError ? renderError(() => refetchUsers()) :
          usersLoading ? <ActivityIndicator color={colors.amber} size="large" style={{ marginTop: 40 }} /> : (
            <FlatList
              data={users}
              keyExtractor={(item) => item.id as string}
              renderItem={renderUserItem}
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl
                  refreshing={usersRefetching}
                  onRefresh={() => { setUsersPage(1); refetchUsers(); }}
                  tintColor={colors.amber}
                />
              }
              ListEmptyComponent={<Text style={styles.emptyText}>Aucun utilisateur</Text>}
              ListFooterComponent={
                usersPage < usersTotalPages ? (
                  <TouchableOpacity style={styles.loadMoreBtn} onPress={() => setUsersPage(p => p + 1)}>
                    <Text style={styles.loadMoreText}>Charger plus</Text>
                    <Ionicons name="chevron-down" size={16} color={colors.amber} />
                  </TouchableOpacity>
                ) : null
              }
            />
          )
        )}

        {activeTab === 'reservations' && (
          resError ? renderError(() => refetchRes()) :
          resLoading ? <ActivityIndicator color={colors.amber} size="large" style={{ marginTop: 40 }} /> : (
            <FlatList
              data={reservations}
              keyExtractor={(item) => item.id as string}
              renderItem={renderReservationItem}
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl
                  refreshing={resRefetching}
                  onRefresh={() => { setResPage(1); refetchRes(); }}
                  tintColor={colors.amber}
                />
              }
              ListEmptyComponent={<Text style={styles.emptyText}>Aucune réservation</Text>}
              ListFooterComponent={
                resPage < resTotalPages ? (
                  <TouchableOpacity style={styles.loadMoreBtn} onPress={() => setResPage(p => p + 1)}>
                    <Text style={styles.loadMoreText}>Charger plus</Text>
                    <Ionicons name="chevron-down" size={16} color={colors.amber} />
                  </TouchableOpacity>
                ) : null
              }
            />
          )
        )}


        {activeTab === 'analytics' && (
          analyticsError ? renderError(() => refetchAnalytics()) :
          analyticsLoading ? <ActivityIndicator color={colors.amber} size="large" style={{ marginTop: 40 }} /> : (
            <ScrollView contentContainerStyle={[styles.list, { paddingTop: 8 }]} showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionHeading}>Revenus &amp; Abonnements</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Revenu total', value: formatCurrency((analyticsData?.totalRevenue as number) ?? 0), icon: 'cash-outline' },
                  { label: 'MRR', value: formatCurrency((analyticsData?.mrr as number) ?? 0), icon: 'trending-up-outline' },
                  { label: 'Moy. abo.', value: formatCurrency((analyticsData?.avgSubscriptionValue as number) ?? 0), icon: 'receipt-outline' },
                ].map((m) => (
                  <View key={m.label} style={styles.analyticsCard}>
                    <Ionicons name={m.icon as any} size={20} color={colors.amber} />
                    <Text style={styles.analyticsValue}>{m.value}</Text>
                    <Text style={styles.analyticsLabel}>{m.label}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.sectionHeading}>Abonnements par plan</Text>
              {((analyticsData?.subscriptionsByPlan as any[]) ?? []).length === 0 ? (
                <Text style={styles.emptyText}>Aucun abonnement actif</Text>
              ) : (
                ((analyticsData?.subscriptionsByPlan as any[]) ?? []).map((p: any) => (
                  <View key={p.plan_name} style={[styles.card, { flexDirection: 'row', alignItems: 'center' }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{p.plan_name}</Text>
                      <Text style={styles.cardSubtitle}>{p.count} abonné(s)</Text>
                    </View>
                    <Text style={{ fontFamily: 'Syne_700Bold', fontSize: 22, color: colors.amber }}>{p.count}</Text>
                  </View>
                ))
              )}

              <Text style={[styles.sectionHeading, { marginTop: 8 }]}>Top salons (note)</Text>
              {((analyticsData?.topSalons as any[]) ?? []).length === 0 ? (
                <Text style={styles.emptyText}>Aucune donnée</Text>
              ) : (
                ((analyticsData?.topSalons as any[]) ?? []).map((s: any, i: number) => (
                  <View key={s.id} style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                    <Text style={{ fontFamily: 'Syne_700Bold', fontSize: 18, color: colors.textMuted, width: 28 }}>#{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{s.name}</Text>
                      <Text style={styles.cardSubtitle}>{s.wilaya} · {s.total_reviews ?? 0} avis</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="star" size={14} color={colors.amber} />
                      <Text style={{ fontFamily: 'Syne_700Bold', fontSize: 14, color: colors.amber }}>
                        {Number(s.average_rating ?? 0).toFixed(1)}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          )
        )}

        {activeTab === 'broadcast' && (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ScrollView contentContainerStyle={[styles.list, { paddingTop: 8 }]} showsVerticalScrollIndicator={false}>
              {/* Compose */}
              <View style={styles.broadcastCard}>
                <View style={styles.broadcastCardHeader}>
                  <Ionicons name="megaphone" size={20} color={colors.amber} />
                  <Text style={styles.broadcastCardTitle}>Envoyer une notification à tous</Text>
                </View>
                <Text style={styles.broadcastHint}>
                  La notification sera envoyée à tous les utilisateurs inscrits, même hors de l'application.
                </Text>

                <Text style={styles.inputLabel}>Titre *</Text>
                <TextInput
                  style={styles.inputField}
                  placeholder="Ex: Nouveau salon disponible !"
                  placeholderTextColor={colors.textMuted}
                  value={broadcastTitle}
                  onChangeText={setBroadcastTitle}
                  maxLength={100}
                />
                <Text style={styles.charCount}>{broadcastTitle.length}/100</Text>

                <Text style={styles.inputLabel}>Message *</Text>
                <TextInput
                  style={[styles.inputField, styles.inputArea]}
                  placeholder="Écrivez votre message ici..."
                  placeholderTextColor={colors.textMuted}
                  value={broadcastBody}
                  onChangeText={setBroadcastBody}
                  multiline
                  numberOfLines={4}
                  maxLength={300}
                  textAlignVertical="top"
                />
                <Text style={styles.charCount}>{broadcastBody.length}/300</Text>

                <TouchableOpacity
                  style={[styles.sendBtn, (!broadcastTitle.trim() || !broadcastBody.trim() || broadcastMutation.isPending) && styles.sendBtnDisabled]}
                  onPress={handleSendBroadcast}
                  activeOpacity={0.8}
                  disabled={!broadcastTitle.trim() || !broadcastBody.trim() || broadcastMutation.isPending}
                >
                  {broadcastMutation.isPending ? (
                    <ActivityIndicator color={colors.ink} size="small" />
                  ) : (
                    <>
                      <Ionicons name="send" size={18} color={colors.ink} />
                      <Text style={styles.sendBtnText}>Envoyer à tous les utilisateurs</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Broadcast history */}
              <Text style={[styles.sectionHeading, { marginTop: 8 }]}>Historique des diffusions</Text>
              {broadcastsLoading ? (
                <ActivityIndicator color={colors.amber} style={{ marginTop: 16 }} />
              ) : broadcastHistory.length === 0 ? (
                <Text style={styles.emptyText}>Aucune diffusion envoyée</Text>
              ) : (
                broadcastHistory.map((b) => (
                  <View key={b.id as string} style={styles.card}>
                    <Text style={styles.cardTitle}>{b.title as string}</Text>
                    <Text style={[styles.cardSubtitle, { marginTop: 4 }]}>{b.body as string}</Text>
                    <Text style={[styles.cardSubtitle, { marginTop: 6, color: colors.textMuted }]}>
                      {formatDate((b.sent_at ?? b.created_at) as string)}
                      {(b.profiles as any)?.full_name ? ` · Par ${(b.profiles as any).full_name}` : ''}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        )}

      </View>{/* end flex:1 content wrapper */}



      {/* ── User Detail Modal ── */}
      <Modal
        visible={!!selectedUser}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedUser(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedUser(null)} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>Profil utilisateur</Text>
              <View style={{ width: 24 }} />
            </View>

            {selectedUser && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}>
                {/* Avatar + Name */}
                <View style={styles.modalProfileSection}>
                  <View style={styles.modalAvatar}>
                    {selectedUser.avatar_url ? (
                      <Image source={{ uri: selectedUser.avatar_url as string }} style={{ width: 80, height: 80, borderRadius: 40 }} />
                    ) : (
                      <Ionicons name="person" size={36} color={colors.amber} />
                    )}
                  </View>
                  <Text style={styles.modalName}>{(selectedUser.full_name as string) || 'Sans nom'}</Text>
                  <View style={[
                    styles.badge,
                    selectedUser.role === 'Admin' ? styles.badgeAdmin :
                    selectedUser.role === 'Coiffeur' ? styles.badgeBarber : styles.badgeClient,
                  ]}>
                    <Text style={[
                      styles.badgeText,
                      selectedUser.role === 'Admin' ? styles.badgeTextAdmin :
                      selectedUser.role === 'Coiffeur' ? styles.badgeTextBarber : styles.badgeTextClient,
                    ]}>
                      {selectedUser.role as string}
                    </Text>
                  </View>
                </View>

                {/* Info rows */}
                <View style={styles.modalInfoGroup}>
                  {[
                    { icon: 'call-outline', label: 'Téléphone', value: (selectedUser.phone_number as string) || 'Non renseigné' },
                    { icon: 'location-outline', label: 'Wilaya', value: (selectedUser.wilaya as string) || '—' },
                    { icon: 'calendar-outline', label: 'Inscrit le', value: formatDate(selectedUser.created_at as string) },
                    { icon: 'gift-outline', label: 'Points fidélité', value: `${(selectedUser.loyalty_points as number) || 0} pts` },
                    { icon: 'finger-print-outline', label: 'ID', value: (selectedUser.id as string)?.substring(0, 20) + '…' },
                  ].map((row) => (
                    <View key={row.label} style={styles.modalInfoRow}>
                      <Ionicons name={row.icon as any} size={18} color={colors.amber} />
                      <Text style={styles.modalInfoLabel}>{row.label}</Text>
                      <Text style={styles.modalInfoValue} numberOfLines={1}>{row.value}</Text>
                    </View>
                  ))}
                </View>

                {/* Actions */}
                <View style={styles.modalActions}>
                  {selectedUser.role !== 'Admin' && (
                    <TouchableOpacity
                      style={[styles.modalActionBtn, {
                        backgroundColor: selectedUser.role === 'Client' ? 'rgba(46,204,113,0.12)' : 'rgba(232,160,32,0.12)',
                        borderColor: selectedUser.role === 'Client' ? 'rgba(46,204,113,0.3)' : 'rgba(232,160,32,0.3)',
                      }]}
                      onPress={() => {
                        setSelectedUser(null);
                        confirmRoleChange(selectedUser.id as string, selectedUser.role as string);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={selectedUser.role === 'Client' ? 'arrow-up-circle' : 'arrow-down-circle'}
                        size={20}
                        color={selectedUser.role === 'Client' ? colors.success : colors.amber}
                      />
                      <Text style={[styles.modalActionText, { color: selectedUser.role === 'Client' ? colors.success : colors.amber }]}>
                        {selectedUser.role === 'Client' ? 'Promouvoir en Coiffeur' : 'Rétrograder en Client'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.modalActionBtn, { backgroundColor: 'rgba(255,152,0,0.12)', borderColor: 'rgba(255,152,0,0.3)' }]}
                    onPress={() => banUser(selectedUser.id as string, selectedUser.full_name as string)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="ban-outline" size={20} color={colors.warning} />
                    <Text style={[styles.modalActionText, { color: colors.warning }]}>Bannir le compte</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalActionBtn, { backgroundColor: 'rgba(255,82,82,0.12)', borderColor: 'rgba(255,82,82,0.3)' }]}
                    onPress={() => deleteUser(selectedUser.id as string, selectedUser.full_name as string)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash" size={20} color={colors.error} />
                    <Text style={[styles.modalActionText, { color: colors.error }]}>Supprimer le compte</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: { fontFamily: 'Syne_700Bold', fontSize: 22, color: colors.textPrimary },
  headerSubtitle: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoutBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,82,82,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Stats
  statsErrorRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: spacing.lg, marginVertical: 8,
  },
  statsContainer: {
    height: 110,  // Fixed height prevents the horizontal ScrollView from expanding vertically
  },
  statsRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    alignItems: 'center',
  },
  statCard: {
    width: 90,
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statNumber: { fontFamily: 'Syne_700Bold', fontSize: 20, color: colors.textPrimary },
  statLabel: { fontFamily: 'DMSans_400Regular', fontSize: 10, color: colors.textSecondary, textAlign: 'center' },

  // Tabs
  tabRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    gap: 4,
  },
  tab: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1, // align with the container bottom border
  },
  tabActive: { borderBottomColor: colors.amber },
  tabText: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: colors.textSecondary },
  tabTextActive: { color: colors.amber, fontFamily: 'DMSans_700Bold' },

  // List / Cards
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 120 },
  card: {
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { fontFamily: 'Syne_700Bold', fontSize: 15, color: colors.textPrimary },
  cardSubtitle: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  cardMeta: {
    flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm,
    marginTop: spacing.sm, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)',
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: colors.textSecondary },
  cardActions: { flexDirection: 'row' as const, gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' as const },

  // Badge
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeApproved: { backgroundColor: 'rgba(46,204,113,0.15)' },
  badgePending: { backgroundColor: 'rgba(232,160,32,0.15)' },
  badgeAdmin: { backgroundColor: 'rgba(232,82,82,0.15)' },
  badgeBarber: { backgroundColor: 'rgba(232,160,32,0.15)' },
  badgeClient: { backgroundColor: 'rgba(74,144,217,0.15)' },
  badgeText: { fontFamily: 'DMSans_700Bold', fontSize: 11 },
  badgeTextApproved: { color: colors.success },
  badgeTextPending: { color: colors.amber },
  badgeTextAdmin: { color: colors.error },
  badgeTextBarber: { color: colors.amber },
  badgeTextClient: { color: '#4A90D9' },

  // Action buttons
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing.md, paddingVertical: 7,
    borderRadius: radius.md, borderWidth: 1,
  },
  actionBtnSuccess: { borderColor: 'rgba(46,204,113,0.3)', backgroundColor: 'rgba(46,204,113,0.08)' },
  actionBtnDanger: { borderColor: 'rgba(255,82,82,0.3)', backgroundColor: 'rgba(255,82,82,0.08)' },
  actionBtnWarning: { borderColor: 'rgba(232,160,32,0.3)', backgroundColor: 'rgba(232,160,32,0.08)' },
  actionBtnDelete: { borderColor: 'rgba(255,82,82,0.3)', backgroundColor: 'rgba(255,82,82,0.08)', marginLeft: 'auto' as any },
  actionBtnText: { fontFamily: 'DMSans_700Bold', fontSize: 12 },

  // User avatar
  userAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(232,160,32,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Empty / error
  emptyText: {
    fontFamily: 'DMSans_400Regular', color: colors.textMuted,
    textAlign: 'center', marginTop: spacing.xxl, fontSize: 14,
  },
  errorBox: { alignItems: 'center', marginTop: 60, gap: 12 },
  errorText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: colors.textMuted },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: radius.md, borderWidth: 1,
    borderColor: 'rgba(232,160,32,0.3)', backgroundColor: 'rgba(232,160,32,0.08)',
  },
  retryText: { fontFamily: 'DMSans_700Bold', fontSize: 13, color: colors.amber },

  // Load more
  loadMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: 'rgba(232,160,32,0.08)', borderRadius: radius.md,
    borderWidth: 1, borderColor: 'rgba(232,160,32,0.2)',
  },
  loadMoreText: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: colors.amber },

  // Analytics
  sectionHeading: {
    fontFamily: 'Syne_700Bold', fontSize: 15, color: colors.textPrimary, marginBottom: 10,
  },
  analyticsCard: {
    flex: 1, backgroundColor: colors.carbon,
    borderRadius: radius.md, padding: 12,
    borderWidth: 1, borderColor: 'rgba(232,160,32,0.15)',
    alignItems: 'center', gap: 4,
  },
  analyticsValue: { fontFamily: 'Syne_700Bold', fontSize: 12, color: colors.textPrimary, textAlign: 'center' },
  analyticsLabel: { fontFamily: 'DMSans_400Regular', fontSize: 10, color: colors.textMuted, textAlign: 'center' },

  // Broadcast
  broadcastCard: {
    backgroundColor: colors.carbon,
    borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 1, borderColor: 'rgba(232,160,32,0.2)',
    marginBottom: spacing.lg,
  },
  broadcastCardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 6 },
  broadcastCardTitle: { fontFamily: 'Syne_700Bold', fontSize: 16, color: colors.textPrimary },
  broadcastHint: {
    fontFamily: 'DMSans_400Regular', fontSize: 12, color: colors.textSecondary,
    marginBottom: spacing.md, lineHeight: 18,
  },
  inputLabel: {
    fontFamily: 'DMSans_700Bold', fontSize: 13, color: colors.textSecondary,
    marginBottom: 6, marginTop: spacing.sm,
  },
  inputField: {
    backgroundColor: colors.graphite, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    fontFamily: 'DMSans_400Regular', fontSize: 14, color: colors.textPrimary,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  inputArea: { height: 100, textAlignVertical: 'top' },
  charCount: {
    fontFamily: 'DMSans_400Regular', fontSize: 11, color: colors.textMuted,
    textAlign: 'right', marginTop: 4,
  },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: colors.amber,
    borderRadius: radius.md, height: 52, marginTop: spacing.lg,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { fontFamily: 'Syne_700Bold', fontSize: 15, color: colors.ink },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContainer: {
    backgroundColor: colors.ink,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '85%',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  modalHeaderTitle: { fontFamily: 'Syne_700Bold', fontSize: 17, color: colors.textPrimary },
  modalContent: { padding: spacing.lg, paddingBottom: 40 },
  modalProfileSection: { alignItems: 'center', marginBottom: spacing.xl },
  modalAvatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(232,160,32,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 2, borderColor: 'rgba(232,160,32,0.3)',
  },
  modalName: { fontFamily: 'Syne_700Bold', fontSize: 20, color: colors.textPrimary, marginBottom: spacing.sm },
  modalInfoGroup: {
    backgroundColor: colors.carbon, borderRadius: radius.lg,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden', marginBottom: spacing.lg,
  },
  modalInfoRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
    gap: spacing.sm,
  },
  modalInfoLabel: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: colors.textSecondary, flex: 1 },
  modalInfoValue: { fontFamily: 'DMSans_700Bold', fontSize: 13, color: colors.textPrimary },
  modalActions: { gap: spacing.sm },
  modalActionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: 14,
    borderRadius: radius.lg, borderWidth: 1,
  },
  modalActionText: { fontFamily: 'DMSans_700Bold', fontSize: 15 },
});
