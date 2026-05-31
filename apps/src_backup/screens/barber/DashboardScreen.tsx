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
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { colors, typography, spacing, radius, shadows } from '../../theme';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { useRealtimeBookings } from '../../hooks/barber/useRealtimeBookings';
import { useAuthStore } from '../../store/authStore';
import { formatTime, formatRelativeTime, formatDZD, today } from '../../../../packages/shared/utils/formatters';
import type { Reservation } from '../../../../packages/shared/types';

export function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [liveItems, setLiveItems] = useState<Reservation[]>([]);

  // Fetch barber's salon
  const { data: salon } = useQuery({
    queryKey: ['barber-salon', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salons')
        .select('id, name')
        .eq('owner_id', user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const salonId = salon?.id ?? null;

  // Fetch today's bookings
  const { data: todaysBookings = [] } = useQuery<Reservation[]>({
    queryKey: ['barber-reservations', salonId, today()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('*, profiles:client_id (full_name, avatar_url), services:service_id (service_name, price)')
        .eq('salon_id', salonId!)
        .eq('appointment_date', today())
        .order('start_time', { ascending: true });
      if (error) throw error;
      return data as Reservation[];
    },
    enabled: !!salonId,
  });

  // Realtime layer
  useRealtimeBookings({
    salonId,
    onNewBooking: (reservation) => {
      setLiveItems((prev) => [reservation, ...prev]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onStatusChange: (reservation) => {
      setLiveItems((prev) =>
        prev.map((r) => (r.id === reservation.id ? reservation : r)),
      );
    },
  });

  // Merge and deduplicate
  const allItems = useMemo(() => {
    const map = new Map<string, Reservation>();
    [...(todaysBookings ?? []), ...liveItems].forEach((r) => map.set(r.id, r));
    return Array.from(map.values()).sort((a, b) =>
      a.start_time.localeCompare(b.start_time),
    );
  }, [todaysBookings, liveItems]);

  // Stats
  const stats = useMemo(() => {
    const confirmed = allItems.filter((r) => r.status === 'Confirmed' || r.status === 'Pending');
    const pending = allItems.filter((r) => r.status === 'Pending');
    const revenue = allItems
      .filter((r) => r.status === 'Completed')
      .reduce((sum, r) => sum + ((r as any).services?.price ?? 0), 0);
    return {
      total: confirmed.length,
      pending: pending.length,
      revenue,
    };
  }, [allItems]);

  // Status update mutation
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('reservations')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barber-reservations'] });
    },
  });

  const handleConfirm = useCallback((id: string) => {
    updateStatus.mutate({ id, status: 'Confirmed' });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleCancel = useCallback((id: string) => {
    Alert.alert('Annuler la réservation ?', 'Cette action est irréversible.', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui, annuler',
        style: 'destructive',
        onPress: () => updateStatus.mutate({ id, status: 'Cancelled' }),
      },
    ]);
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>
          Bonjour{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ''} 👋
        </Text>
        <Text style={styles.salonName}>{salon?.name ?? 'Mon salon'}</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statNum}>{stats.total}</Text>
          <Text style={styles.statLabel}>RDV aujourd'hui</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statNum, { color: colors.amber }]}>
            {formatDZD(stats.revenue)}
          </Text>
          <Text style={styles.statLabel}>Revenus</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statNum, { color: colors.pending }]}>{stats.pending}</Text>
          <Text style={styles.statLabel}>En attente</Text>
        </Card>
      </View>

      {/* Live Feed */}
      <Text style={styles.sectionTitle}>📋 Réservations du jour</Text>

      <FlatList
        data={allItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.feedList}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const client = (item as any).profiles;
          const service = (item as any).services;

          return (
            <Card style={styles.feedCard}>
              <View style={styles.feedRow}>
                {/* Pulsing dot */}
                <View
                  style={[
                    styles.statusDot,
                    item.status === 'Pending' && { backgroundColor: colors.pending },
                    item.status === 'Confirmed' && { backgroundColor: colors.success },
                    item.status === 'Cancelled' && { backgroundColor: colors.error },
                    item.status === 'Completed' && { backgroundColor: colors.textMuted },
                  ]}
                />

                <Avatar
                  uri={client?.avatar_url}
                  name={client?.full_name ?? 'Client'}
                  size={44}
                />

                <View style={styles.feedInfo}>
                  <Text style={styles.feedClientName}>
                    {client?.full_name ?? 'Client'}
                  </Text>
                  <Text style={styles.feedService}>
                    {service?.service_name ?? 'Service'}
                  </Text>
                  <Text style={styles.feedTime}>
                    {formatTime(item.start_time)} – {formatTime(item.end_time)}
                  </Text>
                </View>

                <View style={styles.feedActions}>
                  <Badge label={item.status} variant={item.status.toLowerCase() as any} />
                  {item.status === 'Pending' && (
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={styles.confirmBtn}
                        onPress={() => handleConfirm(item.id)}
                      >
                        <Text style={styles.confirmBtnText}>✓</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.cancelBtn}
                        onPress={() => handleCancel(item.id)}
                      >
                        <Text style={styles.cancelBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyTitle}>Pas de réservation aujourd'hui</Text>
            <Text style={styles.emptySubtitle}>
              Les nouveaux rendez-vous apparaîtront ici en temps réel
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink },
  header: { paddingTop: 60, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  greeting: { ...typography.h2, color: colors.textPrimary },
  salonName: { ...typography.bodyMd, color: colors.amber, marginTop: spacing.xs },
  statsRow: {
    flexDirection: 'row', paddingHorizontal: spacing.lg,
    gap: spacing.sm, marginBottom: spacing.lg,
  },
  statCard: { flex: 1, alignItems: 'center', padding: spacing.md },
  statNum: { ...typography.h2, color: colors.textPrimary },
  statLabel: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  feedList: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  feedCard: { marginBottom: spacing.sm },
  feedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  feedInfo: { flex: 1 },
  feedClientName: { ...typography.bodyMd, color: colors.textPrimary, fontFamily: 'DMSans_500Medium' },
  feedService: { ...typography.bodySm, color: colors.textSecondary },
  feedTime: { ...typography.caption, color: colors.amber, marginTop: 2 },
  feedActions: { alignItems: 'flex-end', gap: spacing.xs },
  actionButtons: { flexDirection: 'row', gap: spacing.xs },
  confirmBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center',
  },
  confirmBtnText: { color: '#FFF', fontFamily: 'DMSans_700Bold', fontSize: 16 },
  cancelBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { color: '#FFF', fontFamily: 'DMSans_700Bold', fontSize: 16 },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxxl },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { ...typography.h3, color: colors.textPrimary },
  emptySubtitle: { ...typography.bodyMd, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
});
