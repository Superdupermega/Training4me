'use server';
import { cookies } from 'next/headers';
import { COOKIE_MAX_AGE, COOKIE_NAME, deriveToken, safeEqual } from './lock';
import { checkUnlockRateLimit } from './rateLimit';

/**
 * Deliberately its own module, imported by nothing except `/unlock`. Next.js
 * registers every export of a `'use server'` file as callable from every
 * route that imports any of them — when `unlock` lived in `actions.ts`
 * alongside everything else, `/unlock`'s build output listed
 * `regenerateProgram`, `logSets`, `finishSession` and the rest as reachable
 * workers of that page, with the PIN cookie check nowhere in the path
 * (middleware excludes `/unlock` on purpose — see below). See
 * docs/07-PRODUCTION-REVIEW.md #1.
 */
export type UnlockResult = { ok: true } | { ok: false; error: string };

export async function unlock(formData: FormData): Promise<UnlockResult> {
  const pin = process.env.APP_PIN;
  const given = String(formData.get('pin') ?? '');

  const allowed = await checkUnlockRateLimit();
  if (!allowed) {
    return { ok: false, error: 'Too many attempts. Try again in a few minutes.' };
  }

  if (!pin || !safeEqual(await deriveToken(given), await deriveToken(pin))) {
    // Slow down casual guessing. Not a substitute for the rate limit above.
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { ok: false, error: 'Wrong PIN' };
  }
  (await cookies()).set(COOKIE_NAME, await deriveToken(pin), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE, path: '/',
  });
  return { ok: true };
}
