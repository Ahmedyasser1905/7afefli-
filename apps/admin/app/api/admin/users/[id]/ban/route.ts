// apps/admin/app/api/admin/users/[id]/ban/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '../../../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../../../lib/requireAdmin';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const isBanned = body.isBanned;
  if (typeof isBanned !== 'boolean') {
    return NextResponse.json({ error: 'isBanned (boolean) is required' }, { status: 400 });
  }

  // Prevent an admin from banning themselves
  if (params.id === auth.user!.id) {
    return NextResponse.json({ error: 'Cannot ban your own account' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // 1. Update Supabase Auth ban status
  const { error: authError } = await supabase.auth.admin.updateUserById(params.id, {
    ban_duration: isBanned ? '87600h' : 'none',
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  // 2. Persist ban flag to profiles table for UI display
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ is_banned: isBanned })
    .eq('id', params.id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, isBanned });
}
