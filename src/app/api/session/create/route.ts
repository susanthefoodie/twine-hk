import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

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

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Generate a unique 6-char uppercase alphanumeric share code
  let shareCode = generateShareCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await supabase
      .from('sessions')
      .select('id')
      .eq('share_code', shareCode)
      .maybeSingle();
    if (!existing) break;
    shareCode = generateShareCode();
  }

  // Create the session
  const { data: session, error: sessionErr } = await supabase
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
    return NextResponse.json(
      { error: sessionErr?.message ?? 'Failed to create session' },
      { status: 500 }
    );
  }

  // Insert host as first participant
  await supabase.from('session_participants').insert({
    session_id: session.id,
    user_id: user.id,
  });

  const origin =
    request.headers.get('origin') ??
    `https://${request.headers.get('host')}`;

  return NextResponse.json({
    sessionId: session.id,
    shareCode,
    joinUrl: `${origin}/join/${shareCode}`,
  });
}
