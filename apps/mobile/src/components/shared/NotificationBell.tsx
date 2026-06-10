import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import { colors, radius } from '../../theme';
import Ionicons from "@react-native-vector-icons/ionicons";
import { useAuthStore } from '../../store/authStore';

export function NotificationBell() {
  const navigation = useNavigation();
  const session = useAuthStore((s) => s.session);

  const { data: count = 0 } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      const data = await apiClient.get<{ count: number }>('/notifications/unread-count');
      return data?.count || 0;
    },
    enabled: !!session,
    refetchInterval: 30000, // Check every 30 seconds
  });

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.7}
      onPress={() => navigation.getParent()?.navigate('Notifications' as never)}
    >
      <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.error,
    borderRadius: radius.full,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.ink,
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontFamily: 'DMSans_700Bold',
  },
});
