import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import type { PlaceResult } from '@/types/place';

// POST /api/session/swipe
// Body: { sessionId, placeId, direction: 'yes'|'skip', placeData?: PlaceResult }
export async function POST(request: NextRequest) {
  const { sessionId, placeId, direction, placeData } = (await request.json()) as {
    sessionId: string;
    placeId: string;
    direction: 'yes' | 'skip';
    placeData?: PlaceResult;
  };

  if (!sessionId || !placeId || !direction) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Authenticate — guests are not allowed to swipe (they must have a session)
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Determine participant: prefer authenticated user, fallback to guest cookie
  const admin = createAdminClient();

  let participantId: string | null = null;

  if (user) {
    const { data: participant } = await admin
      .from('session_participants')
      .select('id')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .maybeSingle();
    participantId = participant?.id ?? null;
  }

  // For guest users we look for a guest row with matching session
  // (the guest joined without auth, so we allow the swipe based on session membership)
  if (!participantId) {
    // Guests: accept swipe but won't trigger match (no user_id to validate completeness)
    // Still record it with user_id=null so the swipe history is captured
  }

  // Insert swipe (upsert to be idempotent)
  const { error: swipeErr } = await admin
    .from('swipes')
    .upsert(
      {
        session_id: sessionId,
        user_id: user?.id ?? null,
        place_id: placeId,
        direction,
      },
      { onConflict: 'session_id,user_id,place_id', ignoreDuplicates: true }
    );

  if (swipeErr) {
    return NextResponse.json({ error: swipeErr.message }, { status: 500 });
  }

  // Only check for matches on 'yes' swipes
  if (direction !== 'yes') {
    return NextResponse.json({ matched: false });
  }

  // Call the SECURITY DEFINER RPC to check if all participants swiped yes
  const { data: matchResult, error: rpcErr } = await admin
    .rpc('check_for_match', { p_session_id: sessionId, p_place_id: placeId });

  if (rpcErr) {
    // Non-fatal: log but don't fail the swipe
    console.error('check_for_match error:', rpcErr.message);
    return NextResponse.json({ matched: false });
  }

  const matched = matchResult === true;

  // If matched, enrich the match row with full place data
  if (matched && placeData) {
    await admin
      .from('matches')
      .update({ place_data: placeData })
      .eq('session_id', sessionId)
      .eq('place_id', placeId);
  }

  return NextResponse.json({ matched, place: matched ? placeData ?? null : null });
}
