import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_NAME, deriveToken, safeEqual } from '@/server/lock';

/**
 * One athlete, one app. If APP_PIN is set, everything sits behind it.
 * Deliberately simple: this keeps strangers out of a personal training log,
 * it is not protecting anything of value to anyone else.
 */
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

  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/unlock') || pathname.startsWith('/_next') || pathname.startsWith('/icon')) {
    return NextResponse.next();
  }
  const presented = request.cookies.get(COOKIE_NAME)?.value ?? '';
  if (safeEqual(presented, await deriveToken(pin))) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/unlock';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.*).*)'],
};
