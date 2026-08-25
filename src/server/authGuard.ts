import 'server-only';
import { cookies } from 'next/headers';
import { COOKIE_NAME, deriveToken, safeEqual } from './lock';

/**
 * The real authorization boundary. `src/middleware.ts` is a UX convenience —
 * it redirects an unlocked browser to `/unlock` before it wastes a render —
 * but Next.js treats every server action as its own public HTTP endpoint,
 * reachable directly with a `Next-Action` header regardless of which page
 * requested it or what middleware would have done with a normal navigation.
 * Every mutating action in `actions.ts` and `routines.ts` calls this first.
 *
 * (See docs/07-PRODUCTION-REVIEW.md #1 — this guard, plus splitting `unlock`
 * into its own module so `/unlock` no longer drags in every other action's
 * worker registration, are the two independent fixes for the bypass.)
 */
export async function requireUnlocked(): Promise<void> {
  const pin = process.env.APP_PIN;
  if (!pin) return; // No lock configured (local dev). Production refuses to boot without one — see middleware.ts.
  const presented = (await cookies()).get(COOKIE_NAME)?.value ?? '';
  if (!safeEqual(presented, await deriveToken(pin))) {
    throw new Error('Locked');
  }
}
