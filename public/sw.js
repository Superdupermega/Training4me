// Minimal, hand-rolled service worker — app-shell offline fallback only.
//
// This app is fundamentally online and data-driven (every real page reads
// from Supabase); this SW does not attempt to cache dynamic pages, and
// deliberately never serves a stale cached copy of one — logged sets,
// program state, and history change too often for that to be safe, and a
// stale session page is worse than an honest "you're offline" screen. What
// it does own: showing that offline screen instead of the browser's own
// error when a navigation can't reach the network, and keeping the small,
// static app shell (icons, manifest) available without a round trip.
//
// Sets logged while offline are a separate, already-solved problem — see
// src/components/session/outbox.ts, which queues to IndexedDB and flushes
// on reconnect regardless of whether this SW is even registered.
const CACHE = 't4m-shell-v1';
const OFFLINE_URL = '/offline';
const SHELL_ASSETS = [OFFLINE_URL, '/icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((res) => res ?? Response.error())),
    );
    return;
  }

  const isShellAsset = SHELL_ASSETS.some((asset) => request.url.endsWith(asset));
  if (!isShellAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return res;
      });
    }),
  );
});

// Web Push — docs/07-PRODUCTION-REVIEW.md #24. The push event carries the
// JSON payload src/server/push.ts sends ({title, body, url}); the resulting
// notification's click just focuses (or opens) that url, same behaviour a
// user tapping the app icon would get.
self.addEventListener('push', (event) => {
  let payload = { title: 'Training4me', body: '', url: '/today' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // A malformed or missing payload still shows a generic notification
    // rather than silently doing nothing.
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: { url: payload.url },
    }),
  );
});

// The rest timer (docs/chunks/chunk-24-craft.md §1) posts its `endsAt` here
// so this worker can fire the notification if the page's own tab is
// suspended before its foreground timeout runs. This is explicitly
// best-effort: a service worker with no pending fetch/push has no guarantee
// of staying alive at all, and a `setTimeout` scheduled inside one is not
// exempt from that — most browsers may simply terminate it before this
// fires. See RestTimer.tsx's own comment and DECISIONS.md for what was
// actually observed testing this on a real phone.
self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'rest-timer') return;
  const { endsAt, body } = event.data;
  const delay = Math.max(0, endsAt - Date.now());
  setTimeout(() => {
    self.registration.showNotification('Rest is up', {
      body: body || 'Next set.',
      icon: '/icon.svg', badge: '/icon.svg', tag: 'rest-timer',
    });
  }, delay);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/today';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => new URL(c.url).pathname === url);
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    }),
  );
});
