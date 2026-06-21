// apps/admin/app/api/admin/reservations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../lib/requireAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const limitParam = req.nextUrl.searchParams.get('limit');
    const pageParam = req.nextUrl.searchParams.get('page');

    const limit = limitParam ? Math.min(Math.max(Number(limitParam), 1), 200) : 50;
    const page = pageParam ? Math.max(Number(pageParam), 1) : 1;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const supabase = createAdminClient();
    const { data, count, error } = await supabase
      .from('reservations')
      .select(
        `*,
        profiles!reservations_client_id_fkey(full_name, phone_number),
        salons(name),
        services(service_name, price)`,
        { count: 'exact' },
      )
      .order('appointment_date', { ascending: false })
      .order('start_time', { ascending: false })
      .range(from, to);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: data ?? [],
      total: count ?? 0,
      page,
      limit,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
