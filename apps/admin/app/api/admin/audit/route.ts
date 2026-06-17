// apps/admin/app/api/admin/audit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const limitParam = req.nextUrl.searchParams.get('limit');
    const pageParam = req.nextUrl.searchParams.get('page');
    
    const limit = limitParam ? Number(limitParam) : 50;
    const page = pageParam ? Number(pageParam) : 1;
    
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const supabase = createAdminClient();
    const { data, count, error } = await supabase
      .from('audit_log')
      .select('*', { count: 'exact' })
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
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
