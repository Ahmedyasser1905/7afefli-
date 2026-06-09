// services/api/src/admin/admin.service.ts

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { invalidateRoleCache } from '../auth/auth.guard';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly supabase: SupabaseService) {}

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
      .select('id')
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
    return data;
  }

  async getAllSalons() {
    const { data, error } = await this.supabase.adminClient
      .from('salons')
      .select('*, profiles:owner_id(full_name, phone_number)')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  }

  async deleteSalon(salonId: string) {
    // Manual cascade delete to prevent orphaned records
    await Promise.all([
      this.supabase.adminClient.from('salon_staff').delete().eq('salon_id', salonId),
      this.supabase.adminClient.from('portfolio_photos').delete().eq('salon_id', salonId),
      this.supabase.adminClient.from('user_subscriptions').delete().eq('salon_id', salonId),
      this.supabase.adminClient.from('reservations').delete().eq('salon_id', salonId),
      this.supabase.adminClient.from('reviews').delete().eq('salon_id', salonId),
      this.supabase.adminClient.from('services').delete().eq('salon_id', salonId),
    ]);

    const { error } = await this.supabase.adminClient
      .from('salons')
      .delete()
      .eq('id', salonId);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  async deleteUser(userId: string) {
    // 1. Find and delete all owned salons (which will cascade clean up)
    const { data: salons } = await this.supabase.adminClient
      .from('salons')
      .select('id')
      .eq('owner_id', userId);
    
    if (salons) {
      for (const salon of salons) {
        await this.deleteSalon(salon.id);
      }
    }

    // 2. Delete user's personal references
    await Promise.all([
      this.supabase.adminClient.from('reservations').delete().eq('client_id', userId),
      this.supabase.adminClient.from('reviews').delete().eq('client_id', userId),
      this.supabase.adminClient.from('salon_staff').delete().eq('profile_id', userId),
    ]);

    // 3. Delete profile
    await this.supabase.adminClient.from('profiles').delete().eq('id', userId);

    // 4. Delete Auth User
    const { error: authError } = await this.supabase.adminClient.auth.admin.deleteUser(userId);
    if (authError) throw new Error(`Failed to delete user auth: ${authError.message}`);

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

  async getAllUsers() {
    const { data, error } = await this.supabase.adminClient
      .from('profiles')
      .select('id, full_name, phone_number, role, avatar_url, wilaya, is_phone_verified, loyalty_points, created_at, updated_at')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
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
      .eq('status', 'Completed');
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

  async getAllReservations() {
    const { data, error } = await this.supabase.adminClient
      .from('reservations')
      .select(`
        *,
        profiles!reservations_client_id_fkey(full_name, phone_number),
        salons(name),
        services(service_name, price)
      `)
      .order('appointment_date', { ascending: false })
      .order('start_time', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  }

  async getAllSubscriptions() {
    const { data, error } = await this.supabase.adminClient
      .from('user_subscriptions')
      .select('*, salons(name)')
      .order('starts_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  }
}
