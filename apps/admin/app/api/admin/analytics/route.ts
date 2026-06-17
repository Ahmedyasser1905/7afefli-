// apps/admin/app/api/admin/analytics/route.ts
import { NextResponse } from 'next/server';
import { createAdminClient } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createAdminClient();
    const [paymentsResult, subsResult, topSalonsResult] = await Promise.all([
      supabase
        .from('payments')
        .select('amount, status, created_at')
        .or('status.eq.Completed,status.eq.paid')
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
    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

    const subs = subsResult.data ?? [];
    const mrr = subs.reduce((sum, s: any) => {
      const plan = Array.isArray(s.plans) ? s.plans[0] : s.plans;
      return sum + Number(plan?.price ?? 0);
    }, 0);
    const avgSubscriptionValue = subs.length > 0 ? mrr / subs.length : 0;

    const planCounts: Record<string, number> = {};
    for (const s of subs as any[]) {
      const plan = Array.isArray(s.plans) ? s.plans[0] : s.plans;
      const name = plan?.name ?? 'Inconnu';
      planCounts[name] = (planCounts[name] ?? 0) + 1;
    }
    const subscriptionsByPlan = Object.entries(planCounts).map(([plan_name, count]) => ({ plan_name, count }));

    return NextResponse.json({
      totalRevenue,
      mrr,
      avgSubscriptionValue: Math.round(avgSubscriptionValue),
      subscriptionsByPlan,
      topSalons: topSalonsResult.data ?? [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
