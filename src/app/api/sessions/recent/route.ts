import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// GET /api/sessions/recent
// Returns the 6 most recent sessions hosted by the authenticated user.
// Uses the admin client for the DB query so RLS never blocks it.
export async function GET() {
  try {
    // Verify the caller is authenticated
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
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use admin client — bypasses RLS entirely
    const admin = createAdminClient();
    const { data: sessions, error } = await admin
      .from('sessions')
      .select('id, mode, created_at, share_code')
      .eq('host_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(6);

    if (error) {
      console.error('[api/sessions/recent] query error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sessions: sessions ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[api/sessions/recent] unhandled error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
