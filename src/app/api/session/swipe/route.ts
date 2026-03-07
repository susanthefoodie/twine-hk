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

    // Save to saved_places if right swipe
    if (normalizedDirection === 'right') {
      console.log('[swipe] attempting to save place, userId:', userId)

      if (!userId) {
        console.log('[swipe] WARNING: no userId provided, cannot save')
      } else {
        const savePayload = {
          user_id: userId,
          place_id: placeId,
          place_data: placeData ?? { id: placeId, name: placeName },
          list_name: 'Swiped Right',
          is_visited: false
        }
        console.log('[swipe] save payload:', JSON.stringify(savePayload))

        const { data: saveData, error: saveError } = await admin
          .from('saved_places')
          .upsert(savePayload, { onConflict: 'user_id,place_id' })
          .select()

        if (saveError) {
          console.error('[swipe] SAVE FAILED:', saveError.message, saveError.code, saveError.details, saveError.hint)
        } else {
          console.log('[swipe] SAVE SUCCESS, rows:', JSON.stringify(saveData))
        }
      }
    }

    // Check for match
    const { data: rightSwipes } = await admin
      .from('swipes')
      .select('user_id')
      .eq('session_id', sessionId)
      .eq('place_id', placeId)
      .eq('direction', 'right')

    const { data: participants } = await admin
      .from('session_participants')
      .select('id')
      .eq('session_id', sessionId)

    const isMatch = rightSwipes && participants &&
      rightSwipes.length >= Math.min(2, participants.length)

    if (isMatch) {
      await admin.from('matches').upsert({
        session_id: sessionId,
        place_id: placeId,
        place_data: placeData ?? { id: placeId, name: placeName },
        match_score: 100
      }, { onConflict: 'session_id,place_id' })
      console.log('[swipe] MATCH CREATED for place:', placeId)
    }

    return NextResponse.json({
      success: true,
      direction: normalizedDirection,
      matched: isMatch ?? false
    })

  } catch (e: any) {
    console.error('[swipe] CRASH:', e.message, e.stack)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
