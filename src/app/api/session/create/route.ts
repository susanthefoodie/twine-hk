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
  const body = await request.json();
  const { mode, filters } = body as {
    mode: 'couples' | 'friends' | 'solo';
    filters: Record<string, unknown>;
  };

  if (!mode || !['couples', 'friends', 'solo'].includes(mode)) {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  }

  // Use the cookie-based client ONLY to authenticate the user (reads JWT, no table queries)
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
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  // Create the session
  const { data: session, error: sessionErr } = await admin
    .from('sessions')
    .insert({
      mode,
      host_user_id: user.id,
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

  // Insert host as first participant (admin client — no RLS evaluation)
  const { error: participantErr } = await admin
    .from('session_participants')
    .insert({
      session_id: session.id,
      user_id: user.id,
    });

  if (participantErr) {
    console.error('[session/create] insert session_participants error:', participantErr.message);
    // Non-fatal — session was created; log and continue
  }

  const origin =
    request.headers.get('origin') ??
    `https://${request.headers.get('host')}`;

  return NextResponse.json({
    sessionId: session.id,
    shareCode,
    joinUrl: `${origin}/join/${shareCode}`,
  });
}
