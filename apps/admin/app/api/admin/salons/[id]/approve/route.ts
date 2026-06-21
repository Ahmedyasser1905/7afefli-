// apps/admin/app/api/admin/salons/[id]/approve/route.ts
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

  const approved = body.approved;
  if (typeof approved !== 'boolean') {
    return NextResponse.json({ error: 'approved (boolean) is required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // 1. Fetch salon owner details
  const { data: salon, error: fetchErr } = await supabase
    .from('salons')
    .select('id, owner_id, name')
    .eq('id', params.id)
    .single();

  if (fetchErr || !salon) {
    return NextResponse.json({ error: 'Salon not found' }, { status: 404 });
  }

  // 2. Update salon approval status
  const { error: updateErr } = await supabase
    .from('salons')
    .update({ is_approved: approved })
    .eq('id', params.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // 3. Notify the salon owner (fire-and-forget)
  if (salon.owner_id) {
    const type = approved ? 'salon_approved' : 'salon_rejected';
    const title = approved ? '✅ Salon approuvé' : '❌ Salon non approuvé';
    const bodyText = approved
      ? `Votre salon "${salon.name}" a été approuvé et est maintenant visible par les clients.`
      : `Votre salon "${salon.name}" n'a pas été approuvé. Contactez le support pour plus d'informations.`;

    // Insert in-app notification
    await supabase.from('notifications').insert({
      user_id: salon.owner_id,
      type,
      title,
      body: bodyText,
      data: { salonId: salon.id },
    });

    // Send push notification if owner has push token
    const { data: profile } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', salon.owner_id)
      .single();

    if (profile?.push_token && profile.push_token.startsWith('ExponentPushToken')) {
      try {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            to: profile.push_token,
            sound: 'default',
            title,
            body: bodyText,
            data: { salonId: salon.id },
          }),
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error('Failed to send push notification to owner:', msg);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
