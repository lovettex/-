// Service Worker for transparently handling and retrying transient 429/503 responses
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Only intercept GET requests on same origin
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Intercept module/script requests
  event.respondWith(
    (async () => {
      let res;
      try {
        res = await fetch(event.request);
      } catch (err) {
        // Short pause and retry on network disruption
        await new Promise((r) => setTimeout(r, 200));
        return fetch(event.request);
      }

      // If gateway or Cloud Run ingress throttles with 429 or 503, retry with backoff
      if (res.status === 429 || res.status === 503) {
        await new Promise((r) => setTimeout(r, 300));
        try {
          const retryRes1 = await fetch(event.request);
          if (retryRes1.status === 429 || retryRes1.status === 503) {
            await new Promise((r) => setTimeout(r, 600));
            return fetch(event.request);
          }
          return retryRes1;
        } catch (e) {
          return res;
        }
      }

      return res;
    })()
  );
});
