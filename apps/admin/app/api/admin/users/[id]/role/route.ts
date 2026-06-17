// apps/admin/app/api/admin/users/[id]/role/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '../../../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const role = body.role;
    if (!role) {
      return NextResponse.json({ error: 'role parameter is required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
