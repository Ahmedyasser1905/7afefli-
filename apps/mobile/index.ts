// apps/mobile/index.ts
// Entry point — must configure the push notification handler here so it is
// registered synchronously before any component mounts. This is required for
// notifications delivered while the app is in the background or killed state:
// the OS will wake the app and the handler must be ready immediately.

import { registerRootComponent } from 'expo';

// Configure Expo push notification handler at the top level.
// This MUST run before registerRootComponent so the handler is in place
// for background/killed-state notification wakeups.
(function configureNotificationHandler() {
  try {
    // Only run in non-Expo-Go environments (standalone / EAS builds)
    const Constants = require('expo-constants').default;
    const { ExecutionEnvironment } = require('expo-constants');
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return;

    const Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    // expo-notifications not available in this build — silently skip
  }
})();

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
