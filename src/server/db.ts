import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Single-athlete app: the t4m_ tables have RLS enabled with no policies, so
 * anon and authenticated keys can read nothing. Every query goes through here,
 * server-side, with the service role. This client must never reach the browser.
 */
/**
 * The project URL is not a secret — it is a public endpoint that ships in the
 * client bundle of every Supabase app, and RLS is what protects the data behind
 * it. So it lives in code and only the service-role key has to be configured.
 *
 * The service-role key is the opposite: it bypasses RLS entirely. It must only
 * ever come from the environment, never from this repository.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  ?? 'https://tqfrnzjvyviykrbfzlxp.supabase.co';

export function db() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Add it in Vercel (Settings -> Environment Variables, Production) and redeploy, or put it in .env.local to run locally.',
    );
  }
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}

export const PROFILE_ID = 'me';
