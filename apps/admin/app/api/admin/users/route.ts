// apps/admin/app/api/admin/users/route.ts
import { NextResponse } from 'next/server';
import { createAdminClient } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone_number, role, is_banned, created_at, avatar_url')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [], total: data?.length ?? 0 });
}
