import { requireUnlocked } from '@/server/authGuard';
import { exportLoggedSetsCsv } from '@/server/export';

/**
 * `/unlock` aside, the PIN cookie check in src/middleware.ts already covers
 * this route (it isn't in that matcher's exclusion list) — an unauthenticated
 * GET here redirects to /unlock before this ever runs. requireUnlocked() is
 * the same defense-in-depth this app now applies everywhere a mutation or a
 * read of the athlete's own data happens (docs/07-PRODUCTION-REVIEW.md #1),
 * so this route never depends on middleware alone either.
 */
export async function GET(): Promise<Response> {
  try {
    await requireUnlocked();
  } catch {
    return new Response('Locked', { status: 401 });
  }

  const csv = await exportLoggedSetsCsv();
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="training4me-sets-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
