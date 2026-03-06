import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/auth?error=auth_failed`);
  }

  const cookieStore = cookies();

  // Capture cookies that Supabase wants to set so we can apply them
  // directly to the redirect response (cookies().set() does NOT
  // automatically transfer to a NextResponse.redirect() in Next.js 14).
  const pendingCookies: { name: string; value: string; options: CookieOptions }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Buffer them — we'll write to the response after we know the redirect URL
          pendingCookies.push(...cookiesToSet);
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[auth/callback] exchangeCodeForSession error:', error.message);
    return NextResponse.redirect(`${origin}/auth?error=auth_failed`);
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/auth?error=auth_failed`);
  }

  // Upsert profile row using the admin client so RLS never blocks a first-time insert.
  // Pull display_name + avatar from Google OAuth user_metadata on first sign-in.
  const admin = createAdminClient();
  const { error: profileErr } = await admin.from('profiles').upsert(
    {
      id:           user.id,
      display_name: (user.user_metadata?.full_name as string | undefined) ?? null,
      avatar_url:   (user.user_metadata?.avatar_url  as string | undefined) ?? null,
    },
    { onConflict: 'id', ignoreDuplicates: true }
  );
  if (profileErr) {
    console.error('[auth/callback] profiles upsert error:', profileErr.message);
  }

  // Decide where to send the user (also via admin to avoid RLS on preferences)
  const { data: prefs } = await admin
    .from('preferences')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  const destination = prefs ? '/home' : '/onboarding';
  const response = NextResponse.redirect(`${origin}${destination}`);

  // ── Critical: write all session cookies onto the redirect response ──
  // Without this the browser never receives the auth token and the
  // middleware will redirect the user back to /auth on every protected route.
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });

  return response;
}
