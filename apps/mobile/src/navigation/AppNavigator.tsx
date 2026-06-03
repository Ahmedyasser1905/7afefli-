// apps/mobile/src/navigation/AppNavigator.tsx
// Root navigator — role-based routing with auth gate

import React, { useEffect } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { useNotificationSetup } from '../hooks/useNotificationSetup';
import { ClientTabNavigator } from './ClientTabNavigator';
import { BarberTabNavigator } from './BarberTabNavigator';
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import PhoneInputScreen from '../screens/auth/PhoneInputScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import OTPVerifyScreen from '../screens/auth/OTPVerifyScreen';
import PhoneEntryScreen from '../screens/auth/PhoneEntryScreen';
import { colors } from '../theme';

const AuthStack = createNativeStackNavigator();
function AuthStackNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="PhoneInput" component={PhoneInputScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      <AuthStack.Screen name="OTPVerify" component={OTPVerifyScreen} />
    </AuthStack.Navigator>
  );
}

// Custom dark theme aligned with brand colors
const HafefliTheme = {
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

// Helper: fetch role + phone from profile, returns { role, hasPhone }
async function fetchProfileInfo(userId: string): Promise<{ role: string; hasPhone: boolean }> {
  let role = 'Client';
  let hasPhone = false;
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role, phone_number')
      .eq('id', userId)
      .single();

    if (!error && profile) {
      if (profile.role) role = profile.role;
      hasPhone = !!profile.phone_number && profile.phone_number.trim().length > 0;
    } else if (error && error.code !== '42P17') {
      console.warn('[Auth] Error fetching profile:', error?.message);
    }
  } catch (err) {
    console.warn('[Auth] Failed to fetch profile:', err);
  }
  return { role, hasPhone };
}

export function AppNavigator() {
  const { session, role, needsPhone, clearAuth } = useAuthStore();

  // Register push notifications & listen for notification taps
  useNotificationSetup();

  

  useEffect(() => {
    // Attempt to restore existing session on app start
    const restoreSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('[Auth] Session restore failed:', error.message);
          await supabase.auth.signOut().catch(() => {});
          clearAuth();
          return;
        }
        if (session) {
          
          const { role, hasPhone } = await fetchProfileInfo(session.user.id);
          
          // Set everything atomically
          useAuthStore.setState({
            session: session,
            user: session.user,
            role: role as unknown,
            needsPhone: !hasPhone,
            isLoading: false,
          });
        } else {
          
          clearAuth();
        }
      } catch (err) {
        console.warn('[Auth] Session restore error:', err);
        clearAuth();
      }
    };

    restoreSession();

    // Listen for Supabase auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        
        if (event === 'SIGNED_OUT') {
          clearAuth();
          return;
        }

        if (event === 'TOKEN_REFRESHED' && !session) {
          console.warn('[Auth] Token refresh failed, signing out');
          await supabase.auth.signOut().catch(() => {});
          clearAuth();
          return;
        }

        if (session?.user) {
          // If the store already has this session + a role, skip re-fetching
          const currentState = useAuthStore.getState();
          if (currentState.session?.access_token === session.access_token && currentState.role) {
            
            return;
          }

          
          const { role, hasPhone } = await fetchProfileInfo(session.user.id);
          

          // Set session + role + needsPhone atomically
          useAuthStore.setState({
            session: session,
            user: session.user,
            role: role as unknown,
            needsPhone: !hasPhone,
            isLoading: false,
          });
        }
      },
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <NavigationContainer theme={HafefliTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          // Not authenticated → Auth flow
          <RootStack.Screen name="Auth" component={AuthStackNavigator} />
        ) : needsPhone ? (
          // Authenticated but no phone → Phone entry
          <RootStack.Screen name="PhoneEntry" component={PhoneEntryScreen} />
        ) : role === 'Admin' ? (
          // Admin dashboard
          <RootStack.Screen name="AdminApp" component={AdminDashboardScreen} />
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
