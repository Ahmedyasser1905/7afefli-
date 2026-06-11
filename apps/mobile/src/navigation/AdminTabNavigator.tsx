// apps/mobile/src/navigation/AdminTabNavigator.tsx
// Navigation structure for Admin application space

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { SettingsScreen } from '../screens/client/SettingsScreen';
import { colors } from '../theme';
import Ionicons from '@react-native-vector-icons/ionicons';
import { NotificationBell } from '../components/shared/NotificationBell';
import { View } from 'react-native';

const Tab = createBottomTabNavigator();

export function AdminTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }: { route: Record<string, unknown> }) => ({
        headerShown: route.name === 'AdminDashboard',
        headerStyle: {
          backgroundColor: colors.carbon,
          borderBottomColor: 'rgba(255, 255, 255, 0.05)',
          borderBottomWidth: 1,
        },
        headerTitle: 'Administration',
        headerTitleStyle: {
          fontFamily: 'Syne_700Bold',
          fontSize: 18,
          color: colors.textPrimary,
        },
        headerRight: () => (
          <View style={{ marginRight: 16 }}>
            <NotificationBell />
          </View>
        ),
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
        tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) => {
          let iconName: unknown = 'grid';
          if (route.name === 'AdminDashboard') {
            iconName = focused ? 'shield-checkmark' : 'shield-checkmark-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }
          return <Ionicons name={iconName} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{ tabBarLabel: 'Administration' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: 'Paramètres', headerShown: false }}
      />
    </Tab.Navigator>
  );
}
