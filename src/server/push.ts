import 'server-only';
import webpush from 'web-push';
import { VAPID_PUBLIC_KEY } from '@/core/push';
import { db } from './db';

/**
 * Web Push — docs/07-PRODUCTION-REVIEW.md #24. No push, no scheduled
 * reminders existed; a training app that never speaks first is one you stop
 * opening in week three. The service worker was already registered and a
 * PWA install already supported (public/sw.js), so the delivery mechanism
 * sat there unused — this is what actually uses it.
 *
 * The public key (src/core/push.ts) is meant to be public — handed to the
 * browser on every subscribe call, the same way a Supabase publishable key
 * is meant to ship in a bundle (src/server/db.ts uses the identical pattern
 * for exactly that reason). The private key is not: it lives only in
 * `VAPID_PRIVATE_KEY`, never in this repository. See
 * docs/09-PUSH-NOTIFICATIONS.md for the one manual step — generating a
 * keypair and setting that env var — nothing here can do that for you.
 */
let configured = false;
function ensureConfigured(): boolean {
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!privateKey) return false;
  if (!configured) {
    webpush.setVapidDetails('mailto:training4me@example.invalid', VAPID_PUBLIC_KEY, privateKey);
    configured = true;
  }
  return true;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function savePushSubscription(sub: PushSubscriptionInput): Promise<void> {
  const { error } = await db().from('t4m_push_subscription').upsert(
    { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    { onConflict: 'endpoint' },
  );
  if (error) throw new Error(error.message);
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  const { error } = await db().from('t4m_push_subscription').delete().eq('endpoint', endpoint);
  if (error) throw new Error(error.message);
}

interface StoredSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function listPushSubscriptions(): Promise<StoredSubscription[]> {
  const { data, error } = await db().from('t4m_push_subscription').select('endpoint, p256dh, auth');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface PushPayload {
  title: string;
  body: string;
  /** Path the notification opens on click, e.g. "/today". */
  url: string;
}

/**
 * Sends to every subscribed device. Returns how many actually went out —
 * the cron route logs this rather than assuming success. A subscription
 * whose endpoint the browser has since revoked (uninstalled the PWA,
 * cleared site data) fails with 404/410; those are cleaned up here rather
 * than retried forever.
 */
export async function sendPushToAll(payload: PushPayload): Promise<{ sent: number; total: number }> {
  if (!ensureConfigured()) {
    throw new Error('VAPID_PRIVATE_KEY is not set — see docs/09-PUSH-NOTIFICATIONS.md');
  }
  const subs = await listPushSubscriptions();
  let sent = 0;
  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      );
      sent += 1;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await deletePushSubscription(sub.endpoint).catch(() => {});
      }
      // Any other failure (a transient network error, a malformed payload)
      // is not this subscription's fault — leave it in place and let the
      // next scheduled send try again.
    }
  }));
  return { sent, total: subs.length };
}
