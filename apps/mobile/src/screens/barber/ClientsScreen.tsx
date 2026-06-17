// apps/mobile/src/screens/barber/ClientsScreen.tsx
// Refined Client Directory & CRM screen for Barbers/Salons

import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Linking,
  Modal,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, radius, shadows, typography } from '../../theme';
import Ionicons from '@react-native-vector-icons/ionicons';
import { formatDZD } from '@barberdz/shared/utils/formatters';
import { useTranslations } from '../../hooks/useTranslations';

interface ClientItem {
  id: string; // client_id or parsed phone
  name: string;
  phone: string;
  avatarUrl: string | null;
  loyaltyPoints: number;
  isRegistered: boolean;
  totalVisits: number;
  totalSpent: number;
  lastVisitDate: string;
  appointments: Array<{
    id: string;
    date: string;
    time: string;
    status: string;
    price: number;
  }>;
}

export function ClientsScreen() {
  const user = useAuthStore((s) => s.user);
  const { t } = useTranslations();
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientItem | null>(null);
  const [activeFilter, setActiveFilter] = useState<'total' | 'registered' | 'walkIns'>('total');

  // Fetch barber's salon
  const { data: salon, isLoading: isSalonLoading } = useQuery({
    queryKey: ['barber-salon-crm', user?.id],
    queryFn: async () => {
      if (!user) return null;
      try {
        const data = await apiClient.get<Record<string, unknown>>('/salons/my-salon');
        return data;
      } catch (e) {
        return null; // Don't crash if salon doesn't exist
      }
    },
    enabled: !!user,
  });

  const salonId = salon?.id ?? null;

  // Fetch all clients using the new backend aggregated endpoint
  const { data: clientsData = null, isLoading: isReservationsLoading, refetch } = useQuery({
    queryKey: ['barber-crm-reservations', salonId], // Keeping the same queryKey name so invalidation works
    queryFn: async () => {
      if (!salonId) return null;
      const data = await apiClient.get<any>(`/reservations/salon/${salonId}/clients`);
      return data || null;
    },
    enabled: !!salonId,
  });

  const clientsList = useMemo(() => {
    if (!clientsData) return [];
    
    // Format backend data into the UI's ClientItem structure.
    const members = (clientsData.appMembers || []).map((m: any) => ({
      id: m.id,
      name: m.full_name || 'Sans Nom',
      phone: m.phone_number || '',
      avatarUrl: m.avatar_url || null,
      loyaltyPoints: m.loyalty_points || 0,
      isRegistered: true,
      totalVisits: m.reservation_count,
      totalSpent: m.totalSpent || 0,
      lastVisitDate: m.lastVisitDate || '',
      appointments: (m.appointments || []).sort((a: any, b: any) => {
        const dateCompare = b.date.localeCompare(a.date);
        return dateCompare !== 0 ? dateCompare : b.time.localeCompare(a.time);
      }),
    }));

    const walkIns = (clientsData.walkInClients || []).map((w: any) => ({
      id: w.id,
      name: w.full_name || 'Client de passage',
      phone: w.phone_number || '',
      avatarUrl: null,
      loyaltyPoints: 0,
      isRegistered: false,
      totalVisits: w.reservation_count,
      totalSpent: w.totalSpent || 0,
      lastVisitDate: w.lastVisitDate || '',
      appointments: (w.appointments || []).sort((a: any, b: any) => {
        const dateCompare = b.date.localeCompare(a.date);
        return dateCompare !== 0 ? dateCompare : b.time.localeCompare(a.time);
      }),
    }));

    // Only include clients who have at least one non-cancelled appointment
    const allClients = [...members, ...walkIns].filter(
      (c) => c.appointments.some((a: any) => a.status !== 'Cancelled')
    );

    return allClients.sort((a, b) => b.totalVisits - a.totalVisits);
  }, [clientsData]);

  // Filter based on search query and active tab
  const filteredClients = useMemo(() => {
    let result = clientsList;

    if (activeFilter === 'registered') {
      result = result.filter(c => c.isRegistered);
    } else if (activeFilter === 'walkIns') {
      result = result.filter(c => !c.isRegistered);
    }

    if (!search.trim()) return result;
    const query = search.toLowerCase();
    return result.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.phone.toLowerCase().includes(query)
    );
  }, [clientsList, search, activeFilter]);

  const stats = useMemo(() => {
    const total = clientsList.length;
    const registered = clientsList.filter((c) => c.isRegistered).length;
    const walkIns = total - registered;
    return { total, registered, walkIns };
  }, [clientsList]);

  const handleCallClient = (phoneNumber: string) => {
    if (!phoneNumber) return;
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const renderClientItem = ({ item }: { item: ClientItem }) => {
    return (
      <TouchableOpacity
        style={styles.clientCard}
        onPress={() => setSelectedClient(item)}
        activeOpacity={0.8}
      >
        <View style={styles.clientHeader}>
          <View style={styles.avatarContainer}>
            {item.avatarUrl ? (
              <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.initialsContainer}>
                <Text style={styles.initialsText}>{getInitials(item.name)}</Text>
              </View>
            )}
            {item.isRegistered && (
              <View style={styles.registeredBadge}>
                <Ionicons name="checkmark-circle" size={14} color={colors.amber} />
              </View>
            )}
          </View>

          <View style={styles.clientMeta}>
            <Text style={styles.clientName}>{item.name}</Text>
            <Text style={styles.clientPhone}>{item.phone || 'Aucun numéro'}</Text>
            
            <View style={styles.badgesRow}>
              <View style={styles.visitBadge}>
                <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
                <Text style={styles.badgeText}>{item.totalVisits} visite{item.totalVisits > 1 ? 's' : ''}</Text>
              </View>
              {item.isRegistered && (
                <View style={styles.pointsBadge}>
                  <Ionicons name="star-outline" size={12} color={colors.amber} />
                  <Text style={styles.pointsText}>{item.loyaltyPoints} pts</Text>
                </View>
              )}
            </View>
          </View>

          {item.phone ? (
            <TouchableOpacity
              style={styles.callButton}
              onPress={() => handleCallClient(item.phone)}
              activeOpacity={0.7}
            >
              <Ionicons name="call" size={18} color={colors.ink} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (isSalonLoading || isReservationsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.amber} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>{t('barber.clients')}</Text>
        <Text style={styles.headerSubtitle}>{salon?.name as string}</Text>
      </View>

      {/* Stats Summary Panel */}
      <View style={styles.statsPanel}>
        <TouchableOpacity 
          style={[styles.statBox, activeFilter === 'total' && styles.statBoxActive]} 
          onPress={() => setActiveFilter('total')}
          activeOpacity={0.7}
        >
          <Text style={[styles.statVal, activeFilter === 'total' && styles.statValActive]}>{stats.total}</Text>
          <Text style={[styles.statLabel, activeFilter === 'total' && styles.statLabelActive]}>Total Clients</Text>
        </TouchableOpacity>
        
        <View style={styles.statDivider} />
        
        <TouchableOpacity 
          style={[styles.statBox, activeFilter === 'registered' && styles.statBoxActive]} 
          onPress={() => setActiveFilter('registered')}
          activeOpacity={0.7}
        >
          <Text style={[styles.statVal, activeFilter === 'registered' && styles.statValActive]}>{stats.registered}</Text>
          <Text style={[styles.statLabel, activeFilter === 'registered' && styles.statLabelActive]}>Membres App</Text>
        </TouchableOpacity>
        
        <View style={styles.statDivider} />
        
        <TouchableOpacity 
          style={[styles.statBox, activeFilter === 'walkIns' && styles.statBoxActive]} 
          onPress={() => setActiveFilter('walkIns')}
          activeOpacity={0.7}
        >
          <Text style={[styles.statVal, activeFilter === 'walkIns' && styles.statValActive]}>{stats.walkIns}</Text>
          <Text style={[styles.statLabel, activeFilter === 'walkIns' && styles.statLabelActive]}>Sans RDV</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher par nom ou téléphone..."
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {filteredClients.length > 0 ? (
        <FlatList
          data={filteredClients}
          keyExtractor={(item) => item.id}
          initialNumToRender={8}
          windowSize={5}
          maxToRenderPerBatch={10}
          removeClippedSubviews={true}
          renderItem={renderClientItem}
          contentContainerStyle={styles.listContainer}
          refreshing={isReservationsLoading}
          onRefresh={refetch}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyText}>{t('barber.no_reservations')}</Text>
          <Text style={styles.emptySubtext}>
            {search ? 'Essayez une autre recherche' : 'Les clients s\'afficheront ici après leur premier rendez-vous'}
          </Text>
        </View>
      )}

      {/* Client Detail & Appointment History Modal */}
      {selectedClient && (
        <Modal
          visible={!!selectedClient}
          animationType="slide"
          transparent
          onRequestClose={() => setSelectedClient(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Détails Client</Text>
                <TouchableOpacity onPress={() => setSelectedClient(null)} style={styles.closeModalBtn}>
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.modalBody}>
                {/* Client Profile Card */}
                <View style={styles.modalProfileCard}>
                  {selectedClient.avatarUrl ? (
                    <Image source={{ uri: selectedClient.avatarUrl }} style={styles.modalAvatarImage} />
                  ) : (
                    <View style={styles.modalAvatar}>
                      <Text style={styles.modalAvatarText}>{getInitials(selectedClient.name)}</Text>
                    </View>
                  )}
                  <Text style={styles.modalName}>{selectedClient.name}</Text>
                  <Text style={styles.modalPhone}>{selectedClient.phone || 'Aucun numéro'}</Text>
                  
                  {selectedClient.phone && (
                    <TouchableOpacity
                      style={styles.modalCallBtn}
                      onPress={() => handleCallClient(selectedClient.phone)}
                    >
                      <Ionicons name="call" size={16} color={colors.ink} />
                      <Text style={styles.modalCallBtnText}>Appeler le client</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Aggregated Stats */}
                <View style={styles.modalStatsGrid}>
                  <View style={styles.modalStatItem}>
                    <Text style={styles.modalStatVal}>{selectedClient.totalVisits}</Text>
                    <Text style={styles.modalStatLbl}>Rendez-vous</Text>
                  </View>
                  <View style={styles.modalStatItem}>
                    <Text style={styles.modalStatVal}>{formatDZD(selectedClient.totalSpent)}</Text>
                    <Text style={styles.modalStatLbl}>Total dépensé</Text>
                  </View>
                  {selectedClient.isRegistered && (
                    <View style={styles.modalStatItem}>
                      <Text style={styles.modalStatVal}>{selectedClient.loyaltyPoints}</Text>
                      <Text style={styles.modalStatLbl}>Points fidélité</Text>
                    </View>
                  )}
                </View>

                {/* History list */}
                <Text style={styles.historyTitle}>Historique des rendez-vous</Text>
                {selectedClient.appointments.map((appt) => (
                  <View key={appt.id} style={styles.historyCard}>
                    <View style={styles.historyRow}>
                      <View>
                        <Text style={styles.historyDate}>{appt.date}</Text>
                        <Text style={styles.historyTime}>{appt.time}</Text>
                      </View>
                      <View style={styles.historyRightCol}>
                        <Text style={styles.historyPrice}>{formatDZD(appt.price)}</Text>
                        <View style={[
                          styles.statusTag,
                          appt.status === 'Completed' && styles.statusCompleted,
                          appt.status === 'Confirmed' && styles.statusConfirmed,
                          appt.status === 'Cancelled' && styles.statusCancelled,
                        ]}>
                          <Text style={[
                            styles.statusTagText,
                            appt.status === 'Completed' && styles.statusCompletedText,
                            appt.status === 'Confirmed' && styles.statusConfirmedText,
                            appt.status === 'Cancelled' && styles.statusCancelledText,
                          ]}>
                            {appt.status === 'Completed' ? t('status.completed') : appt.status === 'Confirmed' ? t('status.confirmed') : appt.status === 'Cancelled' ? t('status.cancelled') : appt.status === 'Pending' ? t('status.pending') : appt.status}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
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
  headerBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 24,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: colors.amber,
    marginTop: 2,
  },
  statsPanel: {
    flexDirection: 'row',
    backgroundColor: colors.carbon,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  statBoxActive: {
    backgroundColor: 'rgba(232, 160, 32, 0.1)',
  },
  statVal: {
    fontFamily: 'Syne_700Bold',
    fontSize: 20,
    color: colors.textPrimary,
  },
  statValActive: {
    color: colors.amber,
  },
  statLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
  statLabelActive: {
    color: colors.amber,
    fontFamily: 'DMSans_700Bold',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    height: '60%',
    alignSelf: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.carbon,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
  },
  listContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  clientCard: {
    backgroundColor: colors.carbon,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  clientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.graphite,
  },
  initialsContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.graphite,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  initialsText: {
    fontFamily: 'Syne_700Bold',
    fontSize: 16,
    color: colors.amber,
  },
  registeredBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.ink,
    borderRadius: 8,
  },
  clientMeta: {
    flex: 1,
  },
  clientName: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: colors.textPrimary,
  },
  clientPhone: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  badgesRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  visitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.graphite,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    gap: 4,
  },
  badgeText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 10,
    color: colors.textSecondary,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(232, 160, 32, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(232, 160, 32, 0.15)',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    gap: 4,
  },
  pointsText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 10,
    color: colors.amber,
  },
  callButton: {
    backgroundColor: colors.amber,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.amber,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    marginTop: spacing.xxl,
  },
  emptyText: {
    fontFamily: 'Syne_700Bold',
    fontSize: 18,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.ink,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
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
  modalTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 18,
    color: colors.textPrimary,
  },
  closeModalBtn: {
    padding: spacing.xs,
  },
  modalBody: {
    padding: spacing.lg,
  },
  modalProfileCard: {
    alignItems: 'center',
    backgroundColor: colors.carbon,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  modalAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.graphite,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalAvatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalAvatarText: {
    fontFamily: 'Syne_700Bold',
    fontSize: 22,
    color: colors.amber,
  },
  modalName: {
    fontFamily: 'Syne_700Bold',
    fontSize: 18,
    color: colors.textPrimary,
  },
  modalPhone: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  modalCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.amber,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    gap: spacing.xs,
    ...shadows.amber,
  },
  modalCallBtnText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
    color: colors.ink,
  },
  modalStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    gap: spacing.md,
  },
  modalStatItem: {
    flex: 1,
    backgroundColor: colors.carbon,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  modalStatVal: {
    fontFamily: 'Syne_700Bold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  modalStatLbl: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  historyTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 15,
    color: colors.textPrimary,
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },
  historyCard: {
    backgroundColor: colors.carbon,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyDate: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: colors.textPrimary,
  },
  historyTime: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  historyRightCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  historyPrice: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: colors.amber,
  },
  statusTag: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  statusTagText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 9,
  },
  statusCompleted: {
    backgroundColor: 'rgba(46, 204, 113, 0.1)',
  },
  statusCompletedText: {
    color: colors.success,
  },
  statusConfirmed: {
    backgroundColor: 'rgba(39, 174, 96, 0.1)',
  },
  statusConfirmedText: {
    color: '#27ae60',
  },
  statusCancelled: {
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
  },
  statusCancelledText: {
    color: colors.error,
  },
});
