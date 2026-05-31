// apps/mobile/src/lib/notifications.ts
// Expo Push Notifications setup & utilities

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase } from './supabase';

// Configure notification appearance (when app is in foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register the device for push notifications and save the token to Supabase.
 */
export async function registerForPushNotifications(userId: string): Promise<void> {
  if (!Device.isDevice) return; // Skip simulators

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  const finalStatus =
    existingStatus !== 'granted'
      ? (await Notifications.requestPermissionsAsync()).status
      : existingStatus;

  if (finalStatus !== 'granted') {
    console.warn('[Push] Permission denied');
    return;
  }

  const token = (
    await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID!,
    })
  ).data;

  // Upsert token in profiles table
  await supabase.from('profiles').update({ push_token: token }).eq('id', userId);
}

/**
 * Schedule a local reminder 1 hour before an appointment.
 */
export async function scheduleAppointmentReminder(reservation: {
  id: string;
  appointment_date: string;
  start_time: string;
  salon_name: string;
}): Promise<string> {
  const appointmentDt = new Date(`${reservation.appointment_date}T${reservation.start_time}`);
  const reminderDt = new Date(appointmentDt.getTime() - 60 * 60 * 1000); // 1 hour before

  const triggerId = await Notifications.scheduleNotificationAsync({
    identifier: `reminder-${reservation.id}`,
    content: {
      title: '💈 Rendez-vous dans 1 heure',
      body: `Votre rendez-vous à ${reservation.salon_name} est à ${reservation.start_time}`,
      data: { screen: 'MyAppointments', reservationId: reservation.id },
      sound: true,
    },
    trigger: { date: reminderDt },
  });

  return triggerId;
}

/**
 * Cancel a scheduled reminder (when appointment is cancelled).
 */
export async function cancelAppointmentReminder(reservationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(`reminder-${reservationId}`);
}

/**
 * Trigger an immediate local notification (for barbers on new booking).
 */
export async function triggerLocalNotification(payload: {
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      sound: true,
    },
    trigger: null, // null = show immediately
  });
}
