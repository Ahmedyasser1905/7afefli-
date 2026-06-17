// apps/admin/app/api/admin/plans/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '../../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createAdminClient();
    const body = await req.json();

    const allowedFields = ['name', 'price', 'max_barbers', 'max_portfolio_photos', 'max_reservations', 'duration_days', 'is_active'];
    const update: Record<string, any> = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        // Parse numerical fields correctly
        if (['price', 'max_barbers', 'max_portfolio_photos', 'max_reservations', 'duration_days'].includes(key)) {
          update[key] = Number(body[key]);
        } else {
          update[key] = body[key];
        }
      }
    }

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
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
