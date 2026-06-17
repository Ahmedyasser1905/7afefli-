// apps/admin/app/api/admin/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '../../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// PATCH: update role, ban/unban
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  const body = await req.json();
  const { error } = await supabase.from('profiles').update(body).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE: remove user from auth + profiles
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  // Delete from profiles first (cascade handles related data)
  await supabase.from('profiles').delete().eq('id', params.id);
  // Then delete the auth user
  const { error } = await supabase.auth.admin.deleteUser(params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
