// apps/mobile/src/navigation/BarberTabNavigator.tsx

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';
import { DashboardScreen } from '../screens/barber/DashboardScreen';
import { CalendarScreen } from '../screens/barber/CalendarScreen';
import { colors, typography } from '../theme';

// Placeholder screens
function ClientCRMScreen() { return <View style={s.ph}><Text style={s.pt}>👥 CRM Clients</Text></View>; }
function RevenueScreen() { return <View style={s.ph}><Text style={s.pt}>📊 Revenus</Text></View>; }
function ShopSettingsScreen() { return <View style={s.ph}><Text style={s.pt}>⚙️ Paramètres</Text></View>; }

const s = StyleSheet.create({
  ph: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  pt: { ...typography.h2, color: colors.textPrimary },
});

const Tab = createBottomTabNavigator();

export function BarberTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.carbon,
          borderTopColor: colors.graphite,
          borderTopWidth: 1,
          height: 85,
          paddingBottom: 20,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.amber,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontFamily: 'DMSans_500Medium',
          fontSize: 11,
        },
        tabBarIcon: ({ focused }) => {
          const icons: Record<string, string> = {
            Dashboard: '📋',
            Calendar: '📅',
            Clients: '👥',
            Revenue: '📊',
            Settings: '⚙️',
          };
          return (
            <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
              {icons[route.name] ?? '•'}
            </Text>
          );
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
        component={ClientCRMScreen}
        options={{ tabBarLabel: 'Clients' }}
      />
      <Tab.Screen
        name="Revenue"
        component={RevenueScreen}
        options={{ tabBarLabel: 'Revenus' }}
      />
      <Tab.Screen
        name="Settings"
        component={ShopSettingsScreen}
        options={{ tabBarLabel: 'Paramètres' }}
      />
    </Tab.Navigator>
  );
}
