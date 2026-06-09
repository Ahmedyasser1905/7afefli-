// @ts-nocheck
// apps/mobile/src/navigation/BarberTabNavigator.tsx
// Navigation structure for Barber application space

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { DashboardScreen } from '../screens/barber/DashboardScreen';
import { CalendarScreen } from '../screens/barber/CalendarScreen';
import { SettingsScreen } from '../screens/client/SettingsScreen';
import { ClientsScreen } from '../screens/barber/ClientsScreen';
import { colors, typography } from '../theme';
import Ionicons from "@react-native-vector-icons/ionicons";

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { useAuthStore } from '../store/authStore';
import { SalonSetupScreen } from '../screens/barber/SalonSetupScreen';
import { MySalonScreen } from '../screens/barber/MySalonScreen';
import { SubscriptionScreen } from '../screens/barber/SubscriptionScreen';

const Tab = createBottomTabNavigator();

export function BarberTabNavigator() {
  const user = useAuthStore((s) => s.user);

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
    salon.name &&
    salon.address &&
    salon.wilaya &&
    salon.commune &&
    salon.phone &&
    salon.description &&
    salon.latitude !== null && salon.latitude !== undefined &&
    salon.longitude !== null && salon.longitude !== undefined &&
    salon.open_time &&
    salon.close_time &&
    salon.image_url &&
    salon.services && salon.services.length > 0 &&
    salon.portfolio_photos && salon.portfolio_photos.length > 0
  );

  if (!isComplete) {
    return <SalonSetupScreen onComplete={refetch} existingSalon={salon} />;
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
          let iconName: unknown = 'grid';
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
          return <Ionicons name={iconName} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarLabel: 'Accueil' }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{ tabBarLabel: 'Calendrier' }}
      />
      <Tab.Screen
        name="Clients"
        component={ClientsScreen}
        options={{ tabBarLabel: 'Clients' }}
      />
      <Tab.Screen
        name="Mon Salon"
        component={MySalonScreen}
        options={{ tabBarLabel: 'Mon Salon' }}
      />
      <Tab.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={{ tabBarLabel: 'Abonnement' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: 'Paramètres' }}
      />
    </Tab.Navigator>
  );
}
