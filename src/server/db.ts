import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The project URL is not a secret — it is a public endpoint, and row-level
 * security is what protects the data behind it.
 */
const SUPABASE_URL = 'https://evlxbewvsgrlncvtagmf.supabase.co';

/**
 * Falls back to the publishable key only when `SUPABASE_SECRET_KEY` is
 * unset — which, since docs/08-RLS-TIGHTENING.md was applied on
 * 2026-08-26, means every `t4m_` table refuses it outright: `pg_policies`
 * on the live project shows one `service_role`-only policy on each,
 * nothing granted to `anon`/`authenticated`. This fallback is not "the app
 * still works, just less locked down" — it is "every read comes back
 * empty and every write fails" — kept only so a missing key fails as
 * loud, legible Postgres/PostgREST errors instead of `db()` itself
 * throwing before a request even reaches Supabase. See `README.md`
 * ("Database access") for what actually has to be configured, in every
 * environment including local dev.
 */
const PUBLISHABLE_KEY = 'sb_publishable_vpwx3wRY7j-5xsIe0-jjyA_olXG2fl9';

function resolveKey(): { key: string; usingSecret: boolean } {
  // Trimmed: a trailing newline from a pasted secret is invisible and fails as
  // an opaque "Invalid API key".
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (secret) return { key: secret, usingSecret: true };
  return { key: PUBLISHABLE_KEY, usingSecret: false };
}

// Memoised at module scope: there is no per-request auth state (persistSession
// is off and the key never varies within a running process), so a new client
// per call was pure waste — every call re-did URL parsing and header setup for
// nothing. One client, reused for the life of the server instance.
let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!client) client = createClient(SUPABASE_URL, resolveKey().key, { auth: { persistSession: false } });
  return client;
}

export const PROFILE_ID = 'me';

/** Safe to print in an error: says what is configured, never the secret itself. */
export function connectionSummary(): string {
  const { key, usingSecret } = resolveKey();
  const kind = key.startsWith('sb_secret_') ? 'sb_secret'
    : key.startsWith('sb_publishable_') ? 'sb_publishable'
      : key.startsWith('eyJ') ? 'legacy JWT'
        : 'unrecognised';
  return `project=${SUPABASE_URL} key=${kind} source=${usingSecret ? 'SUPABASE_SECRET_KEY' : 'built-in publishable key'}`;
}
