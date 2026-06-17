// apps/admin/app/api/admin/revenue/route.ts
import { NextResponse } from 'next/server';
import { createAdminClient } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('payments')
      .select('amount, status')
      .or('status.eq.Completed,status.eq.paid');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const payments = data ?? [];
    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

    return NextResponse.json({
      totalRevenue,
      totalPayments: payments.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
