// services/api/src/notifications/notifications.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import Expo, { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly expo = new Expo();

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Get unread notifications for the authenticated user.
   */
  async getMyNotifications(userId: string, limit = 30, offset = 0) {
    const { data, error } = await this.supabase.adminClient
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error && error.code !== '42P01') {
      this.logger.error(`Failed to fetch notifications: ${error.message}`);
    }
    return data ?? [];
  }

  /**
   * Mark a notification as read.
   */
  async markAsRead(notificationId: string, userId: string) {
    const { error } = await this.supabase.adminClient
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) this.logger.error(`Failed to mark notification read: ${error.message}`);
    return { success: !error };
  }

  /**
   * Mark all notifications as read for a user.
   */
  async markAllAsRead(userId: string) {
    const { error } = await this.supabase.adminClient
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) this.logger.error(`Failed to mark all notifications read: ${error.message}`);
    return { success: !error };
  }

  /**
   * Create a notification for a user (in-app table) and also send a push notification.
   */
  async createNotification(
    userId: string,
    type: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ) {
    // 1. Write to in-app notifications table
    const { error } = await this.supabase.adminClient
      .from('notifications')
      .insert({ user_id: userId, type, title, body, data: data ?? null });

    if (error) this.logger.error(`Failed to create notification: ${error.message}`);

    // 2. Fire-and-forget push notification
    this.sendPushToUser(userId, title, body, data).catch((err) =>
      this.logger.warn(`Push failed for user ${userId}: ${err.message}`),
    );
  }

  /**
   * Save or update the Expo push token for a user.
   * Called from POST /auth/push-token.
   */
  async savePushToken(userId: string, token: string): Promise<void> {
    if (!Expo.isExpoPushToken(token)) {
      this.logger.warn(`Invalid Expo push token for user ${userId}: ${token}`);
      return;
    }

    const { error } = await this.supabase.adminClient
      .from('profiles')
      .update({ push_token: token })
      .eq('id', userId);

    if (error) {
      this.logger.error(`Failed to save push token for user ${userId}: ${error.message}`);
    }
  }

  /**
   * Send an Expo push notification to a specific user.
   * Reads the token from profiles.push_token.
   * Silently no-ops if the user has no token or an invalid one.
   */
  async sendPushToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    // Fetch push token from profiles
    const { data: profile } = await this.supabase.adminClient
      .from('profiles')
      .select('push_token')
      .eq('id', userId)
      .single();

    const token = profile?.push_token as string | null;

    if (!token || !Expo.isExpoPushToken(token)) {
      return; // No token — user hasn't enabled push or hasn't logged in on a device
    }

    const message: ExpoPushMessage = {
      to: token,
      sound: 'default',
      title,
      body,
      data: data ?? {},
    };

    try {
      const chunks = this.expo.chunkPushNotifications([message]);
      for (const chunk of chunks) {
        const tickets: ExpoPushTicket[] = await this.expo.sendPushNotificationsAsync(chunk);
        for (const ticket of tickets) {
          if (ticket.status === 'error') {
            this.logger.warn(`Expo push error for user ${userId}: ${ticket.message}`);
            // If token is invalid/unregistered, clear it so we don't keep trying
            if (
              ticket.details?.error === 'DeviceNotRegistered' ||
              ticket.details?.error === 'InvalidCredentials'
            ) {
              await this.supabase.adminClient
                .from('profiles')
                .update({ push_token: null })
                .eq('id', userId);
            }
          }
        }
      }
    } catch (err) {
      this.logger.error(`Failed to send push to user ${userId}: ${(err as Error).message}`);
    }
  }

  /**
   * Get unread count for badge display.
   */
  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await this.supabase.adminClient
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) return 0;
    return count ?? 0;
  }
}
