/**
 * Diagnostic sink for `error.tsx` and `global-error.tsx` — a plain route
 * handler, not a server action, and deliberately so: both of those files
 * wrap every route (`global-error.tsx` replaces the *root* layout on a
 * crash, so it's reachable from `/unlock` too), and a `'use server'`
 * function imported from either would show up as one of `/unlock`'s
 * callable action workers in `.next/server/server-reference-manifest.json`
 * — exactly the shape `scripts/check-action-isolation.mjs` exists to catch
 * (docs/07-PRODUCTION-REVIEW.md #1). A route handler carries no such risk:
 * it's plain HTTP, invisible to that manifest.
 *
 * Best-effort only, and no side effects beyond a log line — this deviates
 * from the rest of the app's `requireUnlocked()`-everywhere-in-actions.ts
 * convention on purpose (see the module comment above): there is nothing
 * here to authorize against, and if middleware.ts's PIN check ever does
 * bounce this (an edge crash before the unlock cookie exists), the caller
 * swallows the failure — a missed log line is a worse debugging session,
 * never a worse app. Logs via `console.error` so it lands in Vercel's own
 * function logs (visible in the dashboard as-is; the base for an alert or
 * log drain later) instead of vanishing into a browser console nobody is
 * watching — not a replacement for real error reporting
 * (docs/07-PRODUCTION-REVIEW.md #26, still open).
 */
interface ClientErrorPayload {
  message?: unknown;
  stack?: unknown;
  digest?: unknown;
  url?: unknown;
  boundary?: unknown;
}

function asString(value: unknown, max = 4000): string | undefined {
  return typeof value === 'string' ? value.slice(0, max) : undefined;
}

export async function POST(request: Request): Promise<Response> {
  let body: ClientErrorPayload = {};
  try {
    body = await request.json();
  } catch {
    // Malformed body — still worth a log line saying so, not a 500.
  }

  console.error('[client error]', {
    boundary: asString(body.boundary) ?? 'unknown',
    message: asString(body.message) ?? '(no message)',
    digest: asString(body.digest),
    url: asString(body.url),
    stack: asString(body.stack),
    at: new Date().toISOString(),
  });

  return new Response(null, { status: 204 });
}
