// apps/admin/app/api/admin/salons/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../lib/requireAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const pending = req.nextUrl.searchParams.get('pending') === 'true';
  const supabase = createAdminClient();
  let query = supabase
    .from('salons')
    .select('id, name, wilaya, address, description, created_at, subscription_status, is_approved, is_sponsored, sponsored_until, profiles(full_name, phone_number)')
    .order('created_at', { ascending: false });

  if (pending) query = query.eq('is_approved', false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
