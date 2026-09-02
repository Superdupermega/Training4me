import 'server-only';
import { db } from '../db';

/**
 * The coach's own burst limiter, separate from the daily/monthly cost caps
 * (`config.ts`/`costCap.ts`) — those catch a runaway bill over a day or a
 * month, not twenty messages in ten seconds before either cap even notices
 * (`docs/chunks/chunk-29-coach-guardrails.md §1`).
 *
 * Same shape as `checkUnlockRateLimit()` (`src/server/rateLimit.ts`): a
 * Postgres RPC, `SECURITY DEFINER`, against `t4m_rate_limit` — a table with
 * no client-facing RLS policy at all — fail-open on error, mirroring that
 * function's own comment exactly: a rate-limiter outage must never lock the
 * athlete out of their own coach.
 *
 * Reuses the existing `t4m_rate_limit` table rather than a new one, keyed by
 * a constant `'coach'` bucket instead of `clientIp()` — there's no "IP" that
 * means anything for a single-athlete server action the way it does for the
 * public `/unlock` endpoint, so this is one athlete, one bucket, 10 messages
 * per rolling minute (`t4m_check_coach_rate_limit`, migration
 * `t4m_coach_rate_limit`, applied live and confirmed with a direct RPC call
 * — 10 allowed, the 11th refused).
 */
export async function checkCoachRateLimit(): Promise<boolean> {
  const { data, error } = await db().rpc('t4m_check_coach_rate_limit');
  if (error) {
    // Fail open: same reasoning as `checkUnlockRateLimit` — a rate-limiter
    // outage should not lock the one athlete this app exists for out of
    // their own coach.
    return true;
  }
  return Boolean(data);
}
