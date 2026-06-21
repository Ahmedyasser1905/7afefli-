// apps/admin/app/api/admin/analytics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../lib/requireAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const supabase = createAdminClient();
    const [paymentsResult, subsResult, topSalonsResult] = await Promise.all([
      supabase
        .from('payments')
        .select('amount, status, created_at')
        .eq('status', 'Completed')
        .limit(10000),
      supabase
        .from('user_subscriptions')
        .select('status, plans(name, price)')
        .eq('status', 'Active')
        .limit(1000),
      supabase
        .from('salons')
        .select('id, name, wilaya, average_rating, total_reviews')
        .eq('is_approved', true)
        .not('average_rating', 'is', null)
        .order('average_rating', { ascending: false })
        .limit(10),
    ]);

    if (paymentsResult.error) throw paymentsResult.error;
    if (subsResult.error) throw subsResult.error;
    if (topSalonsResult.error) throw topSalonsResult.error;

    const payments = paymentsResult.data ?? [];
    const totalRevenue = payments.reduce(
      (sum, p: { amount?: unknown }) => sum + Number(p.amount ?? 0),
      0,
    );

    const subs = subsResult.data ?? [];
    const mrr = subs.reduce((sum, s: Record<string, unknown>) => {
      const plan = Array.isArray(s.plans) ? s.plans[0] : s.plans;
      return sum + Number((plan as Record<string, unknown> | null)?.price ?? 0);
    }, 0);
    const avgSubscriptionValue = subs.length > 0 ? mrr / subs.length : 0;

    const planCounts: Record<string, number> = {};
    for (const s of subs as Array<Record<string, unknown>>) {
      const plan = Array.isArray(s.plans) ? s.plans[0] : s.plans;
      const name = (plan as Record<string, unknown> | null)?.name as string ?? 'Inconnu';
      planCounts[name] = (planCounts[name] ?? 0) + 1;
    }
    const subscriptionsByPlan = Object.entries(planCounts).map(([plan_name, count]) => ({
      plan_name,
      count,
    }));

    return NextResponse.json({
      totalRevenue,
      mrr,
      avgSubscriptionValue: Math.round(avgSubscriptionValue),
      subscriptionsByPlan,
      topSalons: topSalonsResult.data ?? [],
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
