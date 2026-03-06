import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

// GET /api/session/info?id=<sessionId>
// Returns session mode + filters for the swipe page.
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: session, error } = await admin
    .from('sessions')
    .select('id, mode, status, filters')
    .eq('id', id)
    .maybeSingle();

  if (error || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  if (session.status !== 'active') {
    return NextResponse.json({ error: 'Session has ended' }, { status: 410 });
  }

  return NextResponse.json({
    id: session.id,
    mode: session.mode,
    filters: session.filters ?? {},
  });
}
