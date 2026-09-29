/* Gym service worker: the whole app is cached on first visit so it opens instantly, even with no signal.
   Updates are fetched in the background and used from the next launch. Your data is not stored here — it lives in IndexedDB. */
const VERSION = '__VERSION__';
const CACHE = 'gym-' + VERSION;
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/favicon.png', './fonts/BarlowCondensed-500.woff2', './fonts/BarlowCondensed-600.woff2', './fonts/BarlowCondensed-700.woff2', './fonts/Manrope-400.woff2'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('gym-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    // app page: serve the cached copy immediately, refresh the cache in the background
    e.respondWith(caches.open(CACHE).then(async c => {
      const cached = await c.match('./index.html');
      const net = fetch(req).then(r => { if (r.ok) c.put('./index.html', r.clone()); return r; }).catch(() => null);
      return cached || (await net) || new Response('Offline', { status: 503 });
    }));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) { const cl = r.clone(); caches.open(CACHE).then(c => c.put(req, cl)); } return r; })));
});
