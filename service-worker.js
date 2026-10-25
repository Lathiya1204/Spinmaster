/* =====================================================================
   SPIN MASTER — service-worker.js
   Caches the app shell so the game works offline and can be installed.
   After you edit any game file, change CACHE_VERSION so players (and
   you, while testing) receive the new files.
   ===================================================================== */
const CACHE_VERSION = 'v5';
const CACHE_NAME = 'spin-master-' + CACHE_VERSION;
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

// Install: pre-cache everything the game needs
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

// Activate: delete caches from older versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('spin-master-') && k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch: cache first, then network (and refresh the cache in the background)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached || (req.mode === 'navigate' ? caches.match('./index.html') : undefined));
      return cached || network;
    })
  );
});
