// apps/admin/app/api/admin/salons/[id]/route.ts
//
// Security fixes applied:
//  1. requireAdmin() — JWT + Admin role verification (was completely missing)
//  2. Mass-assignment fix — whitelist allowed PATCH fields (was passing raw body directly)
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '../../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../../lib/requireAdmin';

export const dynamic = 'force-dynamic';

// Whitelist of salon fields an admin may update directly.
// Sensitive compute columns (average_rating, total_reviews, subscription_status)
// are excluded — those are maintained by DB triggers/functions only.
const ALLOWED_SALON_FIELDS = new Set([
  'name',
  'description',
  'address',
  'wilaya',
  'commune',
  'phone',
  'open_time',
  'close_time',
  'working_days',
  'is_approved',
  'is_sponsored',
  'is_manually_closed',
  'latitude',
  'longitude',
]);

// PATCH: update salon
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Strip any fields not in the whitelist
  const safeUpdate: Record<string, unknown> = {};
  for (const key of ALLOWED_SALON_FIELDS) {
    if (body[key] !== undefined) safeUpdate[key] = body[key];
  }

  if (Object.keys(safeUpdate).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from('salons').update(safeUpdate).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE: remove salon with full cascade
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const salonId = params.id;
  const supabase = createAdminClient();

  // Cascade delete associated records
  await Promise.all([
    supabase.from('salon_staff').delete().eq('salon_id', salonId),
    supabase.from('portfolio_photos').delete().eq('salon_id', salonId),
    supabase.from('user_subscriptions').delete().eq('salon_id', salonId),
    supabase.from('reservations').delete().eq('salon_id', salonId),
    supabase.from('reviews').delete().eq('salon_id', salonId),
    supabase.from('services').delete().eq('salon_id', salonId),
    supabase.from('salon_favorites').delete().eq('salon_id', salonId),
    supabase.from('payments').delete().eq('salon_id', salonId),
  ]);

  const { error } = await supabase.from('salons').delete().eq('id', salonId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
