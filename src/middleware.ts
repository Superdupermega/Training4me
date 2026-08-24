import { NextResponse, type NextRequest } from 'next/server';

/**
 * One athlete, one app. If APP_PIN is set, everything sits behind it.
 * Deliberately simple: this keeps strangers out of a personal training log,
 * it is not protecting anything of value to anyone else.
 */
export function middleware(request: NextRequest) {
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
  if (request.cookies.get('t4m_unlocked')?.value === pin) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/unlock';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.*).*)'],
};
