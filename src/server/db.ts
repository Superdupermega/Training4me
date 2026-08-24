import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Single-athlete app: the t4m_ tables have RLS enabled with no policies, so
 * anon and authenticated keys can read nothing. Every query goes through here,
 * server-side, with the service role. This client must never reach the browser.
 */
export function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env.local and fill them in.',
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export const PROFILE_ID = 'me';
