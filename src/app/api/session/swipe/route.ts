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

    // 1. Insert into swipes using EXACT column names
    const { error: swipeError } = await admin
      .from('swipes')
      .insert({
        session_id: sessionId,
        place_id: placeId,
        direction: normalizedDirection,
        user_id: userId ?? null,
        guest_participant_id: null,
        place_name: placeName ?? null
      })
    if (swipeError && swipeError.code !== '23505') {
      console.error('[swipe] swipe error:', swipeError.message, swipeError.code)
    } else {
      console.log('[swipe] swipe inserted ok, direction:', normalizedDirection)
    }

    if (normalizedDirection === 'right') {

      // 2. Insert into saved_places using EXACT column names
      if (userId && placeId) {
        const { data: saveData, error: saveError } = await admin
          .from('saved_places')
          .upsert({
            user_id: userId,
            place_id: placeId,
            place_data: placeData ?? { id: placeId, name: placeName ?? '' },
            list_name: 'Swiped Right',
            is_visited: false
          }, { onConflict: 'user_id,place_id' })
          .select()
        if (saveError) {
          console.error('[swipe] SAVE ERROR:', saveError.message, saveError.code, saveError.details, saveError.hint)
        } else {
          console.log('[swipe] SAVE SUCCESS:', JSON.stringify(saveData))
        }
      } else {
        console.log('[swipe] skipping saved_places — userId:', userId, 'placeId:', placeId)
      }

      // 3. Insert into matches using EXACT column names
      // Check first to avoid duplicates (no unique constraint on session_id,place_id)
      const { data: existing } = await admin
        .from('matches')
        .select('id')
        .eq('session_id', sessionId)
        .eq('place_id', placeId)
        .maybeSingle()

      if (existing) {
        // Update place_data if it was stored as empty {} by check_for_match trigger
        const { error: updateErr } = await admin
          .from('matches')
          .update({
            place_data: placeData ?? { id: placeId, name: placeName ?? '' },
            match_score: 100
          })
          .eq('id', existing.id)
        if (updateErr) {
          console.error('[swipe] MATCH UPDATE ERROR:', updateErr.message)
        } else {
          console.log('[swipe] MATCH UPDATED existing row:', existing.id)
        }
      } else {
        // Determine if we should create a match now
        const { data: sessionData } = await admin
          .from('sessions')
          .select('mode')
          .eq('id', sessionId)
          .single()

        const isSolo = !sessionData?.mode || sessionData.mode === 'solo'

        let shouldMatch = isSolo

        if (!isSolo) {
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
          console.log('[swipe] group — participants:', participantCount, 'rightSwipes:', rightSwipeCount)
          shouldMatch = rightSwipeCount >= participantCount
        }

        console.log('[swipe] mode:', sessionData?.mode, 'shouldMatch:', shouldMatch)

        if (shouldMatch) {
          const { data: matchData, error: matchError } = await admin
            .from('matches')
            .insert({
              session_id: sessionId,
              place_id: placeId,
              place_data: placeData ?? { id: placeId, name: placeName ?? '' },
              match_score: 100,
              is_visited: false
            })
            .select()
          if (matchError) {
            console.error('[swipe] MATCH ERROR:', matchError.message, matchError.code, matchError.details)
          } else {
            console.log('[swipe] MATCH CREATED:', JSON.stringify(matchData))
          }
        }
      }
    }

    return NextResponse.json({ success: true, direction: normalizedDirection })

  } catch (e: any) {
    console.error('[swipe] CRASH:', e.message, e.stack)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
