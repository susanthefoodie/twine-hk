import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  console.log('[swipe] START')
  try {
    const body = await req.json()
    const { sessionId, placeId, direction, placeName, placeData, userId } = body
    console.log('[swipe] userId:', userId, 'placeId:', placeId, 'direction:', direction)

    if (!sessionId || !placeId || !direction) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const normalizedDirection = ['right','like','yes'].includes(String(direction).toLowerCase()) ? 'right' : 'left'

    // Validate userId is a proper UUID before using as FK (guests send non-UUID strings)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validUserId = userId && uuidRegex.test(String(userId)) ? userId : null;

    // 1. Insert swipe
    const { error: swipeError } = await admin
      .from('swipes')
      .insert({
        session_id: sessionId,
        place_id: placeId,
        direction: normalizedDirection,
        user_id: validUserId,
        guest_participant_id: null,
        place_name: placeName ?? null,
      })
    if (swipeError && swipeError.code !== '23505') {
      console.error('[swipe] swipe insert error:', swipeError.message, swipeError.code)
    } else {
      console.log('[swipe] swipe inserted, direction:', normalizedDirection)
    }

    let isMatch = false

    if (normalizedDirection === 'right') {

      // 2. Save to saved_places for authenticated users
      if (validUserId && placeId) {
        const { error: saveError } = await admin
          .from('saved_places')
          .upsert({
            user_id: validUserId,
            place_id: placeId,
            place_data: placeData ?? { id: placeId, name: placeName ?? '' },
            list_name: 'Swiped Right',
            is_visited: false,
          }, { onConflict: 'user_id,place_id' })
        if (saveError) {
          console.error('[swipe] save error:', saveError.message)
        } else {
          console.log('[swipe] saved to collection')
        }
      }

      // 3. Get participants
      const { data: participants } = await admin
        .from('session_participants')
        .select('user_id, guest_name')
        .eq('session_id', sessionId)

      console.log('[swipe] participants:', JSON.stringify(participants))

      // 4. Get unique right swipers for this place
      const { data: rightSwipeRows } = await admin
        .from('swipes')
        .select('user_id')
        .eq('session_id', sessionId)
        .eq('place_id', placeId)
        .eq('direction', 'right')

      const uniqueRightSwipers = new Set(
        (rightSwipeRows ?? []).map((r: any) => r.user_id).filter(Boolean)
      )
      const rightSwipeCount = uniqueRightSwipers.size

      // 5. Count participants — fall back to unique swipers across the whole session
      //    if the participants table has no rows (e.g. participant insert failed)
      const { data: allSwipeUsers } = await admin
        .from('swipes')
        .select('user_id')
        .eq('session_id', sessionId)
        .not('user_id', 'is', null)

      const uniqueAllSwipers = new Set((allSwipeUsers ?? []).map((r: any) => r.user_id))
      const totalFromSwipes = uniqueAllSwipers.size

      const totalParticipants = (participants?.length ?? 0) > 0
        ? participants!.length
        : Math.max(totalFromSwipes, 1)

      console.log('[swipe] totalParticipants:', totalParticipants, 'rightSwipeCount:', rightSwipeCount)

      // 6. Match when ALL participants have swiped right
      if (rightSwipeCount >= totalParticipants) {
        isMatch = true
        const { error: matchError } = await admin
          .from('matches')
          .upsert({
            session_id: sessionId,
            place_id: placeId,
            place_data: placeData ?? { id: placeId, name: placeName ?? '' },
            match_score: rightSwipeCount * 100,
            is_visited: false,
          }, { onConflict: 'session_id,place_id' })

        if (matchError) {
          console.error('[swipe] MATCH ERROR:', matchError.message, matchError.code)
        } else {
          console.log('[swipe] MATCH CREATED:', placeId)
        }
      }
    }

    return NextResponse.json({ success: true, direction: normalizedDirection, matched: isMatch })

  } catch (e: any) {
    console.error('[swipe] CRASH:', e.message, e.stack)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
