import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Routes that require an authenticated session
const PROTECTED_PREFIXES = [
  '/home',
  '/saved',
  '/profile',
  '/onboarding',
  '/results',
];

// Routes where a logged-in user should be bounced straight to /home
const AUTH_ENTRY_ROUTES = ['/', '/auth'];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // 1. Authenticated user on landing / auth → send them into the app
  if (user && AUTH_ENTRY_ROUTES.includes(pathname)) {
    return NextResponse.redirect(new URL('/home', request.url));
  }

  // 2. Protected routes — require auth
  // /session, /join, and all /api routes are intentionally PUBLIC
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/auth', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)',
  ],
};
