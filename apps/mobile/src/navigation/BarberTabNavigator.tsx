// apps/mobile/src/navigation/BarberTabNavigator.tsx
// Navigation structure for Barber application space

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { DashboardScreen } from '../screens/barber/DashboardScreen';
import { CalendarScreen } from '../screens/barber/CalendarScreen';
import { SettingsScreen } from '../screens/client/SettingsScreen';
import { ClientsScreen } from '../screens/barber/ClientsScreen';
import { NotificationsScreen } from '../screens/client/NotificationsScreen';
import { colors, typography } from '../theme';
import Ionicons from "@react-native-vector-icons/ionicons";

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { useAuthStore } from '../store/authStore';
import { SalonSetupScreen } from '../screens/barber/SalonSetupScreen';
import { MySalonScreen } from '../screens/barber/MySalonScreen';
import { SubscriptionScreen } from '../screens/barber/SubscriptionScreen';
import { useTranslations } from '../hooks/useTranslations';

const Tab = createBottomTabNavigator();

/**
 * Notification tab icon that shows a red badge dot when there are unread notifications.
 * Reuses the same ['notifications-unread-count'] query that NotificationBell already uses
 * so there are no extra API calls.
 */
function NotificationTabIcon({ focused, color }: { focused: boolean; color: string }) {
  const session = useAuthStore((s) => s.session);
  const { data: count = 0 } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      const data = await apiClient.get<{ count: number }>('/notifications/unread-count');
      return data?.count || 0;
    },
    enabled: !!session,
    refetchOnMount: true,
  });

  return (
    <View style={{ position: 'relative' }}>
      <Ionicons
        name={focused ? 'notifications' : 'notifications-outline'}
        size={22}
        color={color}
      />
      {count > 0 && (
        <View style={notifStyles.badgeDot} />
      )}
    </View>
  );
}

const notifStyles = StyleSheet.create({
  badgeDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
});

export function BarberTabNavigator() {
  const user = useAuthStore((s) => s.user);
  const { t } = useTranslations();

  const { data: salon, isLoading, refetch } = useQuery({
    queryKey: ['my-salon', user?.id],
    queryFn: async () => {
      try {
        return await apiClient.get('/salons/my-salon');
      } catch (err: unknown) {
        // 404 = barber doesn't have a salon yet — return null to show setup screen
        if ((err as { status?: number }).status === 404) return null;
        throw err;
      }
    },
    enabled: !!user,
    retry: false, // Don't retry 404s
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.amber} size="large" />
      </View>
    );
  }

  const isComplete = !!(
    salon &&
    (salon as any).name &&
    (salon as any).address &&
    (salon as any).wilaya &&
    (salon as any).commune &&
    (salon as any).phone &&
    (salon as any).description &&
    (salon as any).latitude !== null && (salon as any).latitude !== undefined &&
    (salon as any).longitude !== null && (salon as any).longitude !== undefined &&
    (salon as any).open_time &&
    (salon as any).close_time &&
    (salon as any).image_url &&
    (salon as any).services && (salon as any).services.length > 0 &&
    (salon as any).salon_staff && (salon as any).salon_staff.length > 0
  );

  if (!salon) {
    return <SalonSetupScreen onComplete={refetch} existingSalon={null} />;
  }

  return (
    <Tab.Navigator
      screenOptions={({ route }: { route: Record<string, unknown> }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.carbon,
          borderTopColor: 'rgba(255, 255, 255, 0.05)',
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 15,
          paddingTop: 10,
        },
        tabBarActiveTintColor: colors.amber,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontFamily: 'DMSans_500Medium',
          fontSize: 11,
          marginTop: 2,
        },
        tabBarIcon: ({ focused, color }: { focused: boolean, color: string }) => {
          let iconName: string = 'grid';
          if (route.name === 'Dashboard') {
            iconName = focused ? 'grid' : 'grid-outline';
          } else if (route.name === 'Calendar') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Clients') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Mon Salon') {
            iconName = focused ? 'storefront' : 'storefront-outline';
          } else if (route.name === 'Subscription') {
            iconName = focused ? 'card' : 'card-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }
          return <Ionicons name={iconName as any} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarLabel: t('nav.home') }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{ tabBarLabel: t('barber.calendar', 'Calendrier') }}
      />
      <Tab.Screen
        name="Clients"
        component={ClientsScreen}
        options={{ tabBarLabel: t('barber.clients', 'Clients') }}
      />
      <Tab.Screen
        name="Mon Salon"
        component={MySalonScreen}
        options={{ tabBarLabel: t('barber.my_salon', 'Mon Salon') }}
      />
      <Tab.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={{ tabBarLabel: t('barber.subscription', 'Abonnement') }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarLabel: t('nav.notifications'),
          tabBarIcon: ({ focused, color }) => (
            <NotificationTabIcon focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: t('nav.settings') }}
      />
    </Tab.Navigator>
  );
}
