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
  const [activeTab, setActiveTab] = useState<'salons' | 'users' | 'reservations'>('salons');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  // Fetch all salons via API only — Supabase bypasses backend auth guards
  const { data: salons = [], isLoading: salonsLoading, isRefetching: salonsRefetching, refetch: refetchSalons } = useQuery<any[]>({
    queryKey: ['admin-salons'],
    queryFn: () => apiClient.get<any[]>('/admin/salons'),
    staleTime: 60 * 1000,
  });

  // Fetch all users via API only
  const { data: users = [], isLoading: usersLoading, isRefetching: usersRefetching, refetch: refetchUsers } = useQuery<any[]>({
    queryKey: ['admin-users'],
    queryFn: () => apiClient.get<any[]>('/admin/users'),
    staleTime: 60 * 1000,
  });

  // Stats via API
  const { data: statsData } = useQuery<any>({
    queryKey: ['admin-stats'],
    queryFn: () => apiClient.get<any>('/admin/stats'),
    staleTime: 60 * 1000,
  });

  // Fetch all reservations via API
  const { data: reservations = [], isLoading: resLoading, isRefetching: resRefetching, refetch: refetchRes } = useQuery<any[]>({
    queryKey: ['admin-reservations'],
    queryFn: () => apiClient.get<any[]>('/admin/reservations'),
    staleTime: 60 * 1000,
    enabled: activeTab === 'reservations',
  });

  const totalSalons = statsData?.totalSalons ?? salons.length;
  const approvedSalons = statsData?.activeSalons ?? salons.filter((s: any) => s.is_approved).length;
  const pendingSalons = statsData?.pendingSalons ?? salons.filter((s: any) => !s.is_approved).length;
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

  const renderSalonItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={styles.cardSubtitle}>
            {item.wilaya} • {item.profiles?.full_name || 'Propriétaire inconnu'}
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
            {item.open_time?.substring(0, 5) || '—'} - {item.close_time?.substring(0, 5) || '—'}
          </Text>
        </View>
        {item.force_closed && (
          <View style={styles.metaItem}>
            <Ionicons name="lock-closed" size={14} color={colors.error} />
            <Text style={[styles.metaText, { color: colors.error }]}>Fermé</Text>
          </View>
        )}
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionBtn, item.is_approved ? styles.actionBtnDanger : styles.actionBtnSuccess]}
          onPress={() => toggleApproval.mutate({ salonId: item.id, approve: !item.is_approved })}
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

        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnDelete]}
          onPress={() => deleteSalon(item.id, item.name)}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={18} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderUserItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} onPress={() => setSelectedUser(item)} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View style={styles.userAvatar}>
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={{ width: 40, height: 40, borderRadius: 20 }} />
          ) : (
            <Ionicons name="person" size={20} color={colors.amber} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{item.full_name || 'Sans nom'}</Text>
          <Text style={styles.cardSubtitle}>{item.phone_number || 'Pas de téléphone'}</Text>
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
            {item.role}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>

      {/* Role change actions */}
      {item.role === 'Client' && (
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSuccess]}
            onPress={() => confirmRoleChange(item.id, item.role)}
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
            onPress={() => confirmRoleChange(item.id, item.role)}
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
      </View>

      {/* Content */}
      {activeTab === 'salons' ? (
        salonsLoading ? (
          <ActivityIndicator color={colors.amber} size="large" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={salons}
            keyExtractor={(item: any) => item.id}
            renderItem={renderSalonItem}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={salonsRefetching} onRefresh={refetchSalons} tintColor={colors.amber} />}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Aucun salon enregistré</Text>
            }
          />
        )
      ) : activeTab === 'reservations' ? (
        resLoading ? (
          <ActivityIndicator color={colors.amber} size="large" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={reservations}
            keyExtractor={(item: any) => item.id as string}
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
            refreshControl={<RefreshControl refreshing={resRefetching} onRefresh={refetchRes} tintColor={colors.amber} />}
            ListEmptyComponent={<Text style={styles.emptyText}>Aucune réservation</Text>}
          />
        )
      ) : (
        usersLoading ? (
          <ActivityIndicator color={colors.amber} size="large" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item: any) => item.id}
            renderItem={renderUserItem}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={usersRefetching} onRefresh={refetchUsers} tintColor={colors.amber} />}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Aucun utilisateur</Text>
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
                      <Image source={{ uri: selectedUser.avatar_url }} style={{ width: 80, height: 80, borderRadius: 40 }} />
                    ) : (
                      <Ionicons name="person" size={36} color={colors.amber} />
                    )}
                  </View>
                  <Text style={styles.modalName}>{selectedUser.full_name || 'Sans nom'}</Text>
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
                      {selectedUser.role}
                    </Text>
                  </View>
                </View>

                {/* Info Rows */}
                <View style={styles.modalInfoGroup}>
                  <View style={styles.modalInfoRow}>
                    <Ionicons name="call-outline" size={18} color={colors.amber} />
                    <Text style={styles.modalInfoLabel}>Téléphone</Text>
                    <Text style={styles.modalInfoValue}>{selectedUser.phone_number || 'Non renseigné'}</Text>
                  </View>
                  <View style={styles.modalInfoRow}>
                    <Ionicons name="calendar-outline" size={18} color={colors.amber} />
                    <Text style={styles.modalInfoLabel}>Inscrit le</Text>
                    <Text style={styles.modalInfoValue}>{formatDate(selectedUser.created_at)}</Text>
                  </View>
                  <View style={styles.modalInfoRow}>
                    <Ionicons name="gift-outline" size={18} color={colors.amber} />
                    <Text style={styles.modalInfoLabel}>Points fidélité</Text>
                    <Text style={styles.modalInfoValue}>{selectedUser.loyalty_points || 0} pts</Text>
                  </View>
                  <View style={styles.modalInfoRow}>
                    <Ionicons name="finger-print-outline" size={18} color={colors.amber} />
                    <Text style={styles.modalInfoLabel}>ID</Text>
                    <Text style={[styles.modalInfoValue, { fontSize: 10 }]}>{selectedUser.id?.substring(0, 18)}...</Text>
                  </View>
                </View>

                {/* Role Actions */}
                {selectedUser.role !== 'Admin' && (
                  <View style={styles.modalActions}>
                    {selectedUser.role === 'Client' ? (
                      <TouchableOpacity
                        style={[styles.modalActionBtn, { backgroundColor: 'rgba(46,204,113,0.12)', borderColor: 'rgba(46,204,113,0.3)' }]}
                        onPress={() => {
                          setSelectedUser(null);
                          confirmRoleChange(selectedUser.id, selectedUser.role);
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
                          confirmRoleChange(selectedUser.id, selectedUser.role);
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="arrow-down-circle" size={20} color={colors.amber} />
                        <Text style={[styles.modalActionText, { color: colors.amber }]}>Rétrograder en Client</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
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
