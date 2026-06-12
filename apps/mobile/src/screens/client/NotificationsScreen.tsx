import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import { colors, spacing, radius } from '../../theme';
import Ionicons from "@react-native-vector-icons/ionicons";
import { formatRelativeTime } from '@barberdz/shared/utils/formatters';

import { useAuthStore } from '../../store/authStore';

export function NotificationsScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.role);

  // Mark all as read when opening screen
  useEffect(() => {
    apiClient.patch('/notifications/read-all', {}).then(() => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    }).catch(() => {});
  }, [queryClient]);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      return apiClient.get<any[]>('/notifications');
    },
    staleTime: 60 * 1000, // 1 minute
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'new_booking':           return 'calendar-outline';
      case 'booking_confirmed':     return 'checkmark-circle-outline';
      case 'booking_cancelled':     return 'close-circle-outline';
      case 'cancelled':             return 'close-circle-outline';
      case 'confirmed':             return 'checkmark-circle-outline';
      case 'completed':             return 'checkmark-done-circle-outline';
      case 'new_review':            return 'star-outline';
      case 'subscription_expiring': return 'warning-outline';
      case 'subscription_activated':return 'card-outline';
      case 'salon_approved':        return 'storefront-outline';
      case 'salon_rejected':        return 'close-circle-outline';
      case 'loyalty_points':        return 'gift-outline';
      case 'system':                return 'information-circle-outline';
      default:                      return 'notifications-outline';
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'booking_confirmed':
      case 'confirmed':
      case 'salon_approved':
      case 'subscription_activated':
        return '#2ECC71';
      case 'booking_cancelled':
      case 'cancelled':
      case 'salon_rejected':
        return colors.error;
      case 'new_review':
      case 'loyalty_points':
        return colors.amber;
      case 'subscription_expiring':
        return '#E67E22';
      default:
        return colors.amber;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.amber} size="large" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-off-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Aucune notification</Text>
          <Text style={styles.emptySubtitle}>Vous n'avez pas de nouvelles notifications pour le moment.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item: any) => item.id}
          initialNumToRender={10}
          windowSize={5}
          maxToRenderPerBatch={10}
          removeClippedSubviews={true}
          contentContainerStyle={styles.list}
          renderItem={({ item }: { item: any }) => (
            <TouchableOpacity 
              style={[styles.card, !item.is_read && styles.unreadCard]}
              activeOpacity={0.7}
              onPress={() => {
                if (!item.is_read) {
                  apiClient.patch(`/notifications/${item.id}/read`, {}).then(() => {
                    queryClient.invalidateQueries({ queryKey: ['notifications'] });
                    queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
                  }).catch(() => {});
                }
                if (item.data?.reservationId) {
                  if (role === 'Coiffeur') {
                    (navigation.navigate as any)('BarberApp', { screen: 'Calendar' });
                  } else if (role === 'Client') {
                    // NotificationsScreen is a root modal — navigate to ClientApp
                    // and specify the nested Appointments tab screen
                    if (navigation.canGoBack()) {
                      navigation.goBack();
                    }
                    (navigation.navigate as any)('ClientApp', { screen: 'Appointments' });
                  }
                }
              }}
            >
              <View style={[styles.iconContainer, { backgroundColor: getIconColor(item.type) + '20' }]}>
                <Ionicons name={getIcon(item.type)} size={24} color={getIconColor(item.type)} />
              </View>
              <View style={styles.content}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.body}>{item.body}</Text>
                <Text style={styles.time}>{formatRelativeTime(new Date(item.created_at))}</Text>
              </View>
              {!item.is_read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backBtn: { padding: spacing.xs },
  headerTitle: { fontFamily: 'Syne_700Bold', fontSize: 18, color: colors.textPrimary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  emptyTitle: { fontFamily: 'Syne_600SemiBold', fontSize: 18, color: colors.textPrimary, marginTop: spacing.md },
  emptySubtitle: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
  list: { padding: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.carbon,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  unreadCard: {
    backgroundColor: 'rgba(232,160,32,0.05)',
    borderColor: 'rgba(232,160,32,0.2)',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  content: { flex: 1 },
  title: { fontFamily: 'Syne_600SemiBold', fontSize: 15, color: colors.textPrimary, marginBottom: 2 },
  body: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: colors.textSecondary, marginBottom: 6 },
  time: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: colors.textMuted },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.amber, marginLeft: spacing.sm, marginTop: spacing.sm },
});
