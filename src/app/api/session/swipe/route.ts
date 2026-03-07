import { createAdminClient } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import type { PlaceResult } from '@/types/place';

// POST /api/session/swipe
// Body: { sessionId, placeId, direction, placeName?, placeData?, userId? }
export async function POST(request: NextRequest) {
  console.log('[session/swipe] POST called');
  try {
    let body: {
      sessionId?: string;
      placeId?: string;
      direction?: string;
      placeData?: PlaceResult;
      placeName?: string;
      userId?: string | null;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { sessionId, placeId, direction, placeData, placeName, userId } = body;
    console.log('[session/swipe] body:', { sessionId, placeId, direction, userId });

    if (!sessionId || !placeId || !direction) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Normalize direction — ALWAYS 'right' or 'left' regardless of what client sends
    const normalizedDirection =
      direction === 'right' || direction === 'like' || direction === 'yes' || direction === true as unknown as string
        ? 'right'
        : 'left';

    console.log('[session/swipe] normalizedDirection:', normalizedDirection);

    const supabaseAdmin = createAdminClient();

    // Plain insert with ON CONFLICT DO NOTHING — ignore duplicate (23505)
    const { error: swipeError } = await supabaseAdmin
      .from('swipes')
      .insert({
        session_id: sessionId,
        place_id: placeId,
        user_id: userId ?? null,
        guest_participant_id: null,
        direction: normalizedDirection,
        place_name: placeName ?? null,
      });

    if (swipeError && swipeError.code !== '23505') {
      console.error('[session/swipe] insert error:', swipeError.message, swipeError.code);
      return NextResponse.json({ error: swipeError.message }, { status: 500 });
    }

    console.log('[session/swipe] swipe recorded:', normalizedDirection);

    // Server-side save to saved_places on right swipe
    if (normalizedDirection === 'right' && placeData && userId) {
      const { error: saveError } = await supabaseAdmin
        .from('saved_places')
        .upsert(
          {
            user_id: userId,
            place_id: placeId,
            place_data: placeData,
            list_name: 'Swiped Right',
            is_visited: false,
          },
          { onConflict: 'user_id,place_id' }
        );
      if (saveError) {
        console.error('[session/swipe] save error:', saveError.message);
      } else {
        console.log('[session/swipe] saved to collection:', placeId);
      }
    }

    // Only check for matches on right swipes from authenticated users
    if (normalizedDirection !== 'right' || !userId) {
      return NextResponse.json({ matched: false });
    }

    // Call the SECURITY DEFINER RPC to check if all participants swiped right
    const { data: matchResult, error: rpcErr } = await supabaseAdmin
      .rpc('check_for_match', { p_session_id: sessionId, p_place_id: placeId });

    if (rpcErr) {
      console.error('[session/swipe] check_for_match error:', rpcErr.message);
      return NextResponse.json({ matched: false });
    }

    console.log('[session/swipe] match result:', matchResult);
    const matched = matchResult === true;

    if (matched && placeData) {
      await supabaseAdmin
        .from('matches')
        .update({ place_data: placeData })
        .eq('session_id', sessionId)
        .eq('place_id', placeId);
    }

    return NextResponse.json({ matched, place: matched ? placeData ?? null : null });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[session/swipe] unhandled error:', message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
