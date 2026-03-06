import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const cookieStore = cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Ensure a profiles row exists (first sign-in creates it)
        await supabase
          .from('profiles')
          .upsert(
            { id: user.id, email: user.email ?? '' },
            { onConflict: 'id', ignoreDuplicates: true }
          );

        // Check whether onboarding preferences have been set
        const { data: prefs } = await supabase
          .from('preferences')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        return NextResponse.redirect(`${origin}${prefs ? '/home' : '/onboarding'}`);
      }
    }
  }

  // Auth failed — send back with an error flag
  return NextResponse.redirect(`${origin}/auth?error=auth_failed`);
}
