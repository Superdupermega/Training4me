/**
 * Genuinely public — handed to the browser on every subscribe call, the
 * same way the Supabase publishable key in src/server/db.ts is meant to
 * ship in a bundle. Lives in src/core (not src/server, which is
 * 'server-only') specifically so the client subscribe flow
 * (NotificationsCard.tsx) can import it directly. See src/server/push.ts
 * for the private half, which never leaves the server.
 */
export const VAPID_PUBLIC_KEY =
  'BLbeeHRZAhZ33u6wo8WKReUZ8cPmH_6BaSuXGg5JptTTbly0B7tuL2fOfNlbHQ-cdnTOCLOqkwPRrldrmuzgwX0';

/** A push subscription's applicationServerKey must be a raw Uint8Array, not the base64url string. */
export function vapidPublicKeyBytes(): Uint8Array<ArrayBuffer> {
  const base64 = VAPID_PUBLIC_KEY.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const raw = atob(padded);
  // Built over an explicit `new ArrayBuffer(...)` rather than
  // `Uint8Array.from`/`new Uint8Array(length)`, both of which this TS lib
  // version infers as SharedArrayBuffer-compatible `Uint8Array<ArrayBufferLike>`
  // — PushSubscriptionOptionsInit.applicationServerKey wants a concrete
  // ArrayBuffer-backed view.
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
