// services/api/src/admin/admin.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AdminService {
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
}
