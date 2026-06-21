// apps/mobile/src/hooks/useNotificationSetup.ts
// Initializes push notification registration & response handling on app start.
// Tapping a notification navigates to the relevant screen (deep-link).
// MEDIUM-3: Also registers Linking listeners for payment success/failure deep links.
//
// Push notification delivery for background/killed states:
//  • Background — iOS/Android deliver the notification natively; no app code runs.
//    setNotificationHandler (configured in index.ts) controls the display.
//  • Killed — OS delivers natively. When the user taps the notification,
//    the app launches and lastNotificationResponse contains the tapped notification.
//    We handle this via useLastNotificationResponse() to navigate correctly.
//  • Foreground — setNotificationHandler fires + addNotificationReceivedListener
//    lets us react in-app (e.g. refresh badge counts).

import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../store/authStore';
import { registerForPushNotifications } from '../lib/notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { navigationRef } from '../navigation/navigationRef';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Resolve which screen to navigate to given the notification data payload
 * and the current user role.
 */
function navigateFromNotificationData(data: Record<string, unknown>) {
  if (!navigationRef.isReady()) return;
  const role = useAuthStore.getState().role;

  if (role === 'Coiffeur') {
    if (data.type === 'new_booking' || data.reservationId) {
      (navigationRef as any).navigate('BarberApp', { screen: 'Calendar' });
    } else {
      navigationRef.navigate('BarberApp' as never);
    }
  } else if (role === 'Client') {
    if (
      data.type === 'booking_confirmed' ||
      data.type === 'booking_cancelled' ||
      data.type === 'completed' ||
      data.type === 'booking_reminder' ||
      data.reservationId
    ) {
      (navigationRef as any).navigate('ClientApp', { screen: 'Appointments' });
    } else {
      // For broadcast / generic notifications navigate to the notifications tab
      (navigationRef as any).navigate('ClientApp', { screen: 'Notifications' });
    }
  } else if (role === 'Admin') {
    navigationRef.navigate('AdminApp' as never);
  }
}

export function useNotificationSetup() {
  const session = useAuthStore((s) => s.session);
  const registeredRef = useRef<string | null>(null);

  // ── MEDIUM-3: Payment deep-link handling ─────────────────────────────────
  // Handles hafefli://payment/success and hafefli://payment/failure
  // after Chargily redirects back to the app.
  useEffect(() => {
    const handleUrl = (url: string) => {
      if (url.startsWith('hafefli://payment/success')) {
        Toast.show({
          type: 'success',
          text1: 'Paiement réussi ✅',
          text2: 'Votre abonnement a été activé.',
          visibilityTime: 4000,
        });
        // Invalidate subscription queries so screens refresh immediately
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { queryClient } = require('../lib/queryClient');
          if (queryClient) {
            queryClient.invalidateQueries({ queryKey: ['my-salon-subscription'] });
            queryClient.invalidateQueries({ queryKey: ['my-salon'] });
          }
        } catch {
          // queryClient not yet accessible — subscription screen will refetch on focus
        }
      } else if (url.startsWith('hafefli://payment/failure')) {
        Toast.show({
          type: 'error',
          text1: 'Paiement échoué ❌',
          text2: "Le paiement n'a pas abouti. Veuillez réessayer.",
          visibilityTime: 4000,
        });
      }
    };

    // Handle URL when app is opened from cold-start via deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    // Handle URL while app is already foregrounded
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  // ── Push notification setup ───────────────────────────────────────────────
  useEffect(() => {
    if (!session?.user?.id) return;
    if (registeredRef.current === session.user.id) return;
    registeredRef.current = session.user.id;

    // Register push token with our backend (required for server-side push delivery)
    registerForPushNotifications(session.user.id);

    if (isExpoGo) return;

    let responseListener: { remove: () => void } | null = null;
    let receivedListener: { remove: () => void } | null = null;

    try {
      const Notifications = require('expo-notifications');

      // ── 1. Handle tapping a notification while the app was in foreground/background
      responseListener = Notifications.addNotificationResponseReceivedListener(
        (response: { notification: { request: { content: { data: Record<string, unknown> } } } }) => {
          const data = response.notification.request.content.data;
          navigateFromNotificationData(data);
        },
      );

      // ── 2. Handle notification arriving while the app is in the FOREGROUND
      //    This fires when a push arrives and the app is open — useful to update
      //    badge counts or show an in-app banner. The OS handles display via
      //    setNotificationHandler (configured in index.ts).
      receivedListener = Notifications.addNotificationReceivedListener(
        (_notification: unknown) => {
          // Invalidate the notifications query so the bell badge refreshes
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { queryClient } = require('../lib/queryClient');
            if (queryClient) {
              queryClient.invalidateQueries({ queryKey: ['notifications'] });
              queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
            }
          } catch {
            // queryClient not yet accessible
          }
        },
      );

      // ── 3. Handle the case where the app was KILLED and launched by tapping
      //    a notification. getLastNotificationResponseAsync returns the response
      //    if the app was opened via a notification tap.
      Notifications.getLastNotificationResponseAsync().then(
        (response: { notification: { request: { content: { data: Record<string, unknown> } } } } | null) => {
          if (response) {
            // Small delay to allow the navigation tree to mount
            setTimeout(() => {
              navigateFromNotificationData(response.notification.request.content.data);
            }, 500);
          }
        },
      ).catch(() => {
        // Not available in all environments — safe to ignore
      });

    } catch {
      // expo-notifications not available in this environment
    }

    return () => {
      responseListener?.remove();
      receivedListener?.remove();
    };
  }, [session?.user?.id]);
}
