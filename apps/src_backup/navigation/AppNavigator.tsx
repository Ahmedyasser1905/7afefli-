// apps/mobile/src/navigation/AppNavigator.tsx
// Root navigator — role-based routing with auth gate

import React, { useEffect } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { ClientTabNavigator } from './ClientTabNavigator';
import { BarberTabNavigator } from './BarberTabNavigator';
import { colors } from '../theme';

// Placeholder auth screens (to be implemented)
function PhoneInputScreen() {
  return null;
}
function OTPVerifyScreen() {
  return null;
}
function RoleSelectScreen() {
  return null;
}

const AuthStack = createNativeStackNavigator();
function AuthStackNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="PhoneInput" component={PhoneInputScreen} />
      <AuthStack.Screen name="OTPVerify" component={OTPVerifyScreen} />
      <AuthStack.Screen name="RoleSelect" component={RoleSelectScreen} />
    </AuthStack.Navigator>
  );
}

// Custom dark theme aligned with brand colors
const BarberDZTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0F0F0F',
    card: '#1A1A1A',
    text: '#F5F5F5',
    border: '#2C2C2C',
    primary: '#E8A020',
  },
};

const RootStack = createNativeStackNavigator();

export function AppNavigator() {
  const { session, role, setSession, clearAuth } = useAuthStore();

  useEffect(() => {
    // Listen for Supabase auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        if (event === 'SIGNED_OUT') clearAuth();
      },
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <NavigationContainer theme={BarberDZTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          // Not authenticated → Auth flow
          <RootStack.Screen name="Auth" component={AuthStackNavigator} />
        ) : role === 'Coiffeur' ? (
          // Barber tab navigator
          <RootStack.Screen name="BarberApp" component={BarberTabNavigator} />
        ) : (
          // Client tab navigator (default)
          <RootStack.Screen name="ClientApp" component={ClientTabNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
