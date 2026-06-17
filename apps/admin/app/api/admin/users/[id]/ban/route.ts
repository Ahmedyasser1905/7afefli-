// apps/admin/app/api/admin/users/[id]/ban/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '../../../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const isBanned = body.isBanned;
    if (isBanned === undefined) {
      return NextResponse.json({ error: 'isBanned parameter is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Update Supabase Auth user ban status
    const { error: authError } = await supabase.auth.admin.updateUserById(params.id, {
      ban_duration: isBanned ? '87600h' : 'none',
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    // 2. Update profiles table is_banned column
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ is_banned: isBanned })
      .eq('id', params.id);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, isBanned });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
