// apps/mobile/src/lib/notifications.ts
// Expo Push Notifications setup & utilities

import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

function getNotificationsModule() {
  if (isExpoGo) {
    return null;
  }
  try {
    return require('expo-notifications');
  } catch (err) {
    console.warn('[Notifications] Failed to load expo-notifications:', err);
    return null;
  }
}

const Notifications = getNotificationsModule();

// Configure notification appearance (when app is in foreground)
if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// ─────────────────────────────────────────────────────────
// 1. PUSH REGISTRATION — called once after login
// ─────────────────────────────────────────────────────────

/**
 * Register the device for push notifications and save the token to Supabase.
 * Call this after login / session restore.
 */
export async function registerForPushNotifications(userId: string): Promise<void> {
  try {
    const Notif = getNotificationsModule();
    if (!Notif) {
      
      return;
    }

    if (!Device.isDevice) {
      
      return;
    }

    // Request permissions
    const { status: existingStatus } = await Notif.getPermissionsAsync() as unknown;
    const finalStatus =
      existingStatus !== 'granted'
        ? (await Notif.requestPermissionsAsync() as unknown).status
        : existingStatus;

    if (finalStatus !== 'granted') {
      console.warn('[Push] Permission denied');
      return;
    }

    // Android notification channel
    if (Platform.OS === 'android') {
      await Notif.setNotificationChannelAsync('default', {
        name: '7afefli',
        importance: Notif.AndroidImportance?.MAX ?? 4,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E8A020',
        sound: 'default',
      });
    }

    // Get Expo push token
    const projectId = process.env.EXPO_PUBLIC_PROJECT_ID || Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn('[Push] Missing EXPO_PUBLIC_PROJECT_ID — push notifications will not work in production');
      return;
    }

    const token = (
      await Notif.getExpoPushTokenAsync({ projectId })
    ).data;

    

    // Save token to profiles table
    const { error } = await supabase
      .from('profiles')
      .update({ push_token: token })
      .eq('id', userId);

    if (error) {
      console.warn('[Push] Failed to save push token:', error.message);
    } else {
      
    }
  } catch (err) {
    console.warn('[Push] Failed to register for push notifications:', err);
  }
}

// ─────────────────────────────────────────────────────────
// 2. CLIENT REMINDER — 30 min before appointment
// ─────────────────────────────────────────────────────────

/**
 * Schedule a local reminder 30 minutes before an appointment.
 */
export async function scheduleAppointmentReminder(reservation: {
  id: string;
  appointment_date: string;
  start_time: string;
  salon_name: string;
}): Promise<string> {
  try {
    const Notif = getNotificationsModule();
    if (!Notif) {
      console.warn('[Notifications] Notifications not available in Expo Go');
      return 'expo-go-skipped';
    }

    const appointmentDt = new Date(`${reservation.appointment_date}T${reservation.start_time}`);
    const reminderDt = new Date(appointmentDt.getTime() - 30 * 60 * 1000); // 30 minutes before

    // Don't schedule if reminder time is in the past
    if (reminderDt.getTime() <= Date.now()) {
      
      return 'already-passed';
    }

    const triggerId = await Notif.scheduleNotificationAsync({
      identifier: `reminder-${reservation.id}`,
      content: {
        title: '⏰ Rendez-vous dans 30 minutes !',
        body: `Votre rendez-vous à ${reservation.salon_name} est à ${reservation.start_time}. Préparez-vous !`,
        data: { screen: 'MyAppointments', reservationId: reservation.id },
        sound: 'default',
      },
      trigger: {
        type: Notif.SchedulableTriggerInputTypes.DATE,
        date: reminderDt,
      },
    });

    
    return triggerId;
  } catch (err) {
    console.warn('[Notifications] Failed to schedule appointment reminder:', err);
    return 'failed-to-schedule';
  }
}

// ─────────────────────────────────────────────────────────
// 3. CANCEL REMINDER — when appointment is cancelled
// ─────────────────────────────────────────────────────────

/**
 * Cancel a scheduled reminder (when appointment is cancelled).
 */
export async function cancelAppointmentReminder(reservationId: string): Promise<void> {
  try {
    const Notif = getNotificationsModule();
    if (!Notif) return;
    await Notif.cancelScheduledNotificationAsync(`reminder-${reservationId}`);
    
  } catch (err) {
    console.warn('[Notifications] Failed to cancel appointment reminder:', err);
  }
}

// ─────────────────────────────────────────────────────────
// 4. INSTANT LOCAL NOTIFICATION — barber new booking alert
// ─────────────────────────────────────────────────────────

/**
 * Trigger an immediate local notification (for barbers on new booking).
 */
export async function triggerLocalNotification(payload: {
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<void> {
  try {
    const Notif = getNotificationsModule();
    if (!Notif) {
      
      return;
    }
    await Notif.scheduleNotificationAsync({
      content: {
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        sound: 'default',
      },
      trigger: {
        type: Notif.SchedulableTriggerInputTypes.DATE,
        date: new Date(Date.now() + 100), // Fire almost immediately
      },
    });
  } catch (err) {
    console.warn('[Notifications] Failed to trigger local notification:', err);
  }
}

// ─────────────────────────────────────────────────────────
// 5. GET ALL SCHEDULED NOTIFICATIONS (debug)
// ─────────────────────────────────────────────────────────

export async function getScheduledNotifications(): Promise<Record<string, unknown>[]> {
  try {
    const Notif = getNotificationsModule();
    if (!Notif) return [];
    return await Notif.getAllScheduledNotificationsAsync();
  } catch {
    return [];
  }
}
