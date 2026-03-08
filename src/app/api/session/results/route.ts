import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    const [sessionRes, matchesRes] = await Promise.all([
      admin
        .from('sessions')
        .select('id, mode')
        .eq('id', sessionId)
        .maybeSingle(),
      admin
        .from('matches')
        .select('id, place_id, place_data, match_score, is_visited')
        .eq('session_id', sessionId)
        .order('match_score', { ascending: false }),
    ])

    if (sessionRes.error || !sessionRes.data) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const matches = (matchesRes.data ?? [])
    const matchedIds = new Set(matches.map((m: any) => m.place_id))

    // Compute almost-matches server-side
    const [swipesRes, participantRes] = await Promise.all([
      admin
        .from('swipes')
        .select('place_id, place_data, user_id')
        .eq('session_id', sessionId)
        .eq('direction', 'right'),
      admin
        .from('session_participants')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId),
    ])

    const totalParticipants = participantRes.count ?? 1
    const swipeRows = (swipesRes.data ?? []) as {
      place_id: string
      place_data: any
      user_id: string | null
    }[]

    const yesCounts: Record<string, { count: number; place_data: any }> = {}
    for (const row of swipeRows) {
      if (matchedIds.has(row.place_id)) continue
      if (!yesCounts[row.place_id]) {
        yesCounts[row.place_id] = { count: 0, place_data: row.place_data }
      }
      yesCounts[row.place_id].count += 1
    }

    const almostMatches = Object.entries(yesCounts)
      .filter(([, v]) => v.place_data !== null && v.count < totalParticipants)
      .map(([place_id, v]) => ({
        place_id,
        place_data: v.place_data,
        yes_count: v.count,
        total_count: totalParticipants,
      }))
      .sort((a, b) => b.yes_count - a.yes_count)
      .slice(0, 5)

    return NextResponse.json({
      session: sessionRes.data,
      matches,
      almostMatches,
    })
  } catch (e: any) {
    console.error('[results] CRASH:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
