// Offline support for the Home Screen app.
// Pages: network first (so a new version arrives when online), cached copy when offline.
// Built files: cache first; their names contain a content hash, so a new build never reuses old files.
const BASE = '/ndecc-prep/';
const CACHE = 'ndecc-prep-v1';
const PAGE_TIMEOUT_MS = 3000;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  if (req.mode === 'navigate') {
    // Every route is the same single page.
    event.respondWith(
      withTimeout(fetch(req), PAGE_TIMEOUT_MS)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(BASE, res.clone()));
          return res;
        })
        .catch(() => caches.match(BASE)),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
