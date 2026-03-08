import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

function generateShareCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

export async function POST(request: NextRequest) {
  console.log('[session/create] POST called');
  try {
    // Parse body
    let body: { mode?: string; filters?: Record<string, unknown> };
    try {
      body = await request.json();
    } catch {
      console.error('[session/create] Failed to parse request body');
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { mode, filters } = body as {
      mode: 'couples' | 'friends' | 'solo';
      filters: Record<string, unknown>;
    };
    console.log('[session/create] mode:', mode);

    if (!mode || !['couples', 'friends', 'solo'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }

    // Use the cookie-based client ONLY to authenticate the user
    const cookieStore = cookies();
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { data: { user } } = await authClient.auth.getUser();
    const userId = user?.id ?? null;
    console.log('[session/create] user:', userId ?? 'guest');

    // All DB writes use the admin client — bypasses RLS entirely
    const admin = createAdminClient();

    // Generate a unique 6-char share code
    let shareCode = generateShareCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: existing } = await admin
        .from('sessions')
        .select('id')
        .eq('share_code', shareCode)
        .maybeSingle();
      if (!existing) break;
      shareCode = generateShareCode();
    }
    console.log('[session/create] share code:', shareCode);

    // Create the session
    const { data: session, error: sessionErr } = await admin
      .from('sessions')
      .insert({
        mode,
        host_user_id: userId,
        share_code: shareCode,
        filters: filters ?? {},
        status: 'active',
        city: 'hong_kong',
        participant_count: 1,
      })
      .select()
      .single();

    if (sessionErr || !session) {
      console.error('[session/create] insert sessions error:', sessionErr?.message);
      return NextResponse.json(
        { error: sessionErr?.message ?? 'Failed to create session' },
        { status: 500 }
      );
    }
    console.log('[session/create] session created:', session.id);

    // Always insert the host as a participant (even guests get a null-user-id row
    // so the participant count is correct when checking for matches)
    const { error: participantError } = await admin
      .from('session_participants')
      .insert({
        session_id: session.id,
        user_id: userId,
        joined_at: new Date().toISOString(),
      });
    console.log('[session/create] host participant insert:', participantError?.message ?? 'OK');

    const origin =
      request.headers.get('origin') ??
      `https://${request.headers.get('host')}`;

    return NextResponse.json({
      sessionId: session.id,
      shareCode,
      joinUrl: `${origin}/join/${shareCode}`,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[session/create] unhandled error:', message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
