import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The project URL is not a secret — it is a public endpoint, and row-level
 * security is what protects the data behind it.
 */
const SUPABASE_URL = 'https://evlxbewvsgrlncvtagmf.supabase.co';

/**
 * Connects with the publishable key by default — the same key every other app
 * on this account uses, the kind meant to ship in a browser bundle. That means
 * the app works with zero configuration, matching how the rest of the stack
 * behaves: nothing to paste into Vercel, nothing to get wrong.
 *
 * The t4m_ tables carry RLS policies that allow this key through. The app's
 * own PIN gate, not the database, is what keeps a stranger out.
 *
 * Setting SUPABASE_SECRET_KEY in Vercel switches to the secret key instead —
 * tightening the database itself, not just the app's front door — and needs no
 * code change to take effect.
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
