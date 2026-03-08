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

    // 1. Insert swipe
    const { error: swipeError } = await admin
      .from('swipes')
      .insert({
        session_id: sessionId,
        place_id: placeId,
        direction: normalizedDirection,
        user_id: userId ?? null,
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
      if (userId && placeId) {
        const { error: saveError } = await admin
          .from('saved_places')
          .upsert({
            user_id: userId,
            place_id: placeId,
            place_data: placeData ?? { id: placeId, name: placeName ?? '' },
            list_name: 'Swiped Right',
            is_visited: false,
          }, { onConflict: 'user_id,place_id' })
        if (saveError) {
          console.error('[swipe] SAVE ERROR:', saveError.message, saveError.code)
        } else {
          console.log('[swipe] saved_places upserted ok')
        }
      }

      // 3. Match detection
      const { data: sessionData } = await admin
        .from('sessions')
        .select('mode')
        .eq('id', sessionId)
        .single()

      const mode = sessionData?.mode ?? 'solo'
      console.log('[swipe] session mode:', mode)

      // Get all participants in this session
      const { data: participants } = await admin
        .from('session_participants')
        .select('user_id')
        .eq('session_id', sessionId)

      const participantCount = Math.max(participants?.length ?? 1, 1)
      console.log('[swipe] participant count:', participantCount)

      // Get all right swipes for this place in this session
      const { data: rightSwipes } = await admin
        .from('swipes')
        .select('user_id')
        .eq('session_id', sessionId)
        .eq('place_id', placeId)
        .eq('direction', 'right')

      const rightSwipeCount = rightSwipes?.length ?? 0
      console.log('[swipe] right swipe count for this place:', rightSwipeCount)

      // Determine match based on mode
      if (mode === 'solo') {
        isMatch = true
      } else if (mode === 'couples' || mode === 'date') {
        isMatch = rightSwipeCount >= 2
      } else if (mode === 'group' || mode === 'friends') {
        isMatch = rightSwipeCount >= Math.ceil(participantCount / 2)
      } else {
        isMatch = true
      }

      console.log('[swipe] isMatch:', isMatch, 'mode:', mode, 'rightSwipes:', rightSwipeCount, 'participants:', participantCount)

      if (isMatch) {
        const { error: matchError } = await admin
          .from('matches')
          .upsert({
            session_id: sessionId,
            place_id: placeId,
            place_data: placeData ?? { id: placeId, name: placeName ?? '' },
            match_score: rightSwipeCount * 50,
            is_visited: false,
          }, { onConflict: 'session_id,place_id' })

        if (matchError) {
          console.error('[swipe] MATCH ERROR:', matchError.message, matchError.code, matchError.details)
        } else {
          console.log('[swipe] MATCH CREATED/UPDATED:', placeId, 'score:', rightSwipeCount * 50)
        }
      }
    }

    return NextResponse.json({ success: true, direction: normalizedDirection, matched: isMatch })

  } catch (e: any) {
    console.error('[swipe] CRASH:', e.message, e.stack)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
