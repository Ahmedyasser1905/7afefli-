// services/api/src/notifications/notifications.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

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
   * Create a notification for a user (internal use only).
   */
  async createNotification(
    userId: string,
    type: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ) {
    const { error } = await this.supabase.adminClient
      .from('notifications')
      .insert({ user_id: userId, type, title, body, data: data ?? null });

    if (error) this.logger.error(`Failed to create notification: ${error.message}`);
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
