// apps/admin/app/api/admin/plans/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '../../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../../lib/requireAdmin';

export const dynamic = 'force-dynamic';

const NUMERIC_FIELDS = new Set([
  'price',
  'max_barbers',
  'max_portfolio_photos',
  'max_reservations',
  'duration_days',
]);

const ALLOWED_PLAN_FIELDS = new Set([
  ...NUMERIC_FIELDS,
  'name',
  'is_active',
]);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  for (const key of ALLOWED_PLAN_FIELDS) {
    if (body[key] !== undefined) {
      update[key] = NUMERIC_FIELDS.has(key) ? Number(body[key]) : body[key];
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('plans')
    .update(update)
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
