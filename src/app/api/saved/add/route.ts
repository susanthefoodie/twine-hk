import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { userId, placeId, placeData } = await req.json()
  if (!userId || !placeId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { error } = await admin
    .from('saved_places')
    .upsert({
      user_id: userId,
      place_id: placeId,
      place_data: placeData,
      list_name: 'Swiped Right',
      is_visited: false
    }, { onConflict: 'user_id,place_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
