import React, { useState, useEffect, useRef } from 'react';
import { ActivityIndicator, View, StyleSheet, Text, ScrollView, LogBox, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Syne_700Bold, Syne_600SemiBold } from '@expo-google-fonts/syne';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { AppNavigator } from './src/navigation/AppNavigator';
import { queryClient } from './src/lib/queryClient';
import { SplashScreen } from './src/screens/SplashScreen';
import { colors } from './src/theme';
import * as ExpoSplashScreen from 'expo-splash-screen';
import Toast from 'react-native-toast-message';
import { toastConfig } from './src/components/ui/CustomToast';

// Keep the native splash screen visible while we fetch resources
ExpoSplashScreen.preventAutoHideAsync();

// ── Error Boundary to capture stack trace ──
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('🔴 ErrorBoundary caught:', error.message);
    console.error('🔴 Stack:', error.stack);
    console.error('🔴 Component stack:', info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#111', padding: 20, paddingTop: 60 }}>
          <Text style={{ color: '#EF4444', fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>App Error</Text>
          <Text style={{ color: '#F5F5F5', fontSize: 14, marginBottom: 8 }}>{this.state.error.message}</Text>
          <ScrollView>
            <Text style={{ color: '#888', fontSize: 11 }}>{this.state.error.stack}</Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

/**
 * H2 Fix: Handle Chargily payment return deep links.
 * When the barber completes checkout in the browser, Chargily redirects back to
 * hafefli://payment/success or hafefli://payment/failure.
 * We intercept that link here, invalidate the subscription query cache, and
 * show a toast so the barber gets immediate in-app feedback.
 */
function usePaymentDeepLink() {
  const handledRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleUrl = (url: string) => {
      // Deduplicate — Linking can fire twice for the same URL on some Android versions
      if (handledRef.current.has(url)) return;
      handledRef.current.add(url);

      if (url.includes('hafefli://payment/success') || url.includes('payment/success')) {
        // Invalidate subscription queries so the plan badge refreshes immediately
        queryClient.invalidateQueries({ queryKey: ['my-plan'] });
        queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
        queryClient.invalidateQueries({ queryKey: ['client-plan'] });

        Toast.show({
          type: 'success',
          text1: '✅ Paiement réussi',
          text2: 'Votre abonnement a été activé avec succès.',
          visibilityTime: 5000,
        });
      } else if (url.includes('hafefli://payment/failure') || url.includes('payment/failure')) {
        Toast.show({
          type: 'error',
          text1: '❌ Paiement échoué',
          text2: 'Le paiement n\'a pas abouti. Veuillez réessayer.',
          visibilityTime: 5000,
        });
      } else if (url.includes('hafefli://payment/cancel') || url.includes('payment/cancel')) {
        Toast.show({
          type: 'error',
          text1: 'Paiement annulé',
          text2: 'Vous avez annulé le paiement.',
          visibilityTime: 4000,
        });
      }
    };

    // Handle app opened from a deep link (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    }).catch(() => {});

    // Handle deep links while app is already running (warm start)
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));

    return () => {
      subscription.remove();
    };
  }, []);
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [fontsLoaded] = useFonts({
    Syne_700Bold,
    Syne_600SemiBold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  // H2: Register payment deep-link handler at app root level
  usePaymentDeepLink();

  if (!fontsLoaded) {
    return null;
  }

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} onReady={() => ExpoSplashScreen.hideAsync().catch(() => {})} />;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <AppNavigator />
          <Toast config={toastConfig} />
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
