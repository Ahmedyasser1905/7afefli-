// apps/admin/app/api/admin/salons/[id]/sponsor/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '../../../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../../../lib/requireAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  let days = 30;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body.days === 'number' && body.days > 0) {
      days = body.days;
    }
  } catch {
    // use default days
  }

  const sponsoredUntil = new Date();
  sponsoredUntil.setDate(sponsoredUntil.getDate() + days);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('salons')
    .update({ is_sponsored: true, sponsored_until: sponsoredUntil.toISOString() })
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('salons')
    .update({ is_sponsored: false, sponsored_until: null })
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
