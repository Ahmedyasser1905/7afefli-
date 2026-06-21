// apps/admin/app/api/admin/users/[id]/role/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '../../../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../../../lib/requireAdmin';

export const dynamic = 'force-dynamic';

const VALID_ROLES = new Set(['Client', 'Coiffeur', 'Admin']);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const role = body.role;
  if (typeof role !== 'string' || !VALID_ROLES.has(role)) {
    return NextResponse.json(
      { error: `role must be one of: ${[...VALID_ROLES].join(', ')}` },
      { status: 400 },
    );
  }

  // Prevent an admin from accidentally downgrading their own role
  if (params.id === auth.user!.id && role !== 'Admin') {
    return NextResponse.json({ error: 'Cannot downgrade your own Admin role' }, { status: 400 });
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
}
