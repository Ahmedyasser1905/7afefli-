// services/api/src/admin/admin.service.ts

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

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
    const { error } = await this.supabase.adminClient
      .from('salons')
      .delete()
      .eq('id', salonId);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  async getAllUsers() {
    const { data, error } = await this.supabase.adminClient
      .from('profiles')
      .select('id, full_name, phone_number, role, avatar_url, wilaya, is_phone_verified, created_at, updated_at')
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
      .from('subscriptions')
      .select('*, salons(name)')
      .order('starts_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  }
}
