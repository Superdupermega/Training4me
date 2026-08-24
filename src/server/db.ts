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

/**
 * Pasting the publishable key instead of the secret one is the easy mistake to
 * make, and Supabase answers it with a bare "Invalid API key". Check the shape
 * up front so the error names the actual problem.
 */
function assertSecretKey(key: string): void {
  if (key.startsWith('sb_publishable_')) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY holds a publishable key (sb_publishable_...). '
      + 'It needs the secret key: Supabase -> Project Settings -> API Keys -> Secret keys.',
    );
  }
  if (key.startsWith('sb_secret_')) return;

  // Legacy keys are JWTs whose payload names the role.
  if (key.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(
        Buffer.from(key.split('.')[1] ?? '', 'base64').toString('utf8'),
      ) as { role?: string };
      if (payload.role === 'service_role') return;
      throw new Error(
        `SUPABASE_SERVICE_ROLE_KEY holds the "${payload.role}" key, not "service_role". `
        + 'Copy the service_role secret from Supabase -> Project Settings -> API Keys.',
      );
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('SUPABASE_SERVICE_ROLE_KEY')) throw err;
      throw new Error('SUPABASE_SERVICE_ROLE_KEY looks truncated — it is not a readable JWT.');
    }
  }
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY is not a recognisable Supabase key. Expected either '
    + 'sb_secret_... or a service_role JWT starting with eyJ.',
  );
}

export function db() {
  // Trim: a trailing newline from a pasted value is invisible and fails as
  // "Invalid API key", which sends you looking in entirely the wrong place.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Add it in Vercel (Settings -> Environment Variables, Production) and redeploy, or put it in .env.local to run locally.',
    );
  }
  assertSecretKey(key);
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}

export const PROFILE_ID = 'me';
