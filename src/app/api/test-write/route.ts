import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from('saved_places')
    .insert({
      user_id: '3b5bb4e7-7ffa-4d92-8ce8-9df3d3d62905',
      place_id: 'test-place-' + Date.now(),
      place_data: { id: 'test', name: 'Test Restaurant' },
      list_name: 'Swiped Right',
      is_visited: false
    })
    .select()

  return NextResponse.json({ data, error })
}
