// apps/admin/app/api/admin/notifications/broadcast/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '../../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: missing token' }, { status: 401 });
    }

    const supabase = createAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: invalid token' }, { status: 401 });
    }

    // Verify user is Admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'Admin') {
      return NextResponse.json({ error: 'Forbidden: Admin role required' }, { status: 403 });
    }

    const body = await req.json();
    const { title, body: messageBody, data: customData } = body;
    if (!title || !messageBody) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });
    }

    // 1. Fetch all profiles and their push tokens
    const { data: profiles, error: fetchError } = await supabase
      .from('profiles')
      .select('id, push_token');

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    // 2. Insert in-app notifications in bulk
    const inAppInserts = profiles.map(p => ({
      user_id: p.id,
      type: 'broadcast',
      title,
      body: messageBody,
      data: customData ?? null,
      is_read: false,
    }));

    // Insert in chunks of 500 to avoid query size limits
    const chunkSize = 500;
    for (let i = 0; i < inAppInserts.length; i += chunkSize) {
      const chunk = inAppInserts.slice(i, i + chunkSize);
      const { error: insertError } = await supabase.from('notifications').insert(chunk);
      if (insertError) {
        console.error('Failed to insert in-app notifications batch:', insertError.message);
      }
    }

    // 3. Dispatch Expo Push notifications in background
    const pushMessages: any[] = [];
    for (const p of profiles) {
      if (p.push_token && p.push_token.startsWith('ExponentPushToken')) {
        pushMessages.push({
          to: p.push_token,
          sound: 'default',
          title,
          body: messageBody,
          data: customData ?? {},
        });
      }
    }

    if (pushMessages.length > 0) {
      // Run async to not block client response
      (async () => {
        try {
          const expoChunkSize = 100;
          for (let i = 0; i < pushMessages.length; i += expoChunkSize) {
            const chunk = pushMessages.slice(i, i + expoChunkSize);
            const res = await fetch('https://exp.host/--/api/v2/push/send', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify(chunk),
            });
            if (!res.ok) {
              console.error('Expo push send status error:', res.status, res.statusText);
            }
          }
        } catch (pushErr: any) {
          console.error('Failed to dispatch Expo push notifications:', pushErr.message);
        }
      })();
    }

    // 4. Log the broadcast for audit history
    await supabase.from('broadcast_notifications').insert({
      title,
      body: messageBody,
      data: customData ?? null,
      sent_by: user.id,
    });

    return NextResponse.json({ sent: profiles.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
