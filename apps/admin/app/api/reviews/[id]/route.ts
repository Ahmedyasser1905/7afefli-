// apps/admin/app/api/reviews/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../lib/requireAdmin';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
