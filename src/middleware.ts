import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_NAME, deriveToken, safeEqual } from '@/server/lock';

/**
 * One athlete, one app. If APP_PIN is set, everything sits behind it.
 * Deliberately simple: this keeps strangers out of a personal training log,
 * it is not protecting anything of value to anyone else.
 */

// The PIN cannot change without a redeploy, so its derived token is computed
// once per running Edge isolate rather than hashed on every single request.
let cachedPin: string | undefined;
let cachedToken: Promise<string> | null = null;

function tokenForPin(pin: string): Promise<string> {
  if (cachedPin !== pin) {
    cachedPin = pin;
    cachedToken = deriveToken(pin);
  }
  return cachedToken!;
}

export async function middleware(request: NextRequest) {
  const pin = process.env.APP_PIN;
  if (!pin) {
    // Locally it is convenient to run without a lock. Deployed, an unset PIN
    // would mean a public training log, so refuse to serve instead.
    if (process.env.NODE_ENV !== 'production') return NextResponse.next();
    return new NextResponse(
      'APP_PIN is not set. Add it in your Vercel project settings and redeploy.',
      { status: 503, headers: { 'content-type': 'text/plain' } },
    );
  }

  const presented = request.cookies.get(COOKIE_NAME)?.value ?? '';
  if (safeEqual(presented, await tokenForPin(pin))) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/unlock';
  url.searchParams.set('next', request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except: Next's own asset pipeline (in full, not just the
  // static/image sub-paths — an RSC prefetch or a webpack-hmr request under
  // any other _next/* sub-path used to still pay for an Edge invocation),
  // the unlock page itself (no reason to gate the gate), the offline
  // fallback the service worker precaches and serves with no network at all
  // (same reasoning — gating it would just mean an offline visitor bounces
  // to /unlock, which is equally unreachable with no connection), sw.js
  // itself (a browser fetches a service-worker script directly and rejects
  // anything but a real JS response — a redirect to /unlock's HTML fails
  // registration outright, not gracefully), and static files that need no
  // lock at all.
  matcher: [
    '/((?!_next/|unlock|offline|sw\\.js|favicon.ico|manifest.webmanifest|icon.*|.*\\.svg$).*)',
  ],
};
