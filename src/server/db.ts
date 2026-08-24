import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * The project URL is not a secret — it is a public endpoint, and row-level
 * security is what protects the data behind it. So it is fixed here rather than
 * configured: a typo in a hand-entered URL surfaces as an opaque
 * "Invalid API key", which sends you looking in entirely the wrong place.
 */
const SUPABASE_URL = 'https://evlxbewvsgrlncvtagmf.supabase.co';

/**
 * The secret key is the opposite: it bypasses RLS on the whole project, so it
 * only ever comes from the environment, never from this repository, which is
 * public. Either variable name works — whichever is already set.
 */
function readSecret(): string | undefined {
  // Trimmed: a trailing newline on a pasted secret is invisible and fails the
  // same opaque way.
  return (
    process.env.SUPABASE_SECRET_KEY?.trim()
    || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    || undefined
  );
}

/** Describes what the key *is* without ever revealing it. */
export function describeKey(key: string | undefined): string {
  if (!key) return 'missing';
  if (key.startsWith('sb_secret_')) return 'sb_secret (correct type)';
  if (key.startsWith('sb_publishable_')) return 'sb_publishable — this is the PUBLIC key, not the secret one';
  if (key.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(
        Buffer.from(key.split('.')[1] ?? '', 'base64').toString('utf8'),
      ) as { role?: string; ref?: string };
      const project = payload.ref === 'evlxbewvsgrlncvtagmf'
        ? 'this project'
        : `project "${payload.ref}" — WRONG PROJECT`;
      return `legacy JWT, role=${payload.role}, ${project}`;
    } catch {
      return 'looks like a truncated JWT';
    }
  }
  return `unrecognised (${key.length} characters)`;
}

/** Safe to print in an error: says what is configured, never the secret. */
export function connectionSummary(): string {
  return `project=${SUPABASE_URL} key=${describeKey(readSecret())}`;
}

export function db() {
  const key = readSecret();
  if (!key) {
    throw new Error(
      'No Supabase secret key configured. Set SUPABASE_SECRET_KEY in Vercel '
      + '(Settings -> Environment Variables, Production), then redeploy.',
    );
  }
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}

export const PROFILE_ID = 'me';
