import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import type { PlaceResult } from '@/types/place';

// POST /api/session/swipe
// Body: { sessionId, placeId, direction: 'yes'|'skip', placeData?: PlaceResult }
export async function POST(request: NextRequest) {
  console.log('[session/swipe] POST called');
  try {
    let body: { sessionId?: string; placeId?: string; direction?: string; placeData?: PlaceResult };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { sessionId, placeId, direction, placeData } = body;
    console.log('[session/swipe] body:', { sessionId, placeId, direction });

    if (!sessionId || !placeId || !direction) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Authenticate — use cookie client only for getUser() (no table queries)
    const cookieStore = cookies();
    const authClient = createServerClient(
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

    const { data: { user } } = await authClient.auth.getUser();
    console.log('[session/swipe] user:', user?.id ?? 'guest');

    // All DB operations use the admin client — bypasses RLS
    const admin = createAdminClient();

    // Insert swipe — user_id and guest_participant_id are both nullable
    // Use insert + ignoreDuplicates to avoid onConflict issues with nullable user_id
    const swipeRow: Record<string, unknown> = {
      session_id: sessionId,
      place_id: placeId,
      direction,
      user_id: user?.id ?? null,
    };

    const { error: swipeErr } = await admin
      .from('swipes')
      .upsert(swipeRow, { onConflict: 'session_id,user_id,place_id', ignoreDuplicates: true });

    if (swipeErr) {
      // If the unique constraint fails due to null user_id, fall back to plain insert
      if (swipeErr.code === '42P10' || swipeErr.code === '23505' || user === null) {
        console.warn('[session/swipe] upsert fallback to insert, reason:', swipeErr.message);
        const { error: insertErr } = await admin.from('swipes').insert(swipeRow);
        if (insertErr && insertErr.code !== '23505') {
          console.error('[session/swipe] swipe insert error:', insertErr.message);
          return NextResponse.json({ error: insertErr.message }, { status: 500 });
        }
      } else {
        console.error('[session/swipe] swipe upsert error:', swipeErr.message);
        return NextResponse.json({ error: swipeErr.message }, { status: 500 });
      }
    }

    console.log('[session/swipe] swipe recorded');

    // Only check for matches on 'yes' swipes from authenticated users
    if (direction !== 'yes' || !user) {
      return NextResponse.json({ matched: false });
    }

    // Call the SECURITY DEFINER RPC to check if all participants swiped yes
    const { data: matchResult, error: rpcErr } = await admin
      .rpc('check_for_match', { p_session_id: sessionId, p_place_id: placeId });

    if (rpcErr) {
      // Non-fatal: log but don't fail the swipe
      console.error('[session/swipe] check_for_match error:', rpcErr.message);
      return NextResponse.json({ matched: false });
    }

    console.log('[session/swipe] match result:', matchResult);
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

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[session/swipe] unhandled error:', message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
