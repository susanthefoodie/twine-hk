import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// ── GET /api/session/join?code=XXXXXX ────────────────────────────────────────
// Returns public session info for the join page. Uses the admin client to
// bypass RLS so unauthenticated guests can see the session before they join.
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
// Adds a participant to the session. Handles both authenticated users and
// unauthenticated guests. Uses admin client for guest inserts (bypasses RLS).
export async function POST(request: NextRequest) {
  const { code, guestName } = (await request.json()) as {
    code: string;
    guestName?: string;
  };

  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Find the session
  const { data: session } = await admin
    .from('sessions')
    .select('id, status, participant_count')
    .eq('share_code', code.toUpperCase())
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  if (session.status !== 'active') {
    return NextResponse.json({ error: 'Session has ended' }, { status: 410 });
  }

  // Check if the request comes from an authenticated user
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Check for existing participation (avoid duplicates)
  if (user) {
    const { data: existing } = await admin
      .from('session_participants')
      .select('id')
      .eq('session_id', session.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      // Already a participant — just return the session ID
      return NextResponse.json({ sessionId: session.id });
    }
  }

  // Insert participant (admin client bypasses RLS for guest inserts)
  const { error: insertErr } = await admin
    .from('session_participants')
    .insert({
      session_id: session.id,
      user_id: user?.id ?? null,
      guest_name: !user ? (guestName ?? 'Guest') : null,
    });

  if (insertErr) {
    return NextResponse.json(
      { error: insertErr.message },
      { status: 500 }
    );
  }

  // Increment participant count
  await admin
    .from('sessions')
    .update({ participant_count: session.participant_count + 1 })
    .eq('id', session.id);

  return NextResponse.json({ sessionId: session.id });
}
