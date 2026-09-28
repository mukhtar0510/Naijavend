// Naijavend service worker — installable PWA + offline mode.
//
// Strategy:
//  - Precache the app shell (offline page + icons) at install.
//  - Navigations: network-first, fall back to runtime cache, then /offline.
//    Successful HTML responses are cached so previously visited pages work offline.
//  - Static assets (/_next/static, /icons): cache-first (immutable content).
//  - Never intercept: Supabase REST/auth/storage, maps tiles, fonts CSS (network
//    only — data must be live and user-specific).
const VERSION = 'naijavend-v3';
const SHELL = [
  '/offline',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-192.png',
  '/icons/maskable-512.png',
  '/icons/favicon-32.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Live data + cross-origin resources the SW must never own.
const BYPASS_HOSTS = ['supabase.co', 'supabase.in', 'google.com', 'gstatic.com', 'googleapis.com', 'unsplash.com'];

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Only handle same-origin navigations and static assets.
  if (url.origin !== self.location.origin) {
    if (BYPASS_HOSTS.some((h) => url.hostname.endsWith(h))) return;
    return;
  }

  // App routes start with '/' and are not static files.
  const isStatic =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest';

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Cache successful HTML for offline replays.
          if (res && res.status === 200 && res.headers.get('content-type')?.includes('text/html')) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match('/offline'))
        )
    );
    return;
  }

  if (isStatic) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
  }
});
