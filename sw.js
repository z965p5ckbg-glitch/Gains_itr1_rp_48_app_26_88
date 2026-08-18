// Gains — offline shell.
// Purpose: the app must open in a basement gym with no signal. Without this,
// a hosted copy needs the network on EVERY launch, which is exactly the wrong
// dependency for the one place the app has to work.
//
// Strategy: cache-first for the shell (instant, offline-proof), with a quiet
// background refresh so a newly pushed version is picked up on the NEXT launch.
// Deliberately never update mid-session — swapping the app out from under
// someone mid-workout is worse than showing yesterday's build for one session.
const CACHE = 'gains-shell-v1';
const SHELL = ['./', './index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // never touch API calls

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      // Background refresh: update the cache for next launch, never this one.
      const net = fetch(req).then(res => {
        // Only cache a genuine same-origin 200. This guard matters if the site
        // sits behind an auth gate (e.g. Cloudflare Access): an expired session
        // returns a redirect to a login page, and caching THAT as the app shell
        // would brick the app until the cache was cleared by hand.
        const cacheable = res && res.ok && !res.redirected && res.type === 'basic';
        if (cacheable) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => null);

      // Cache-first: instant open, works with zero signal.
      return hit || net.then(r => r || caches.match('./index.html'));
    })
  );
});
