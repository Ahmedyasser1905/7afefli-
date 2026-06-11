// apps/mobile/src/hooks/useNotificationSetup.ts
// Initializes push notification registration & response handling on app start.
// Tapping a notification navigates to the relevant screen (deep-link).
// MEDIUM-3: Also registers Linking listeners for payment success/failure deep links.

import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../store/authStore';
import { registerForPushNotifications } from '../lib/notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { navigationRef } from '../navigation/navigationRef';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

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

    // Register push token with our backend
    registerForPushNotifications(session.user.id);

    if (isExpoGo) return;

    let subscription: { remove: () => void } | null = null;

    try {
      const Notifications = require('expo-notifications');

      subscription = Notifications.addNotificationResponseReceivedListener(
        (response: { notification: { request: { content: { data: Record<string, unknown> } } } }) => {
          const data = response.notification.request.content.data;

          if (!navigationRef.isReady()) return;

          // Navigate based on notification type
          if (data.type === 'new_booking' && data.salonId) {
            navigationRef.navigate('BarberApp' as never);
          } else if (
            data.type === 'booking_confirmed' ||
            data.type === 'booking_cancelled' ||
            data.type === 'completed' ||
            data.type === 'booking_reminder'
          ) {
            navigationRef.navigate('ClientApp' as never);
          } else if (
            data.type === 'salon_approved' ||
            data.type === 'salon_rejected' ||
            data.type === 'new_review' ||
            data.type === 'subscription_expiring' ||
            data.type === 'subscription_activated'
          ) {
            navigationRef.navigate('BarberApp' as never);
          } else if (data.reservationId) {
            navigationRef.navigate('ClientApp' as never);
          }
        },
      );
    } catch {
      // expo-notifications not available in this environment
    }

    return () => {
      subscription?.remove();
    };
  }, [session?.user?.id]);
}
