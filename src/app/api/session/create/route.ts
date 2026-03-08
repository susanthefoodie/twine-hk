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

    // Use the cookie-based client ONLY to authenticate the user (reads JWT, no table queries)
    console.log('[session/create] authenticating user');
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
    // user may be null for guest mode — session created with host_user_id: null
    console.log('[session/create] user:', user?.id ?? 'guest');

    // All DB writes use the admin client — bypasses RLS entirely, no policy recursion
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
    console.log('[session/create] inserting session');
    const { data: session, error: sessionErr } = await admin
      .from('sessions')
      .insert({
        mode,
        host_user_id: user?.id ?? null,
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

    // Insert host as first participant only if authenticated
    if (user) {
      console.log('[session/create] inserting participant');
      const { error: participantErr } = await admin
        .from('session_participants')
        .insert({
          session_id: session.id,
          user_id: user.id,
        });

      if (participantErr) {
        console.error('[session/create] insert session_participants error:', participantErr.message);
        // Non-fatal — session was created; log and continue
      } else {
        console.log('[session/create] participant inserted');
      }
    } else {
      console.log('[session/create] guest session — skipping participant insert');
    }

    const origin =
      request.headers.get('origin') ??
      `https://${request.headers.get('host')}`;

    console.log('[session/create] success, returning response');
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
