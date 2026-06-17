import React, { useState, useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet, Text, ScrollView, LogBox, I18nManager } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Syne_700Bold, Syne_600SemiBold } from '@expo-google-fonts/syne';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { AppNavigator } from './src/navigation/AppNavigator';
import { queryClient } from './src/lib/queryClient';
import { SplashScreenComponent } from './src/screens/SplashScreen';
import { colors } from './src/theme';
import * as ExpoSplashScreen from 'expo-splash-screen';
import Toast from 'react-native-toast-message';
import { toastConfig } from './src/components/ui/CustomToast';
import { useLanguageStore } from './src/store/languageStore';

// Keep the native splash screen visible while we fetch resources
ExpoSplashScreen.preventAutoHideAsync();

// Initialise RTL from the persisted locale BEFORE the first render.
// This runs synchronously at module load, so the initial render is already correct.
(function initRTL() {
  try {
    const raw = require('@react-native-async-storage/async-storage');
    // We cannot await here, so we rely on the zustand rehydration + I18nManager in
    // the store's setLocale to handle subsequent changes. Boot-time RTL is set from
    // the store's onRehydrateStorage callback below.
  } catch {
    // ignore
  }
})();

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

// Inner component so hooks can be used
function AppContent() {
  const [showSplash, setShowSplash] = useState(true);
  const locale = useLanguageStore((s) => s.locale);
  const isRTL = useLanguageStore((s) => s.isRTL);

  const [fontsLoaded] = useFonts({
    Syne_700Bold,
    Syne_600SemiBold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  // Apply RTL from persisted locale on boot
  useEffect(() => {
    I18nManager.forceRTL(isRTL);
  }, [isRTL]);

  useEffect(() => {
    if (fontsLoaded) {
      ExpoSplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  if (showSplash) {
    return <SplashScreenComponent onAnimationComplete={() => setShowSplash(false)} />;
  }

  return (
    // key={locale} forces a full remount of the navigation tree when language changes
    // ensuring all screens re-render with the new locale
    <SafeAreaProvider key={locale}>
      <StatusBar style="light" />
      <AppNavigator />
      <Toast config={toastConfig} />
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppContent />
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
