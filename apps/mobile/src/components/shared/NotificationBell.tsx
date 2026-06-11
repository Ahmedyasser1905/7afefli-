import React, { useEffect } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import { colors, radius } from '../../theme';
import Ionicons from "@react-native-vector-icons/ionicons";
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { navigationRef } from '../../navigation/navigationRef';

export function NotificationBell() {
  const session = useAuthStore((s) => s.session);
  const queryClient = useQueryClient();

  const { data: count = 0 } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      const data = await apiClient.get<{ count: number }>('/notifications/unread-count');
      return data?.count || 0;
    },
    enabled: !!session,
    refetchOnMount: true,
    // No refetchInterval — Supabase Realtime subscription below handles live updates
  });

  // Realtime subscription — listens for new notifications INSERT events
  useEffect(() => {
    if (!session?.user?.id) return;

    const channelName = `notifications:${session.user.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${session.user.id}`,
        },
        () => {
          // Invalidate both queries so the badge and list refresh instantly
          queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, queryClient]);

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.7}
      onPress={() => navigationRef.current?.navigate('Notifications' as never)}
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

