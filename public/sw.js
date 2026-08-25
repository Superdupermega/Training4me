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
