import { NextRequest, NextResponse } from 'next/server';
import { checkOvernightNudge, checkSessionDayReminder } from '@/server/reminders';

/**
 * Hit by Vercel Cron (vercel.json's `crons` array), once daily for each of
 * the two `kind`s below — the Hobby plan caps a cron entry at once a day,
 * which both triggers fit naturally (one push in the morning, one check at
 * night). See docs/09-PUSH-NOTIFICATIONS.md for the CRON_SECRET this
 * requires and why the middleware's PIN cookie can't cover this route (a
 * cron invocation carries no browser cookie at all).
 *
 * Mirrors src/middleware.ts's own stance on APP_PIN: refuses to run in
 * production rather than serving as an open, unauthenticated trigger
 * anyone could hit to spam every subscribed device.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new Response('CRON_SECRET is not set — see docs/09-PUSH-NOTIFICATIONS.md', { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const kind = request.nextUrl.searchParams.get('kind');
  if (kind !== 'overnight-nudge' && kind !== 'session-day') {
    return new Response('?kind must be "session-day" or "overnight-nudge"', { status: 400 });
  }

  try {
    const result = kind === 'overnight-nudge' ? await checkOvernightNudge() : await checkSessionDayReminder();
    return NextResponse.json({ kind, result });
  } catch (err) {
    return NextResponse.json(
      { kind, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
