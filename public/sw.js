// Settle Down web app service worker. It makes the home-screen app open fast and show its shell
// without a connection. It caches ONLY our own static files (app code, fonts, icons). Budget and
// bank data come from Supabase on another origin and are never cached here (security policy:
// no consumer data at rest outside Supabase and the signed-in device's session store).
const CACHE = 'settledown-shell-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Other origins (Supabase, Plaid) and anything but GET go straight to the network.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // Pages: always try the network first so a new release shows up on the next open; fall back
  // to the cached shell offline. The router then draws the right screen.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('/', copy)); }
          return res;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  // Bundles and assets have content hashes in their names, so a cached copy never goes stale.
  if (url.pathname.startsWith('/_expo/') || url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })),
    );
  }
});
