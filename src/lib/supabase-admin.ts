import { createClient } from '@supabase/supabase-js';

/**
 * Supabase admin client — uses the service role key to bypass RLS.
 * ONLY import this in server-side files (API route handlers, server components).
 * NEVER expose to the browser.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
