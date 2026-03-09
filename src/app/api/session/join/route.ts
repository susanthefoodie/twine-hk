import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// ── GET /api/session/join?code=XXXXXX ────────────────────────────────────────
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: session, error } = await admin
    .from('sessions')
    .select(
      `id, mode, status, participant_count, share_code,
       profiles:host_user_id ( display_name, avatar_url )`
    )
    .eq('share_code', code.toUpperCase())
    .maybeSingle();

  if (error || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (session.status !== 'active') {
    return NextResponse.json({ error: 'Session has ended' }, { status: 410 });
  }

  return NextResponse.json({
    sessionId: session.id,
    mode: session.mode,
    participantCount: session.participant_count,
    host: session.profiles,
  });
}

// ── POST /api/session/join ────────────────────────────────────────────────────
// Accepts { code, guestName, guestId } from join page
// Accepts { sessionId, guestName, guestId } from session page on guest mount
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { code, sessionId: bodySessionId, guestId, guestName } = body;

  if (!code && !bodySessionId) {
    return NextResponse.json({ error: 'Missing code or sessionId' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Find the session by share code OR session id
  let sessionQuery = admin
    .from('sessions')
    .select('id, status, participant_count');

  if (code) {
    sessionQuery = (sessionQuery as any).eq('share_code', code.toUpperCase());
  } else {
    sessionQuery = (sessionQuery as any).eq('id', bodySessionId);
  }

  const { data: session } = await (sessionQuery as any).maybeSingle();

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  if (session.status !== 'active') {
    return NextResponse.json({ error: 'Session has ended' }, { status: 410 });
  }

  // Try to get authenticated user from cookies
  const cookieStore = cookies();
  const supabase = createServerClient(
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

  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? null;
  console.log('[session/join] userId:', userId ?? 'guest', 'session:', session.id);

  // Build participant row — auth users get user_id, guests get guest_name
  const participantRow: Record<string, unknown> = {
    session_id: session.id,
    joined_at: new Date().toISOString(),
  };

  if (userId) {
    participantRow.user_id = userId;
  } else {
    participantRow.user_id = null;
    participantRow.guest_name = guestName ?? guestId ?? 'Guest';
  }

  // Upsert for auth users (prevents duplicate rows); insert for guests
  if (userId) {
    const { error: participantError } = await admin
      .from('session_participants')
      .upsert(participantRow, { onConflict: 'session_id,user_id' });
    console.log('[session/join] auth participant upsert:', participantError?.message ?? 'OK');

    if (participantError) {
      return NextResponse.json({ error: participantError.message }, { status: 500 });
    }
  } else {
    // For guests, check if already joined (same session + guest_name)
    const { data: existing } = await admin
      .from('session_participants')
      .select('id')
      .eq('session_id', session.id)
      .eq('guest_name', participantRow.guest_name as string)
      .maybeSingle();

    if (!existing) {
      const { error: participantError } = await admin
        .from('session_participants')
        .insert(participantRow);
      console.log('[session/join] guest participant insert:', participantError?.message ?? 'OK');

      if (participantError) {
        // Non-fatal for guests — let them swipe anyway
        console.error('[session/join] guest insert error:', participantError.message);
      } else {
        // Increment participant count only on new insert
        await admin
          .from('sessions')
          .update({ participant_count: session.participant_count + 1 })
          .eq('id', session.id);
      }
    } else {
      console.log('[session/join] guest already in session, skipping insert');
    }
  }

  if (userId) {
    // Increment participant count for auth users too
    await admin
      .from('sessions')
      .update({ participant_count: session.participant_count + 1 })
      .eq('id', session.id);
  }

  return NextResponse.json({ sessionId: session.id });
}
