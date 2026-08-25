import 'server-only';
import { headers } from 'next/headers';
import { db } from './db';

/**
 * Best-effort client IP for rate limiting only — never for authorization.
 * Vercel sets `x-forwarded-for`; a self-hosted deployment without a proxy in
 * front falls back to a shared bucket rather than throwing, which is a worse
 * limiter but never a broken unlock screen.
 */
async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return h.get('x-real-ip') ?? 'unknown';
}

/**
 * True if this IP is still under the unlock attempt limit (and records the
 * attempt); false once it has made 8 in the last 15 minutes. Enforced in
 * Postgres via a SECURITY DEFINER RPC (`t4m_check_unlock_attempt`) against a
 * table with no client-facing RLS policy at all, so it holds even before
 * `SUPABASE_SECRET_KEY` is configured — a parallel in-memory counter would
 * reset on every cold start and do nothing across serverless instances.
 */
export async function checkUnlockRateLimit(): Promise<boolean> {
  const ip = await clientIp();
  const { data, error } = await db().rpc('t4m_check_unlock_attempt', { p_ip: ip });
  if (error) {
    // Fail open: a rate-limiter outage should not lock the one athlete this
    // app exists for out of their own log.
    return true;
  }
  return Boolean(data);
}
