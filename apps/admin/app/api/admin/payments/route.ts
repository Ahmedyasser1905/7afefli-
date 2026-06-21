// apps/admin/app/api/admin/payments/route.ts
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
      .from('payments')
      .select('id, amount, status, created_at, salon_id, salons(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
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
