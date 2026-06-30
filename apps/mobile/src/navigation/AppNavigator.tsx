// apps/mobile/src/navigation/AppNavigator.tsx
// Root navigator — role-based routing with auth gate

import React, { useEffect } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import type { UserRole } from '@barberdz/shared/types';
import { supabase } from '../lib/supabase';
import { useNotificationSetup } from '../hooks/useNotificationSetup';
import { ClientTabNavigator } from './ClientTabNavigator';
import { BarberTabNavigator } from './BarberTabNavigator';
import { AdminTabNavigator } from './AdminTabNavigator';
import { NotificationsScreen } from '../screens/client/NotificationsScreen';
import { LoyaltyPointsScreen } from '../screens/client/LoyaltyPointsScreen';
import PhoneInputScreen from '../screens/auth/PhoneInputScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import VerifyCodeScreen from '../screens/auth/VerifyCodeScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import PhoneEntryScreen from '../screens/auth/PhoneEntryScreen';
import { colors } from '../theme';
import { navigationRef } from './navigationRef';

const AuthStack = createNativeStackNavigator();
function AuthStackNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="PhoneInput" component={PhoneInputScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="VerifyCode" component={VerifyCodeScreen} />
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
async function fetchProfileInfo(user: any): Promise<{ role: string; hasPhone: boolean }> {
  let role = 'Client';
  let hasPhone = false;
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role, phone_number')
      .eq('id', user.id)
      .maybeSingle();

    if (!error && profile) {
      if (profile.role) role = profile.role;
      hasPhone = !!profile.phone_number && profile.phone_number.trim().length > 0;
    } else if (!error && !profile) {
      // Profile is missing, auto-create it using user metadata
      const metaName = user.user_metadata?.full_name || 'New User';
      // SECURITY FIX (H-3/AUTH-3): Always hardcode 'Client' — never trust
      // client-provided metadata for role assignment to prevent privilege escalation.
      const userPhone = user.phone || null;
      
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          full_name: metaName,
          phone_number: userPhone,
          role: 'Client',  // Never trust client-provided metadata for role assignment
        })
        .select('role, phone_number')
        .maybeSingle();
        
      if (!insertError && newProfile) {
        if (newProfile.role) role = newProfile.role;
        hasPhone = !!newProfile.phone_number && newProfile.phone_number.trim().length > 0;
      } else if (insertError) {
        console.warn('[Auth] Error creating missing profile:', insertError.message);
      }
    } else if (error) {
      console.warn('[Auth] Error fetching profile:', error?.message);
    }
  } catch (err) {
    console.warn('[Auth] Failed to fetch profile:', err);
  }
  return { role, hasPhone };
}

export function AppNavigator() {
  const { session, role, needsPhone, needsPasswordReset, clearAuth, isLoading } = useAuthStore();

  // Register push notifications & listen for notification taps
  useNotificationSetup();

  // Hardware back button is now handled by React Navigation natively.
  // This correctly pops nested screens, closes modals (like BottomSheet),
  // and safely moves the task to the background at the root screen.

  

  useEffect(() => {
    // Attempt to restore existing session on app start
    const restoreSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          // AuthApiError: Invalid Refresh Token — the stored token is stale/revoked.
          // Clear everything from AsyncStorage and force re-login.
          console.warn('[Auth] Session restore failed:', error.message);
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
          clearAuth();
          return;
        }
        if (session) {
          const { role, hasPhone } = await fetchProfileInfo(session.user);
          useAuthStore.setState({
            session: session,
            user: session.user,
            role: role as UserRole,
            needsPhone: !hasPhone,
            isLoading: false,
          });
        } else {
          clearAuth();
        }
      } catch (err: any) {
        // Catch any AuthApiError thrown during token refresh on startup
        console.warn('[Auth] Session restore error:', err?.message ?? err);
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
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

        // TOKEN_REFRESHED fires after a background refresh attempt.
        // If session is null here it means the refresh token was rejected
        // (expired, revoked, or "Refresh Token Not Found") — force sign-out
        // so the user lands cleanly on the login screen instead of being stuck.
        if (event === 'TOKEN_REFRESHED') {
          if (!session) {
            console.warn('[Auth] Token refresh failed — clearing session');
            await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
            clearAuth();
          }
          // If session is valid, fall through to update the store below
          return;
        }

        if (session?.user) {
          // If the store already has this session + a role, skip re-fetching
          const currentState = useAuthStore.getState();
          if (currentState.session?.access_token === session.access_token && currentState.role) {
            return;
          }

          const { role, hasPhone } = await fetchProfileInfo(session.user);

          useAuthStore.setState({
            session: session,
            user: session.user,
            role: role as UserRole,
            needsPhone: !hasPhone,
            isLoading: false,
          });
        }
      },
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  if (isLoading) {
    return null;
  }

  return (
    <NavigationContainer ref={navigationRef} theme={HafefliTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          // Not authenticated → Auth flow
          <RootStack.Screen name="Auth" component={AuthStackNavigator} />
        ) : needsPasswordReset ? (
          // Authenticated but needs password reset → Update Password
          <RootStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        ) : needsPhone ? (
          // Authenticated but no phone → Phone entry
          <RootStack.Screen name="PhoneEntry" component={PhoneEntryScreen} />
        ) : role === 'Admin' ? (
          // Admin dashboard
          <RootStack.Screen name="AdminApp" component={AdminTabNavigator} />
        ) : role === 'Coiffeur' ? (
          // Barber tab navigator
          <RootStack.Screen name="BarberApp" component={BarberTabNavigator} />
        ) : (
          // Client tab navigator (default)
          <RootStack.Screen name="ClientApp" component={ClientTabNavigator} />
        )}
        <RootStack.Group screenOptions={{ presentation: 'modal' }}>
          {/* Modal screens accessible from any tab */}
          <RootStack.Screen name="LoyaltyPoints" component={LoyaltyPointsScreen} />
        </RootStack.Group>
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
