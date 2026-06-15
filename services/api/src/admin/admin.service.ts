// services/api/src/admin/admin.service.ts

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { invalidateRoleCache } from '../auth/auth.guard';
import { NotificationsService } from '../notifications/notifications.service';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { UpdateAdminSalonDto } from './dto/update-admin-salon.dto';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * List all salons pending approval.
   */
  async getPendingSalons() {
    const { data, error } = await this.supabase.adminClient
      .from('salons')
      .select(`
        *,
        profiles!salons_owner_id_fkey(full_name, phone_number)
      `)
      .eq('is_approved', false)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Failed to fetch pending salons: ${error.message}`);
    return data;
  }

  /**
   * Approve or reject a salon.
   */
  async approveSalon(salonId: string, approved: boolean) {
    const { data: salon } = await this.supabase.adminClient
      .from('salons')
      .select('id, owner_id')
      .eq('id', salonId)
      .single();

    if (!salon) throw new NotFoundException('Salon not found');

    const { data, error } = await this.supabase.adminClient
      .from('salons')
      .update({ is_approved: approved })
      .eq('id', salonId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update salon approval: ${error.message}`);

    // Notify the salon owner of the approval decision (fire-and-forget)
    if (salon.owner_id) {
      if (approved) {
        this.notificationsService.createNotification(
          salon.owner_id,
          'salon_approved',
          '\u2705 Salon approuv\u00e9',
          'Votre salon a \u00e9t\u00e9 approuv\u00e9 et est maintenant visible par les clients.',
          { salonId },
        ).catch(() => {});
      } else {
        this.notificationsService.createNotification(
          salon.owner_id,
          'salon_rejected',
          '\u274c Salon non approuv\u00e9',
          'Votre salon n\u2019a pas \u00e9t\u00e9 approuv\u00e9. Contactez le support pour plus d\u2019informations.',
          { salonId },
        ).catch(() => {});
      }
    }

    return data;
  }

  async getAllSalons(page: number = 1, limit: number = 50) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, count, error } = await this.supabase.adminClient
      .from('salons')
      .select('*, profiles:owner_id(full_name, phone_number)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message);
    return { data, total: count, page, limit };
  }

  async deleteSalon(salonId: string, skipOwnerDeletion: boolean = false) {
    // 1. Find owner BEFORE deleting the salon so we can clean up their account too
    const { data: salon } = await this.supabase.adminClient
      .from('salons')
      .select('owner_id')
      .eq('id', salonId)
      .single();

    // 2. Manual cascade delete to prevent orphaned records
    await Promise.all([
      this.supabase.adminClient.from('salon_staff').delete().eq('salon_id', salonId),
      this.supabase.adminClient.from('portfolio_photos').delete().eq('salon_id', salonId),
      this.supabase.adminClient.from('user_subscriptions').delete().eq('salon_id', salonId),
      this.supabase.adminClient.from('reservations').delete().eq('salon_id', salonId),
      this.supabase.adminClient.from('reviews').delete().eq('salon_id', salonId),
      this.supabase.adminClient.from('services').delete().eq('salon_id', salonId),
      this.supabase.adminClient.from('salon_favorites').delete().eq('salon_id', salonId),
      this.supabase.adminClient.from('payments').delete().eq('salon_id', salonId),
    ]);

    // 3. Delete the salon
    const { error } = await this.supabase.adminClient
      .from('salons')
      .delete()
      .eq('id', salonId);
    if (error) throw new Error(error.message);

    // 4. Delete the owner's account and profile to prevent orphans
    if (!skipOwnerDeletion && salon?.owner_id) {
      await this.deleteUser(salon.owner_id, true);
    }

    return { success: true };
  }

  async deleteUser(userId: string, skipSalonDeletion: boolean = false) {
    // 1. Find and delete all owned salons (which will cascade clean up)
    if (!skipSalonDeletion) {
      const { data: salons } = await this.supabase.adminClient
        .from('salons')
        .select('id')
        .eq('owner_id', userId);
      
      if (salons && salons.length > 0) {
        for (const salon of salons) {
          await this.deleteSalon(salon.id, true);
        }
      }
    }

    // 2. Delete user's personal references
    await Promise.all([
      this.supabase.adminClient.from('reservations').delete().eq('client_id', userId),
      this.supabase.adminClient.from('reviews').delete().eq('client_id', userId),
      this.supabase.adminClient.from('salon_staff').delete().eq('profile_id', userId),
      this.supabase.adminClient.from('salon_favorites').delete().eq('user_id', userId),
      this.supabase.adminClient.from('notifications').delete().eq('user_id', userId),
    ]);

    // 3. Delete profile
    await this.supabase.adminClient.from('profiles').delete().eq('id', userId);

    // 4. Delete Auth User
    const { error: authError } = await this.supabase.adminClient.auth.admin.deleteUser(userId);
    // Ignore error if user is already deleted
    if (authError && !authError.message.includes('User not found')) {
      throw new Error(`Failed to delete user auth: ${authError.message}`);
    }

    return { success: true };
  }

  async deleteReservation(reservationId: string) {
    const { error } = await this.supabase.adminClient
      .from('reservations')
      .delete()
      .eq('id', reservationId);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  async banUser(userId: string, isBanned: boolean) {
    // Supabase Auth admin API allows banning users by setting a ban_duration
    // 87600h is ~10 years
    const { error } = await this.supabase.adminClient.auth.admin.updateUserById(userId, {
      ban_duration: isBanned ? '87600h' : 'none'
    });
    
    if (error) throw new Error(`Failed to update user ban status: ${error.message}`);
    
    // Optionally update the profile if we want to store it in DB
    // but the Auth layer is sufficient for access denial.
    return { success: true, isBanned };
  }

  async getAllUsers(page: number = 1, limit: number = 50) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, count, error } = await this.supabase.adminClient
      .from('profiles')
      .select('id, full_name, phone_number, role, avatar_url, wilaya, is_phone_verified, loyalty_points, created_at, updated_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message);
    return { data, total: count, page, limit };
  }

  async changeUserRole(userId: string, newRole: string) {
    const { data, error } = await this.supabase.adminClient
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Invalidate the role cache so the change takes effect immediately
    invalidateRoleCache(userId);

    return data;
  }

  /**
   * Get platform-wide statistics for the admin dashboard.
   */
  async getStats() {
    const [
      { count: totalSalons },
      { count: activeSalons },
      { count: pendingSalons },
      { count: totalUsers },
      { count: totalReservations },
    ] = await Promise.all([
      this.supabase.adminClient.from('salons').select('*', { count: 'exact', head: true }),
      this.supabase.adminClient.from('salons').select('*', { count: 'exact', head: true }).eq('is_approved', true),
      this.supabase.adminClient.from('salons').select('*', { count: 'exact', head: true }).eq('is_approved', false),
      this.supabase.adminClient.from('profiles').select('*', { count: 'exact', head: true }),
      this.supabase.adminClient.from('reservations').select('*', { count: 'exact', head: true }),
    ]);

    return {
      totalSalons,
      activeSalons,
      pendingSalons,
      totalUsers,
      totalReservations,
    };
  }

  async getAuditLogs(page: number = 1, limit: number = 50) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, count, error } = await this.supabase.adminClient
      .from('audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message);
    return { data, total: count, page, limit };
  }

  async exportAuditLogsCsv(): Promise<string> {
    const { data, error } = await this.supabase.adminClient
      .from('audit_log')
      .select('created_at, action, actor_id, resource, ip_address');
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return 'created_at,action,actor_id,resource,ip_address';

    const header = 'created_at,action,actor_id,resource,ip_address\n';
    const sanitize = (val: unknown) => {
      if (val === null || val === undefined) return '""';
      let str = String(val);
      if (/^[=+\-@\t\r]/.test(str)) {
        str = "'" + str;
      }
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = data.map(log => 
      `${sanitize(log.created_at)},${sanitize(log.action)},${sanitize(log.actor_id)},${sanitize(log.resource)},${sanitize(log.ip_address)}`
    ).join('\n');
    return header + rows;
  }

  async getRevenueStats() {
    const { data, error } = await this.supabase.adminClient
      .from('payments')
      .select('amount, status, created_at')
      .eq('status', 'Completed')
      .limit(10000); // safeguard against unbounded in-memory accumulation
    if (error) throw new Error(error.message);

    const totalRevenue = data.reduce((sum, p) => sum + Number(p.amount), 0);
    return { totalRevenue, totalPayments: data.length };
  }

  async sponsorSalon(salonId: string, days: number) {
    const sponsoredUntil = new Date();
    sponsoredUntil.setDate(sponsoredUntil.getDate() + days);
    
    const { data, error } = await this.supabase.adminClient
      .from('salons')
      .update({ is_sponsored: true, sponsored_until: sponsoredUntil.toISOString() })
      .eq('id', salonId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async unsponsorSalon(salonId: string) {
    const { data, error } = await this.supabase.adminClient
      .from('salons')
      .update({ is_sponsored: false, sponsored_until: null })
      .eq('id', salonId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async getAllReservations(page: number = 1, limit: number = 50) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, count, error } = await this.supabase.adminClient
      .from('reservations')
      .select(`
        *,
        profiles!reservations_client_id_fkey(full_name, phone_number),
        salons(name),
        services(service_name, price)
      `, { count: 'exact' })
      .order('appointment_date', { ascending: false })
      .order('start_time', { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message);
    return { data, total: count, page, limit };
  }

  async getAllSubscriptions() {
    const { data, error } = await this.supabase.adminClient
      .from('user_subscriptions')
      // FIX-2: Join plans to get name/price instead of displaying raw UUIDs
      .select('*, plans(name, price), salons(name)')
      .order('starts_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  }

  /**
   * MEDIUM-5: GET /admin/analytics
   * Returns aggregated revenue, subscription breakdown, and top salons.
   */
  async getAnalytics() {
    const [paymentsResult, subsResult, topSalonsResult] = await Promise.all([
      this.supabase.adminClient
        .from('payments')
        .select('amount, status, created_at')
        .eq('status', 'Completed')
        .limit(10000),
      this.supabase.adminClient
        .from('user_subscriptions')
        .select('status, plans(name, price)')
        .eq('status', 'Active')
        .limit(1000),
      this.supabase.adminClient
        .from('salons')
        .select('id, name, wilaya, average_rating, total_reviews')
        .eq('is_approved', true)
        .not('average_rating', 'is', null)
        .order('average_rating', { ascending: false })
        .limit(10),
    ]);

    const payments = paymentsResult.data ?? [];
    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

    // MRR = sum of active subscription prices
    // NOTE: Supabase returns the plans relation as an array even for to-one joins
    // when using the shorthand select syntax — normalise with [0] to get the first (only) element.
    type SubRow = { plans: { name: string; price: number }[] | null };
    const subs = (subsResult.data as unknown as SubRow[]) ?? [];
    const mrr = subs.reduce((sum, s) => sum + Number(s.plans?.[0]?.price ?? 0), 0);
    const avgSubscriptionValue = subs.length > 0 ? mrr / subs.length : 0;

    // Group active subscriptions by plan name
    const planCounts: Record<string, number> = {};
    for (const s of subs) {
      const name = s.plans?.[0]?.name ?? 'Inconnu';
      planCounts[name] = (planCounts[name] ?? 0) + 1;
    }
    const subscriptionsByPlan = Object.entries(planCounts).map(([plan_name, count]) => ({ plan_name, count }));

    return {
      totalRevenue,
      mrr,
      avgSubscriptionValue: Math.round(avgSubscriptionValue),
      subscriptionsByPlan,
      topSalons: topSalonsResult.data ?? [],
    };
  }

  /**
   * GET /admin/payments — paginated payment records with joined salon data.
   */
  async getPayments(page: number = 1, limit: number = 50) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, count, error } = await this.supabase.adminClient
      .from('payments')
      .select('id, amount, status, created_at, salon_id, salons(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message);
    return { data, total: count, page, limit };
  }

  /**
   * GET /admin/reviews — all reviews for moderation.
   */
  async getAllReviews(page: number = 1, limit: number = 50) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, count, error } = await this.supabase.adminClient
      .from('reviews')
      .select(
        'id, rating, body, created_at, salons(name), profiles!reviews_client_id_fkey(full_name)',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message);
    return { data, total: count, page, limit };
  }

  /**
   * DELETE /admin/reviews/:id
   */
  async deleteReview(reviewId: string) {
    const { error } = await this.supabase.adminClient
      .from('reviews')
      .delete()
      .eq('id', reviewId);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  /**
   * PATCH /admin/plans/:id — update a subscription plan.
   */
  async updatePlan(planId: string, updates: UpdatePlanDto) {
    const allowedFields = ['name', 'price', 'max_barbers', 'max_portfolio_photos', 'max_reservations', 'duration_days', 'is_active'];
    const update: Record<string, unknown> = {};
    for (const key of allowedFields) {
      const val = (updates as any)[key];
      if (val !== undefined) update[key] = val;
    }
    const { data, error } = await this.supabase.adminClient
      .from('plans')
      .update(update)
      .eq('id', planId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  /**
   * PATCH /admin/salons/:id — update salon fields (e.g. is_sponsored toggle).
   */
  async updateSalon(salonId: string, dto: UpdateAdminSalonDto) {
    const allowedFields = ['name', 'description', 'address', 'wilaya', 'commune', 'phone', 'open_time', 'close_time', 'working_days', 'is_approved', 'is_sponsored', 'is_manually_closed', 'latitude', 'longitude'];
    const update: Record<string, unknown> = {};
    for (const key of allowedFields) {
      const val = (dto as any)[key];
      if (val !== undefined) update[key] = val;
    }
    const { data, error } = await this.supabase.adminClient
      .from('salons')
      .update(update)
      .eq('id', salonId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  /**
   * Broadcast a notification to all registered app users.
   */
  async broadcastNotification(dto: BroadcastNotificationDto, adminId: string) {
    // 1. Fetch all user IDs from profiles table
    const { data: profiles, error } = await this.supabase.adminClient
      .from('profiles')
      .select('id');

    if (error) {
      throw new Error(`Failed to fetch profiles for broadcast: ${error.message}`);
    }

    if (!profiles || profiles.length === 0) {
      return { sent: 0 };
    }

    // 2. Map profiles to notifications
    const notifications = profiles.map((p) => ({
      userId: p.id,
      type: 'broadcast',
      title: dto.title,
      body: dto.body,
      data: dto.data,
    }));

    // 3. Batch insert in-app and dispatch push notifications via NotificationsService
    await this.notificationsService.createNotificationsBatch(notifications);

    // 4. Log the broadcast for audit history
    const { error: logError } = await this.supabase.adminClient
      .from('broadcast_notifications')
      .insert({
        title: dto.title,
        body: dto.body,
        data: dto.data ?? null,
        sent_by: adminId,
      });

    if (logError) {
      this.logger.error(`Failed to log broadcast notification: ${logError.message}`);
    }

    return { sent: profiles.length };
  }

  /**
   * Get paginated broadcast audit history.
   */
  async getBroadcasts(page: number = 1, limit: number = 50) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await this.supabase.adminClient
      .from('broadcast_notifications')
      .select('*, profiles:sent_by(full_name)', { count: 'exact' })
      .order('sent_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch broadcast history: ${error.message}`);
    }

    return { data, total: count, page, limit };
  }
}
