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

    // ── Debug logging — always runs ───────────────────────────────────────
    console.log('[swipe] received body keys:', Object.keys(body));
    console.log('[swipe] userId:', body.userId);
    console.log('[swipe] direction:', body.direction);
    console.log('[swipe] placeData exists:', !!body.placeData);

    const { sessionId, placeId, direction, placeData, placeName, userId } = body;

    if (!sessionId || !placeId || !direction) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Normalize direction — ALWAYS 'right' or 'left'
    const normalizedDirection =
      direction === 'right' || direction === 'like' || direction === 'yes'
        ? 'right'
        : 'left';

    console.log('[session/swipe] normalizedDirection:', normalizedDirection);

    const supabaseAdmin = createAdminClient();

    // ── Step 1: Record swipe — errors here do NOT block the save ─────────
    try {
      const { error: swipeError } = await supabaseAdmin
        .from('swipes')
        .insert({
          session_id: sessionId,
          place_id: placeId,
          user_id: userId ?? null,
          guest_participant_id: null,
          direction: normalizedDirection,
        });

      if (swipeError) {
        if (swipeError.code === '23505') {
          console.log('[session/swipe] duplicate swipe ignored');
        } else {
          console.error('[session/swipe] swipe insert error:', swipeError.message, swipeError.code);
        }
      } else {
        console.log('[session/swipe] swipe recorded:', normalizedDirection);
      }
    } catch (e: any) {
      console.error('[session/swipe] swipe insert threw:', e.message);
    }

    // ── Step 2: Save to saved_places — ALWAYS runs on right swipe ────────
    if (normalizedDirection === 'right' && placeData && userId) {
      console.log('[swipe] attempting save for userId:', userId, 'placeId:', placeId);
      const { data: saveData, error: saveError } = await supabaseAdmin
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
      console.log('[swipe] save result - data:', saveData, 'error:', saveError?.message);
    } else {
      console.log('[swipe] skipping save — direction:', normalizedDirection, 'hasPlaceData:', !!placeData, 'hasUserId:', !!userId);
    }

    // ── Step 3: Match check — only for right swipes from auth users ───────
    if (normalizedDirection !== 'right' || !userId) {
      return NextResponse.json({ matched: false });
    }

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
