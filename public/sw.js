/* melo service worker — offline app shell + artwork cache.
 * Audio is never cached here: downloads are owned by the app's IndexedDB
 * store so storage accounting and deletion stay exact.
 */
const VERSION = "melo-v2";
const SHELL = ["/", "/search", "/library", "/settings", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/stream")) return;

  // Artwork: cache first (immutable upstream URLs).
  if (url.pathname.startsWith("/api/image")) {
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone());
          return response;
        } catch {
          return hit || Response.error();
        }
      }),
    );
    return;
  }

  // Build assets: cache first.
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons")) {
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  // Navigations and API reads: network first, cached fallback.
  if (request.mode === "navigate" || url.pathname.startsWith("/api/")) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(VERSION);
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          const cache = await caches.open(VERSION);
          const hit = await cache.match(request);
          if (hit) return hit;
          if (request.mode === "navigate") {
            const shell = await cache.match("/");
            if (shell) return shell;
          }
          return new Response(JSON.stringify({ error: "Offline" }), {
            status: 503,
            headers: { "content-type": "application/json" },
          });
        }
      })(),
    );
  }
});
