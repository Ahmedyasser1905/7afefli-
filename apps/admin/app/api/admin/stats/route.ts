// apps/admin/app/api/admin/stats/route.ts
import { NextResponse } from 'next/server';
import { createAdminClient } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createAdminClient();
    const [
      { count: totalSalons },
      { count: activeSalons },
      { count: pendingSalons },
      { count: totalUsers },
      { count: totalReservations },
      { data: revenueData },
    ] = await Promise.all([
      supabase.from('salons').select('*', { count: 'exact', head: true }),
      supabase.from('salons').select('*', { count: 'exact', head: true }).eq('is_approved', true),
      supabase.from('salons').select('*', { count: 'exact', head: true }).eq('is_approved', false),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('reservations').select('*', { count: 'exact', head: true }),
      supabase.from('payments').select('amount').eq('status', 'paid'),
    ]);

    const totalRevenue = (revenueData ?? []).reduce((sum: number, p: any) => sum + Number(p.amount ?? 0), 0);

    return NextResponse.json({
      totalSalons: totalSalons ?? 0,
      activeSalons: activeSalons ?? 0,
      pendingSalons: pendingSalons ?? 0,
      totalUsers: totalUsers ?? 0,
      totalReservations: totalReservations ?? 0,
      totalRevenue,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
