import { createBrowserClient } from '@supabase/ssr';

/**
 * Creates a Supabase browser client.
 * Call this inside client components — never at module scope.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/** Returns the currently authenticated user, or null. Client-side only. */
export async function getUser() {
  const { data: { user } } = await createClient().auth.getUser();
  return user ?? null;
}
