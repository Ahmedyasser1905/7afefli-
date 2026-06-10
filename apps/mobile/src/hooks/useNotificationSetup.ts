// apps/mobile/src/hooks/useNotificationSetup.ts
// Initializes push notification registration & response handling on app start.
// Tapping a notification navigates to the relevant screen (deep-link).

import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { registerForPushNotifications } from '../lib/notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { navigationRef } from '../navigation/navigationRef';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export function useNotificationSetup() {
  const session = useAuthStore((s) => s.session);
  const registeredRef = useRef<string | null>(null);

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
            // Coiffeur: new reservation arrived — go to barber dashboard
            navigationRef.navigate('BarberApp' as never);
          } else if (
            data.type === 'booking_confirmed' ||
            data.type === 'booking_cancelled' ||
            data.type === 'completed'
          ) {
            // Client: status updated by barber — go to appointments
            navigationRef.navigate('ClientApp' as never);
          } else if (
            data.type === 'salon_approved' ||
            data.type === 'salon_rejected' ||
            data.type === 'new_review' ||
            data.type === 'subscription_expiring' ||
            data.type === 'subscription_activated'
          ) {
            // Barber-specific types — go to barber dashboard
            navigationRef.navigate('BarberApp' as never);
          } else if (data.reservationId) {
            // Generic reservation notification — go to appointments
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
