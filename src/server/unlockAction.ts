'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
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
 *
 * Bound directly to `/unlock`'s `<form action={unlock}>` (a server
 * component — see that page for why), so this redirects on both outcomes
 * rather than returning a result a client component would branch on: `next`
 * on success, back to `/unlock` with `?error=` set on failure. That is what
 * lets the form work with JavaScript disabled, not just with it.
 */
export async function unlock(formData: FormData): Promise<never> {
  const pin = process.env.APP_PIN;
  const given = String(formData.get('pin') ?? '');
  const rawNext = String(formData.get('next') ?? '/today');
  // Only ever redirect somewhere inside this app — an open redirect via a
  // crafted `next` value is exactly the kind of thing a public, unauthenticated
  // form should never trust.
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/today';

  // A plain function declaration, not a `const` arrow — TypeScript only
  // narrows later references after a call to a never-returning *function
  // declaration*, not after calling a never-returning value bound to a
  // const (the `pin` uses below rely on this narrowing after `if (!pin)`).
  function backToUnlock(error: string): never {
    redirect(`/unlock?next=${encodeURIComponent(next)}&error=${encodeURIComponent(error)}`);
  }

  const allowed = await checkUnlockRateLimit();
  if (!allowed) backToUnlock('Too many attempts. Try again in a few minutes.');
  if (!pin) backToUnlock('Wrong PIN'); // no APP_PIN configured — never say so to an unauthenticated caller

  if (!safeEqual(await deriveToken(given), await deriveToken(pin))) {
    // Slow down casual guessing. Not a substitute for the rate limit above.
    await new Promise((resolve) => setTimeout(resolve, 400));
    backToUnlock('Wrong PIN');
  }

  (await cookies()).set(COOKIE_NAME, await deriveToken(pin), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE, path: '/',
  });
  redirect(next);
}
