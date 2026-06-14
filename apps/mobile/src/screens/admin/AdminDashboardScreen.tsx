import Toast from 'react-native-toast-message';
// apps/mobile/src/screens/admin/AdminDashboardScreen.tsx
// Admin dashboard — manage salons, users, and platform stats

import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { colors, spacing, radius, shadows } from '../../theme';
import Ionicons from '@react-native-vector-icons/ionicons';
import { apiClient } from '../../lib/apiClient';

export function AdminDashboardScreen() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'salons' | 'users' | 'reservations' | 'analytics'>('salons');
  const [selectedUser, setSelectedUser] = useState<Record<string, unknown> | null>(null);

  // Pagination state
  const [salonsPage, setSalonsPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const [resPage, setResPage] = useState(1);

  // Fetch salons via API with pagination
  const { data: salonsResponse, isLoading: salonsLoading, isRefetching: salonsRefetching, refetch: refetchSalons } = useQuery({
    queryKey: ['admin-salons', salonsPage],
    queryFn: () => apiClient.get<any>(`/admin/salons?page=${salonsPage}&limit=50`),
    staleTime: 60 * 1000,
  });
  const salons = salonsResponse?.data ?? [];
  const salonsTotalPages = Math.ceil((salonsResponse?.total ?? 0) / 50);

  // Fetch users via API with pagination
  const { data: usersResponse, isLoading: usersLoading, isRefetching: usersRefetching, refetch: refetchUsers } = useQuery({
    queryKey: ['admin-users', usersPage],
    queryFn: () => apiClient.get<any>(`/admin/users?page=${usersPage}&limit=50`),
    staleTime: 60 * 1000,
  });
  const users = usersResponse?.data ?? [];
  const usersTotalPages = Math.ceil((usersResponse?.total ?? 0) / 50);

  // Stats via API
  const { data: statsData } = useQuery<Record<string, unknown>>({
    queryKey: ['admin-stats'],
    queryFn: () => apiClient.get<Record<string, unknown>>('/admin/stats'),
    staleTime: 60 * 1000,
  });

  // Fetch reservations via API with pagination
  const { data: reservationsResponse, isLoading: resLoading, isRefetching: resRefetching, refetch: refetchRes } = useQuery({
    queryKey: ['admin-reservations', resPage],
    queryFn: () => apiClient.get<any>(`/admin/reservations?page=${resPage}&limit=50`),
    staleTime: 60 * 1000,
    enabled: activeTab === 'reservations',
  });
  const reservations = reservationsResponse?.data ?? [];
  const resTotalPages = Math.ceil((reservationsResponse?.total ?? 0) / 50);

  // MEDIUM-5: Analytics data — lazy loaded only when the Analytics tab is active
  const { data: analyticsData, isLoading: analyticsLoading } = useQuery<Record<string, unknown>>({
    queryKey: ['admin-analytics'],
    queryFn: () => apiClient.get<Record<string, unknown>>('/admin/analytics'),
    staleTime: 5 * 60 * 1000,
    enabled: activeTab === 'analytics',
  });

  const totalSalons = statsData?.totalSalons ?? salons.length;
  const approvedSalons = statsData?.activeSalons ?? salons.filter((s: Record<string, unknown>) => s.is_approved).length;
  const pendingSalons = statsData?.pendingSalons ?? salons.filter((s: Record<string, unknown>) => !s.is_approved).length;
  const totalUsers = statsData?.totalUsers ?? users.length;

  // Toggle salon approval
  const toggleApproval = useMutation({
    mutationFn: async ({ salonId, approve }: { salonId: string; approve: boolean }) => {
      await apiClient.patch(`/admin/salons/${salonId}/approve`, { approved: approve });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-salons'] });
    },
    onError: (err: unknown) => Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: (err as Error).message || 'Une erreur est survenue'
      }),
  });

  // Toggle salon sponsoring (FIX-9)
  const toggleSponsoring = useMutation({
    mutationFn: async ({ salonId, sponsor }: { salonId: string; sponsor: boolean }) => {
      if (sponsor) {
        await apiClient.post(`/admin/salons/${salonId}/sponsor`, { days: 30 });
      } else {
        await apiClient.delete(`/admin/salons/${salonId}/sponsor`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-salons'] });
      Toast.show({ type: 'success', text1: 'Succès', text2: 'Sponsoring mis à jour' });
    },
    onError: (err: unknown) => Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: (err as Error).message || 'Une erreur est survenue'
      }),
  });

  // Change user role
  const changeUserRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      await apiClient.patch(`/admin/users/${userId}/role`, { role: newRole });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-salons'] });
    },
    onError: (err: unknown) => Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: (err as Error).message || 'Une erreur est survenue'
      }),
  });

  const confirmRoleChange = (userId: string, currentRole: string) => {
    if (currentRole === 'Client') {
      Alert.alert(
        'Promouvoir en Coiffeur',
        'Voulez-vous vraiment promouvoir cet utilisateur en Coiffeur ?',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Promouvoir',
            onPress: () => changeUserRole.mutate({ userId, newRole: 'Coiffeur' }),
          },
        ],
      );
    } else if (currentRole === 'Coiffeur') {
      Alert.alert(
        'Rétrograder en Client',
        'Voulez-vous vraiment rétrograder cet utilisateur en Client ?',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Rétrograder',
            style: 'destructive',
            onPress: () => changeUserRole.mutate({ userId, newRole: 'Client' }),
          },
        ],
      );
    }
  };

  // Delete salon — uses mutation pattern for proper loading/error states
  const deleteSalon = useCallback((salonId: string, name: string) => {
    if (!salonId) return;
    Alert.alert('Supprimer le salon', `Voulez-vous vraiment supprimer "${name ?? 'ce salon'}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/admin/salons/${salonId}`);
            queryClient.invalidateQueries({ queryKey: ['admin-salons'] });
            queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Erreur inconnue';
            Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: msg
      });
          }
        },
      },
    ]);
  }, [queryClient]);

  // Delete user
  const deleteUser = useCallback((userId: string, name: string) => {
    if (!userId) return;
    Alert.alert('Supprimer l\'utilisateur', `Voulez-vous vraiment supprimer "${name ?? 'cet utilisateur'}" ? Cette action est irréversible et supprimera également son profil, ses réservations et son salon.`, [
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
            Toast.show({ type: 'success', text1: 'Succès', text2: 'Utilisateur supprimé' });
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Erreur inconnue';
            Toast.show({ type: 'error', text1: 'Erreur', text2: msg });
          }
        },
      },
    ]);
  }, [queryClient]);

  // Ban user
  const banUser = useCallback((userId: string, name: string) => {
    if (!userId) return;
    Alert.alert('Bannir l\'utilisateur', `Voulez-vous vraiment bannir "${name ?? 'cet utilisateur'}" ? Cette action bloquera son accès à la plateforme.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Bannir',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.patch(`/admin/users/${userId}/ban`, { isBanned: true });
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            setSelectedUser(null);
            Toast.show({ type: 'success', text1: 'Succès', text2: 'Utilisateur banni' });
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Erreur inconnue';
            Toast.show({ type: 'error', text1: 'Erreur', text2: msg });
          }
        },
      },
    ]);
  }, [queryClient]);

  // Logout with confirmation
  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Déconnexion', style: 'destructive', onPress: () => supabase.auth.signOut() },
      ]
    );
  };

  const renderSalonItem = ({ item }: { item: Record<string, unknown> }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{item.name as string}</Text>
          <Text style={styles.cardSubtitle}>
            {item.wilaya as string} • {(item.profiles as Record<string, unknown>)?.full_name as string || 'Propriétaire inconnu'}
          </Text>
        </View>
        <View style={[styles.badge, item.is_approved ? styles.badgeApproved : styles.badgePending]}>
          <Text style={[styles.badgeText, item.is_approved ? styles.badgeTextApproved : styles.badgeTextPending]}>
            {item.is_approved ? 'Approuvé' : 'En attente'}
          </Text>
        </View>
      </View>

      <View style={styles.cardMeta}>
        <View style={styles.metaItem}>
          <Ionicons name="star" size={14} color={colors.amber} />
          <Text style={styles.metaText}>
            {item.average_rating != null ? Number(item.average_rating).toFixed(1) : '—'}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.metaText}>
            {(item.open_time as string)?.substring(0, 5) || '—'} - {(item.close_time as string)?.substring(0, 5) || '—'}
          </Text>
        </View>
        {Boolean(item.is_manually_closed) && (
          <View style={styles.metaItem}>
            <Ionicons name="lock-closed" size={14} color={colors.error} />
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
            size={18}
            color={item.is_approved ? colors.error : colors.success}
          />
          <Text style={[styles.actionBtnText, { color: item.is_approved ? colors.error : colors.success }]}>
            {item.is_approved ? 'Révoquer' : 'Approuver'}
          </Text>
        </TouchableOpacity>

        {/* FIX-9: Sponsor / Remove Sponsoring button */}
        <TouchableOpacity
          style={[styles.actionBtn, item.is_sponsored ? styles.actionBtnWarning : { borderColor: 'rgba(147,51,234,0.3)', backgroundColor: 'rgba(147,51,234,0.08)' }]}
          onPress={() => toggleSponsoring.mutate({ salonId: item.id as string, sponsor: !item.is_sponsored })}
          activeOpacity={0.7}
        >
          <Ionicons
            name={item.is_sponsored ? 'star' : 'star-outline'}
            size={18}
            color={item.is_sponsored ? colors.amber : '#9333EA'}
          />
          <Text style={[styles.actionBtnText, { color: item.is_sponsored ? colors.amber : '#9333EA' }]}>
            {item.is_sponsored ? 'Sponsorisé' : 'Sponsoriser'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnDelete]}
          onPress={() => deleteSalon(item.id as string, item.name as string)}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={18} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

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
          item.role === 'Coiffeur' ? styles.badgeBarber : styles.badgeClient
        ]}>
          <Text style={[
            styles.badgeText,
            item.role === 'Admin' ? styles.badgeTextAdmin :
            item.role === 'Coiffeur' ? styles.badgeTextBarber : styles.badgeTextClient
          ]}>
            {item.role as string}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>

      {/* Role change actions */}
      {item.role === 'Client' && (
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSuccess]}
            onPress={() => confirmRoleChange(item.id as string, item.role as string)}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-up-circle" size={18} color={colors.success} />
            <Text style={[styles.actionBtnText, { color: colors.success }]}>Promouvoir en Coiffeur</Text>
          </TouchableOpacity>
        </View>
      )}
      {item.role === 'Coiffeur' && (
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnWarning]}
            onPress={() => confirmRoleChange(item.id as string, item.role as string)}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-down-circle" size={18} color={colors.amber} />
            <Text style={[styles.actionBtnText, { color: colors.amber }]}>Rétrograder en Client</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Administration</Text>
          <Text style={styles.headerSubtitle}>Panneau de contrôle 7afefli</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="business" size={22} color={colors.amber} />
          <Text style={styles.statNumber}>{totalSalons}</Text>
          <Text style={styles.statLabel}>Salons</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          <Text style={styles.statNumber}>{approvedSalons}</Text>
          <Text style={styles.statLabel}>Approuvés</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="people" size={22} color={colors.amber} />
          <Text style={styles.statNumber}>{totalUsers}</Text>
          <Text style={styles.statLabel}>Utilisateurs</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="time-outline" size={22} color={colors.error} />
          <Text style={styles.statNumber}>{pendingSalons}</Text>
          <Text style={styles.statLabel}>En attente</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'salons' && styles.tabActive]}
          onPress={() => setActiveTab('salons')}
        >
          <Ionicons name="business-outline" size={18} color={activeTab === 'salons' ? colors.amber : colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'salons' && styles.tabTextActive]}>
            Salons ({totalSalons})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'users' && styles.tabActive]}
          onPress={() => setActiveTab('users')}
        >
          <Ionicons name="people-outline" size={18} color={activeTab === 'users' ? colors.amber : colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>
            Utilisateurs ({totalUsers})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reservations' && styles.tabActive]}
          onPress={() => setActiveTab('reservations')}
        >
          <Ionicons name="calendar-outline" size={18} color={activeTab === 'reservations' ? colors.amber : colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'reservations' && styles.tabTextActive]}>
            RDV
          </Text>
        </TouchableOpacity>
        {/* MEDIUM-5: Analytics tab */}
        <TouchableOpacity
          style={[styles.tab, activeTab === 'analytics' && styles.tabActive]}
          onPress={() => setActiveTab('analytics')}
        >
          <Ionicons name="bar-chart-outline" size={18} color={activeTab === 'analytics' ? colors.amber : colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'analytics' && styles.tabTextActive]}>
            Analytics
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'salons' ? (
        salonsLoading ? (
          <ActivityIndicator color={colors.amber} size="large" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={salons}
            keyExtractor={(item: Record<string, unknown>) => item.id as string}
            renderItem={renderSalonItem}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={salonsRefetching} onRefresh={() => { setSalonsPage(1); refetchSalons(); }} tintColor={colors.amber} />}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Aucun salon enregistré</Text>
            }
            ListFooterComponent={
              salonsPage < salonsTotalPages ? (
                <TouchableOpacity
                  style={styles.loadMoreBtn}
                  onPress={() => setSalonsPage(p => p + 1)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.loadMoreText}>Charger plus</Text>
                  <Ionicons name="chevron-down" size={16} color={colors.amber} />
                </TouchableOpacity>
              ) : null
            }
          />
        )
      ) : activeTab === 'reservations' ? (
        resLoading ? (
          <ActivityIndicator color={colors.amber} size="large" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={reservations}
            keyExtractor={(item: Record<string, unknown>) => item.id as string}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>
                      {(item.profiles as any)?.full_name ?? 'Client inconnu'}
                    </Text>
                    <Text style={styles.cardSubtitle}>
                      {(item.salons as any)?.name ?? '—'} • {item.appointment_date as string}
                    </Text>
                    <Text style={styles.cardSubtitle}>
                      {item.start_time as string} → {item.end_time as string} • {(item.services as any)?.service_name ?? '—'}
                    </Text>
                  </View>
                  <View style={[
                    styles.badge,
                    item.status === 'Confirmed' ? styles.badgeApproved :
                    item.status === 'Pending' ? styles.badgePending :
                    item.status === 'Completed' ? { backgroundColor: 'rgba(74,144,217,0.15)' } :
                    styles.badgeAdmin
                  ]}>
                    <Text style={[styles.badgeText,
                      item.status === 'Confirmed' ? styles.badgeTextApproved :
                      item.status === 'Pending' ? styles.badgeTextPending :
                      item.status === 'Completed' ? { color: '#4A90D9' } :
                      styles.badgeTextAdmin
                    ]}>
                      {item.status as string}
                    </Text>
                  </View>
                </View>
              </View>
            )}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={resRefetching} onRefresh={() => { setResPage(1); refetchRes(); }} tintColor={colors.amber} />}
            ListEmptyComponent={<Text style={styles.emptyText}>Aucune réservation</Text>}
            ListFooterComponent={
              resPage < resTotalPages ? (
                <TouchableOpacity
                  style={styles.loadMoreBtn}
                  onPress={() => setResPage(p => p + 1)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.loadMoreText}>Charger plus</Text>
                  <Ionicons name="chevron-down" size={16} color={colors.amber} />
                </TouchableOpacity>
              ) : null
            }
          />
        )
      ) : activeTab === 'analytics' ? (
        // MEDIUM-5: Analytics panel
        analyticsLoading ? (
          <ActivityIndicator color={colors.amber} size="large" style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={[styles.list, { paddingTop: 8 }]} showsVerticalScrollIndicator={false}>
            {/* Revenue Overview */}
            <Text style={{ fontFamily: 'Syne_700Bold', fontSize: 16, color: colors.textPrimary, marginBottom: 12 }}>Revenus</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Revenu total', value: `${((analyticsData?.totalRevenue as number) ?? 0).toLocaleString('fr-DZ')} DZD`, icon: 'cash-outline' },
                { label: 'MRR', value: `${((analyticsData?.mrr as number) ?? 0).toLocaleString('fr-DZ')} DZD`, icon: 'trending-up-outline' },
                { label: 'Moy. abonnement', value: `${((analyticsData?.avgSubscriptionValue as number) ?? 0).toLocaleString('fr-DZ')} DZD`, icon: 'receipt-outline' },
              ].map((m) => (
                <View key={m.label} style={{ flex: 1, backgroundColor: colors.carbon, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: 'rgba(232,160,32,0.15)', alignItems: 'center', gap: 4 }}>
                  <Ionicons name={m.icon as any} size={20} color={colors.amber} />
                  <Text style={{ fontFamily: 'Syne_700Bold', fontSize: 14, color: colors.textPrimary, textAlign: 'center' }}>{m.value}</Text>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 10, color: colors.textMuted, textAlign: 'center' }}>{m.label}</Text>
                </View>
              ))}
            </View>

            {/* Subscriptions by Plan */}
            <Text style={{ fontFamily: 'Syne_700Bold', fontSize: 16, color: colors.textPrimary, marginBottom: 12 }}>Abonnements par plan</Text>
            {((analyticsData?.subscriptionsByPlan as any[]) ?? []).length === 0 ? (
              <Text style={styles.emptyText}>Aucune donnée</Text>
            ) : (
              ((analyticsData?.subscriptionsByPlan as any[]) ?? []).map((p: any) => (
                <View key={p.plan_name} style={[styles.card, { flexDirection: 'row', alignItems: 'center', marginBottom: 8 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 14, color: colors.textPrimary }}>{p.plan_name}</Text>
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: colors.textSecondary }}>{p.count} abonné(s)</Text>
                  </View>
                  <Text style={{ fontFamily: 'Syne_700Bold', fontSize: 16, color: colors.amber }}>{p.count}</Text>
                </View>
              ))
            )}

            {/* Top Salons */}
            <Text style={{ fontFamily: 'Syne_700Bold', fontSize: 16, color: colors.textPrimary, marginTop: 8, marginBottom: 12 }}>Top salons (note)</Text>
            {((analyticsData?.topSalons as any[]) ?? []).length === 0 ? (
              <Text style={styles.emptyText}>Aucune donnée</Text>
            ) : (
              ((analyticsData?.topSalons as any[]) ?? []).map((s: any, i: number) => (
                <View key={s.id} style={[styles.card, { flexDirection: 'row', alignItems: 'center', marginBottom: 8 }]}>
                  <Text style={{ fontFamily: 'Syne_700Bold', fontSize: 18, color: colors.textMuted, width: 28 }}>#{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 14, color: colors.textPrimary }}>{s.name}</Text>
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: colors.textSecondary }}>{s.wilaya} • {s.total_reviews ?? 0} avis</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="star" size={14} color={colors.amber} />
                    <Text style={{ fontFamily: 'Syne_700Bold', fontSize: 14, color: colors.amber }}>{Number(s.average_rating ?? 0).toFixed(1)}</Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )
      ) : (
        usersLoading ? (
          <ActivityIndicator color={colors.amber} size="large" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item: Record<string, unknown>) => item.id as string}
            renderItem={renderUserItem}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={usersRefetching} onRefresh={() => { setUsersPage(1); refetchUsers(); }} tintColor={colors.amber} />}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Aucun utilisateur</Text>
            }
            ListFooterComponent={
              usersPage < usersTotalPages ? (
                <TouchableOpacity
                  style={styles.loadMoreBtn}
                  onPress={() => setUsersPage(p => p + 1)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.loadMoreText}>Charger plus</Text>
                  <Ionicons name="chevron-down" size={16} color={colors.amber} />
                </TouchableOpacity>
              ) : null
            }
          />
        )
      )}

      {/* User Detail Modal */}
      <Modal visible={!!selectedUser} animationType="slide" transparent onRequestClose={() => setSelectedUser(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
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
                    selectedUser.role === 'Coiffeur' ? styles.badgeBarber : styles.badgeClient
                  ]}>
                    <Text style={[
                      styles.badgeText,
                      selectedUser.role === 'Admin' ? styles.badgeTextAdmin :
                      selectedUser.role === 'Coiffeur' ? styles.badgeTextBarber : styles.badgeTextClient
                    ]}>
                      {selectedUser.role as string}
                    </Text>
                  </View>
                </View>

                {/* Info Rows */}
                <View style={styles.modalInfoGroup}>
                  <View style={styles.modalInfoRow}>
                    <Ionicons name="call-outline" size={18} color={colors.amber} />
                    <Text style={styles.modalInfoLabel}>Téléphone</Text>
                    <Text style={styles.modalInfoValue}>{(selectedUser.phone_number as string) || 'Non renseigné'}</Text>
                  </View>
                  <View style={styles.modalInfoRow}>
                    <Ionicons name="calendar-outline" size={18} color={colors.amber} />
                    <Text style={styles.modalInfoLabel}>Inscrit le</Text>
                    <Text style={styles.modalInfoValue}>{formatDate(selectedUser.created_at as string)}</Text>
                  </View>
                  <View style={styles.modalInfoRow}>
                    <Ionicons name="gift-outline" size={18} color={colors.amber} />
                    <Text style={styles.modalInfoLabel}>Points fidélité</Text>
                    <Text style={styles.modalInfoValue}>{(selectedUser.loyalty_points as number) || 0} pts</Text>
                  </View>
                  <View style={styles.modalInfoRow}>
                    <Ionicons name="finger-print-outline" size={18} color={colors.amber} />
                    <Text style={styles.modalInfoLabel}>ID</Text>
                    <Text style={[styles.modalInfoValue, { fontSize: 10 }]}>{(selectedUser.id as string)?.substring(0, 18)}...</Text>
                  </View>
                </View>

                {/* Role Actions */}
                <View style={styles.modalActions}>
                  {selectedUser.role !== 'Admin' && (
                    <>
                      {selectedUser.role === 'Client' ? (
                        <TouchableOpacity
                          style={[styles.modalActionBtn, { backgroundColor: 'rgba(46,204,113,0.12)', borderColor: 'rgba(46,204,113,0.3)' }]}
                          onPress={() => {
                            setSelectedUser(null);
                            confirmRoleChange(selectedUser.id as string, selectedUser.role as string);
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="arrow-up-circle" size={20} color={colors.success} />
                          <Text style={[styles.modalActionText, { color: colors.success }]}>Promouvoir en Coiffeur</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.modalActionBtn, { backgroundColor: 'rgba(232,160,32,0.12)', borderColor: 'rgba(232,160,32,0.3)' }]}
                          onPress={() => {
                            setSelectedUser(null);
                            confirmRoleChange(selectedUser.id as string, selectedUser.role as string);
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="arrow-down-circle" size={20} color={colors.amber} />
                          <Text style={[styles.modalActionText, { color: colors.amber }]}>Rétrograder en Client</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                  
                  {/* Ban Account Button */}
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { backgroundColor: 'rgba(255,152,0,0.12)', borderColor: 'rgba(255,152,0,0.3)', marginTop: spacing.sm }]}
                    onPress={() => banUser(selectedUser.id as string, selectedUser.full_name as string)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="warning" size={20} color={colors.amber} />
                    <Text style={[styles.modalActionText, { color: colors.amber }]}>Bannir le compte</Text>
                  </TouchableOpacity>

                  {/* Delete Account Button */}
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { backgroundColor: 'rgba(255,82,82,0.12)', borderColor: 'rgba(255,82,82,0.3)', marginTop: spacing.sm }]}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  logoutBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,82,82,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statNumber: {
    fontFamily: 'Syne_700Bold',
    fontSize: 22,
    color: colors.textPrimary,
  },
  statLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    marginBottom: spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.amber,
  },
  tabText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.amber,
    fontFamily: 'DMSans_700Bold',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  cardSubtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeApproved: { backgroundColor: 'rgba(46,204,113,0.15)' },
  badgePending: { backgroundColor: 'rgba(232,160,32,0.15)' },
  badgeAdmin: { backgroundColor: 'rgba(232,82,82,0.15)' },
  badgeBarber: { backgroundColor: 'rgba(232,160,32,0.15)' },
  badgeClient: { backgroundColor: 'rgba(74,144,217,0.15)' },
  badgeText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
  },
  badgeTextApproved: { color: colors.success },
  badgeTextPending: { color: colors.amber },
  badgeTextAdmin: { color: colors.error },
  badgeTextBarber: { color: colors.amber },
  badgeTextClient: { color: '#4A90D9' },
  cardMeta: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  actionBtnSuccess: {
    borderColor: 'rgba(46,204,113,0.3)',
    backgroundColor: 'rgba(46,204,113,0.08)',
  },
  actionBtnDanger: {
    borderColor: 'rgba(255,82,82,0.3)',
    backgroundColor: 'rgba(255,82,82,0.08)',
  },
  actionBtnWarning: {
    borderColor: 'rgba(232,160,32,0.3)',
    backgroundColor: 'rgba(232,160,32,0.08)',
  },
  actionBtnDelete: {
    borderColor: 'rgba(255,82,82,0.3)',
    backgroundColor: 'rgba(255,82,82,0.08)',
    marginLeft: 'auto',
  },
  actionBtnText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(232,160,32,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: 'DMSans_400Regular',
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xxl,
    fontSize: 14,
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: 'rgba(232,160,32,0.08)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(232,160,32,0.2)',
  },
  loadMoreText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: colors.amber,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.ink,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  modalHeaderTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 17,
    color: colors.textPrimary,
  },
  modalContent: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  modalProfileSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  modalAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(232,160,32,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: 'rgba(232,160,32,0.3)',
  },
  modalName: {
    fontFamily: 'Syne_700Bold',
    fontSize: 20,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  modalInfoGroup: {
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    gap: spacing.sm,
  },
  modalInfoLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
  },
  modalInfoValue: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: colors.textPrimary,
  },
  modalActions: {
    gap: spacing.sm,
  },
  modalActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  modalActionText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
  },
});
