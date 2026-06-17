// apps/admin/app/api/admin/salons/pending/route.ts
import { NextResponse } from 'next/server';
import { createAdminClient } from '../../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('salons')
      .select(`
        *,
        profiles!salons_owner_id_fkey(full_name, phone_number)
      `)
      .eq('is_approved', false)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
