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
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientItem | null>(null);

  // Fetch barber's salon
  const { data: salon, isLoading: isSalonLoading } = useQuery({
    queryKey: ['barber-salon-crm', user?.id],
    queryFn: async () => {
      if (!user) return null;
      try {
        const data = await apiClient.get<any>('/salons/my-salon');
        return data;
      } catch (e) {
        return null; // Don't crash if salon doesn't exist
      }
    },
    enabled: !!user,
  });

  const salonId = salon?.id ?? null;

  // Fetch all reservations for client aggregation
  const { data: reservations = [], isLoading: isReservationsLoading, refetch } = useQuery({
    queryKey: ['barber-crm-reservations', salonId],
    queryFn: async () => {
      if (!salonId) return [];
      const data = await apiClient.get<any[]>(`/reservations/salon/${salonId}`);
      return data || [];
    },
    enabled: !!salonId,
  });

  // Aggregate reservations to build client directory
  const clientsList = useMemo(() => {
    const clientsMap = new Map<string, ClientItem>();

    reservations.forEach((res: any) => {
      const isWalkIn = !res.client_id;
      let clientId = '';
      let clientName = 'Client de passage';
      let clientPhone = (res.client_phone as string) || '';
      let avatarUrl: string | null = null;
      let loyaltyPoints = 0;
      let isRegistered = false;

      if (!isWalkIn && res.profiles) {
        const profile = res.profiles as any;
        // Use client_id from the reservation row (always present for registered clients)
        clientId = res.client_id as string;
        clientName = (profile.full_name as string) || 'Sans Nom';
        clientPhone = (profile.phone_number as string) || (res.client_phone as string) || '';
        avatarUrl = (profile.avatar_url as string) || null;
        loyaltyPoints = (profile.loyalty_points as number) || 0;
        isRegistered = true;
      } else {
        // Parse Walk-In client from notes
        const notes = (res.notes as string) || '';
        if (notes.startsWith('[Sans RDV]')) {
          const nameMatch = notes.match(/Client:\s*([^\n]+)/);
          const telMatch = notes.match(/Tel:\s*([^\n]+)/);
          if (nameMatch) clientName = nameMatch[1].trim();
          if (telMatch) {
            clientPhone = telMatch[1].trim();
          } else if (res.client_phone) {
            clientPhone = res.client_phone as string;
          }
        }
        clientId = clientPhone ? `walkin-${clientPhone}` : `walkin-${res.id}`;
      }

      if (!clientId) return;

      // services is returned as an object {service_name, price, duration_minutes}
      const services = res.services as any | null;
      const price = (services?.price as number) || 0;

      const appt = {
        id: res.id as string,
        date: res.appointment_date as string,
        time: res.start_time as string,
        status: res.status as string,
        price,
      };

      if (clientsMap.has(clientId)) {
        const existing = clientsMap.get(clientId)!;
        existing.totalVisits += 1;
        if (res.status !== 'Cancelled') {
          existing.totalSpent += price;
        }
        existing.appointments.push(appt);
        if (new Date(res.appointment_date) > new Date(existing.lastVisitDate)) {
          existing.lastVisitDate = res.appointment_date;
        }
      } else {
        clientsMap.set(clientId, {
          id: clientId,
          name: clientName,
          phone: clientPhone,
          avatarUrl,
          loyaltyPoints,
          isRegistered,
          totalVisits: 1,
          totalSpent: res.status !== 'Cancelled' ? price : 0,
          lastVisitDate: res.appointment_date,
          appointments: [appt],
        });
      }
    });

    // Sort appointments for each client from newest to oldest
    clientsMap.forEach((client) => {
      client.appointments.sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        return dateCompare !== 0 ? dateCompare : b.time.localeCompare(a.time);
      });
    });

    return Array.from(clientsMap.values());
  }, [reservations, user?.id]);

  // Filter based on search query
  const filteredClients = useMemo(() => {
    if (!search.trim()) return clientsList;
    const query = search.toLowerCase();
    return clientsList.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.phone.toLowerCase().includes(query)
    );
  }, [clientsList, search]);

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
        <Text style={styles.headerTitle}>Gestion Clients</Text>
        <Text style={styles.headerSubtitle}>{salon?.name}</Text>
      </View>

      {/* Stats Summary Panel */}
      <View style={styles.statsPanel}>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total Clients</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{stats.registered}</Text>
          <Text style={styles.statLabel}>Membres App</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{stats.walkIns}</Text>
          <Text style={styles.statLabel}>Sans RDV</Text>
        </View>
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
          renderItem={renderClientItem}
          contentContainerStyle={styles.listContainer}
          refreshing={isReservationsLoading}
          onRefresh={refetch}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyText}>Aucun client trouvé</Text>
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
                            {appt.status}
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
  },
  statVal: {
    fontFamily: 'Syne_700Bold',
    fontSize: 20,
    color: colors.textPrimary,
  },
  statLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
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
