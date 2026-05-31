// apps/mobile/src/navigation/ClientTabNavigator.tsx

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View, StyleSheet } from 'react-native';
import { HomeScreen } from '../screens/client/HomeScreen';
import { SalonDetailScreen } from '../screens/client/SalonDetailScreen';
import { BookingScreen } from '../screens/client/BookingScreen';
import { colors, typography } from '../theme';

// Placeholder screens
function SearchScreen() { return <View style={s.placeholder}><Text style={s.placeholderText}>🔍 Rechercher</Text></View>; }
function MyAppointmentsScreen() { return <View style={s.placeholder}><Text style={s.placeholderText}>📅 Mes RDV</Text></View>; }
function ProfileScreen() { return <View style={s.placeholder}><Text style={s.placeholderText}>👤 Profil</Text></View>; }
function BookingConfirmScreen() { return <View style={s.placeholder}><Text style={s.placeholderText}>✅ Confirmation</Text></View>; }

const s = StyleSheet.create({
  placeholder: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { ...typography.h2, color: colors.textPrimary },
});

// Home stack (includes salon detail and booking flow)
const HomeStack = createNativeStackNavigator();
function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
      <HomeStack.Screen name="SalonDetail" component={SalonDetailScreen} />
      <HomeStack.Screen name="Booking" component={BookingScreen} />
      <HomeStack.Screen name="BookingConfirm" component={BookingConfirmScreen} />
      <HomeStack.Screen name="Search" component={SearchScreen} />
    </HomeStack.Navigator>
  );
}

const Tab = createBottomTabNavigator();

export function ClientTabNavigator() {
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
            Home: '🏠',
            Explore: '🔍',
            Appointments: '📅',
            Profile: '👤',
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
        name="Home"
        component={HomeStackNavigator}
        options={{ tabBarLabel: 'Accueil' }}
      />
      <Tab.Screen
        name="Explore"
        component={SearchScreen}
        options={{ tabBarLabel: 'Explorer' }}
      />
      <Tab.Screen
        name="Appointments"
        component={MyAppointmentsScreen}
        options={{ tabBarLabel: 'Mes RDV' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profil' }}
      />
    </Tab.Navigator>
  );
}
