/* Postcard Press — offline service worker.
   The page itself is fetched network-first (so a new release shows up on the
   next visit); everything else is cache-first. The app never uploads anything. */
const CACHE = 'postcard-press-v2.0.0';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './fonts/instrument-serif.woff2',
  './fonts/instrument-serif-italic.woff2',
  './fonts/anton.woff2',
  './vendor/exifr.lite.umd.js',
  './vendor/qrcode.bundle.js',
  './manifest.json',
  './favicon.svg',
  './icons/favicon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  /* pages: try the network first, fall back to the cached copy offline */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./index.html', copy)); }
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  /* assets: cache first, then network (and remember it) */
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }))
  );
});
