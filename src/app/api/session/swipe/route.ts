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
    console.log('[swipe] body:', JSON.stringify(body))

    const { sessionId, placeId, direction, placeName, placeData, userId } = body

    if (!sessionId || !placeId || !direction) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const normalizedDirection = ['right','like','yes'].includes(String(direction).toLowerCase()) ? 'right' : 'left'
    console.log('[swipe] normalized direction:', normalizedDirection)

    // Insert swipe record — ignore duplicate errors
    const { error: swipeError } = await admin
      .from('swipes')
      .insert({
        session_id: sessionId,
        place_id: placeId,
        user_id: userId ?? null,
        direction: normalizedDirection,
        place_name: placeName ?? null
      })

    if (swipeError && swipeError.code !== '23505') {
      console.error('[swipe] swipe insert error:', swipeError.message, swipeError.code)
    } else {
      console.log('[swipe] swipe recorded successfully')
    }

    // Save to saved_places BEFORE match logic
    if (normalizedDirection === 'right' && userId && placeId) {
      console.log('[swipe] saving to saved_places, userId:', userId, 'placeId:', placeId)
      try {
        const { data: sd, error: se } = await admin
          .from('saved_places')
          .upsert({
            user_id: userId,
            place_id: placeId,
            place_data: placeData ?? { id: placeId, name: placeName ?? '' },
            list_name: 'Swiped Right',
            is_visited: false
          }, { onConflict: 'user_id,place_id' })
          .select()
        console.log('[swipe] saved_places result:', JSON.stringify(sd), JSON.stringify(se))
      } catch (err: any) {
        console.error('[swipe] saved_places exception:', err.message)
      }
    }

    // Get session mode for solo check
    const { data: sessionData } = await admin
      .from('sessions')
      .select('mode')
      .eq('id', sessionId)
      .single()

    const isSolo = sessionData?.mode === 'solo'

    let isMatch = false

    if (normalizedDirection === 'right') {
      const { data: participants } = await admin
        .from('session_participants')
        .select('id')
        .eq('session_id', sessionId)

      const { data: rightSwipes } = await admin
        .from('swipes')
        .select('user_id')
        .eq('session_id', sessionId)
        .eq('place_id', placeId)
        .eq('direction', 'right')

      const participantCount = participants?.length ?? 1
      const rightSwipeCount = rightSwipes?.length ?? 0
      isMatch = isSolo || rightSwipeCount >= Math.min(2, participantCount)

      console.log('[swipe] match check — mode:', sessionData?.mode, 'participants:', participantCount, 'rightSwipes:', rightSwipeCount, 'isMatch:', isMatch)

      if (isMatch) {
        const { error: matchError } = await admin
          .from('matches')
          .upsert({
            session_id: sessionId,
            place_id: placeId,
            place_data: placeData ?? { id: placeId, name: placeName },
            match_score: 100
          }, { onConflict: 'session_id,place_id' })

        if (matchError) {
          console.error('[swipe] match upsert error:', matchError.message, matchError.code)
        } else {
          console.log('[swipe] MATCH CREATED:', placeId)
        }
      }
    }

    return NextResponse.json({
      success: true,
      direction: normalizedDirection,
      matched: isMatch
    })

  } catch (e: any) {
    console.error('[swipe] CRASH:', e.message, e.stack)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
