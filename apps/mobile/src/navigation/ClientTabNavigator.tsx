// apps/mobile/src/navigation/ClientTabNavigator.tsx
// Navigation structure for Client application space

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View } from 'react-native';
import { HomeScreen } from '../screens/client/HomeScreen';
import { SalonDetailScreen } from '../screens/client/SalonDetailScreen';
import { BookingScreen } from '../screens/client/BookingScreen';
import { MyAppointmentsScreen } from '../screens/client/MyAppointmentsScreen';
import { SettingsScreen } from '../screens/client/SettingsScreen';
import { ExploreScreen } from '../screens/client/ExploreScreen';
import { BookingConfirmScreen } from '../screens/client/BookingConfirmScreen';
import { FavoritesScreen } from '../screens/client/FavoritesScreen';
// FIX-8: Import NotificationsScreen for the new tab
import { NotificationsScreen } from '../screens/client/NotificationsScreen';
import { colors } from '../theme';
import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { useAuthStore } from '../store/authStore';

// Home stack (includes salon detail and booking flow)
const HomeStack = createNativeStackNavigator();
function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
      <HomeStack.Screen name="SalonDetail" component={SalonDetailScreen} />
      <HomeStack.Screen name="Booking" component={BookingScreen} />
      <HomeStack.Screen name="BookingConfirm" component={BookingConfirmScreen} />
    </HomeStack.Navigator>
  );
}

// Explore stack (search → salon detail → booking)
const ExploreStack = createNativeStackNavigator();
function ExploreStackNavigator() {
  return (
    <ExploreStack.Navigator screenOptions={{ headerShown: false }}>
      <ExploreStack.Screen name="ExploreMain" component={ExploreScreen} />
      <ExploreStack.Screen name="SalonDetail" component={SalonDetailScreen} />
      <ExploreStack.Screen name="Booking" component={BookingScreen} />
      <ExploreStack.Screen name="BookingConfirm" component={BookingConfirmScreen} />
    </ExploreStack.Navigator>
  );
}

const Tab = createBottomTabNavigator();

/**
 * FIX-8: Notification tab icon with unread badge — matches BarberTabNavigator pattern.
 * Reuses ['notifications-unread-count'] query so no extra API calls are made.
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
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.error,
            borderWidth: 1.5,
            borderColor: colors.ink,
          }}
        />
      )}
    </View>
  );
}

export function ClientTabNavigator() {
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
          let iconName = 'home';
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Explore') {
            iconName = focused ? 'compass' : 'compass-outline';
          } else if (route.name === 'Favorites') {
            iconName = focused ? 'heart' : 'heart-outline';
          } else if (route.name === 'Appointments') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'settings' : 'settings-outline';
          }
          // Notifications icon is handled by NotificationTabIcon component
          if (route.name === 'Notifications') return <NotificationTabIcon focused={focused} color={color} />;
          return <Ionicons name={iconName as any} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeStackNavigator}
        options={{ tabBarLabel: 'Accueil' }}
      />
      <Tab.Screen
        name="Explore"
        component={ExploreStackNavigator}
        options={{ tabBarLabel: 'Explorer' }}
      />
      <Tab.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{ tabBarLabel: 'Favoris' }}
      />
      <Tab.Screen
        name="Appointments"
        component={MyAppointmentsScreen}
        options={{ tabBarLabel: 'Mes RDV' }}
      />
      {/* FIX-8: Notifications tab — accessible from any tab, not just HomeScreen bell */}
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ tabBarLabel: 'Alertes' }}
      />
      <Tab.Screen
        name="Profile"
        component={SettingsScreen}
        options={{ tabBarLabel: 'Paramètres' }}
      />
    </Tab.Navigator>
  );
}

