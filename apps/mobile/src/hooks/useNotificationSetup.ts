// apps/mobile/src/hooks/useNotificationSetup.ts
// Initializes push notification registration & response handling on app start

import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { registerForPushNotifications } from '../lib/notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Hook to be called once in AppNavigator / App root.
 * - Registers push token after login
 * - Sets up notification response listener for deep linking
 */
export function useNotificationSetup() {
  const session = useAuthStore((s) => s.session);
  const registeredRef = useRef<string | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;

    // Skip if we already registered for this user
    if (registeredRef.current === session.user.id) return;
    registeredRef.current = session.user.id;

    // Register push token (no-op in Expo Go)
    registerForPushNotifications(session.user.id);

    // Set up notification response listener (tap on notification → navigate)
    if (isExpoGo) return;

    let subscription: unknown = null;
    try {
      const Notifications = require('expo-notifications');
      subscription = Notifications.addNotificationResponseReceivedListener(
        (response: Record<string, unknown>) => {
          const data = response.notification.request.content.data;
          
          // Navigation could be handled here with a navigation ref
          // For now, just log — the app will open to the last screen
        }
      );
    } catch (err) {
      // expo-notifications not available
    }

    return () => {
      subscription?.remove?.();
    };
  }, [session?.user?.id]);
}
