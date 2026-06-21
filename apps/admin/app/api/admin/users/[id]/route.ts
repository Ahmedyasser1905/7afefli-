// apps/admin/app/api/admin/users/[id]/route.ts
//
// Security fixes applied:
//  1. requireAdmin() — JWT + Admin role verification (was completely missing)
//  2. Mass-assignment fix — whitelist allowed PATCH fields (was passing raw body directly)
//  3. Cascade deletion fix — DELETE now properly removes owned salons, reservations,
//     reviews, notifications and staff references before removing the auth user.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '../../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../../lib/requireAdmin';

export const dynamic = 'force-dynamic';

// Whitelist of profile fields an admin may update via this endpoint.
// Prevents mass-assignment attacks (e.g. setting role, loyalty_points, etc.).
const ALLOWED_PROFILE_FIELDS = new Set(['full_name', 'phone_number', 'wilaya', 'avatar_url']);

// PATCH: update profile fields
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
  for (const key of ALLOWED_PROFILE_FIELDS) {
    if (body[key] !== undefined) safeUpdate[key] = body[key];
  }

  if (Object.keys(safeUpdate).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from('profiles').update(safeUpdate).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE: cascade-delete user — owned salons, reservations, reviews, then auth user
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const userId = params.id;
  const supabase = createAdminClient();

  // 1. Find and cascade-delete all salons owned by this user
  const { data: salons } = await supabase
    .from('salons')
    .select('id')
    .eq('owner_id', userId);

  if (salons && salons.length > 0) {
    const salonIds = salons.map((s) => s.id);
    // Delete cascade for each salon
    await Promise.all([
      supabase.from('salon_staff').delete().in('salon_id', salonIds),
      supabase.from('portfolio_photos').delete().in('salon_id', salonIds),
      supabase.from('user_subscriptions').delete().in('salon_id', salonIds),
      supabase.from('reservations').delete().in('salon_id', salonIds),
      supabase.from('reviews').delete().in('salon_id', salonIds),
      supabase.from('services').delete().in('salon_id', salonIds),
      supabase.from('salon_favorites').delete().in('salon_id', salonIds),
      supabase.from('payments').delete().in('salon_id', salonIds),
    ]);
    await supabase.from('salons').delete().in('id', salonIds);
  }

  // 2. Delete user's personal references
  await Promise.all([
    supabase.from('reservations').delete().eq('client_id', userId),
    supabase.from('reviews').delete().eq('client_id', userId),
    supabase.from('salon_staff').delete().eq('profile_id', userId),
    supabase.from('salon_favorites').delete().eq('user_id', userId),
    supabase.from('notifications').delete().eq('user_id', userId),
  ]);

  // 3. Delete profile row
  await supabase.from('profiles').delete().eq('id', userId);

  // 4. Delete auth user
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error && !error.message.includes('User not found')) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
