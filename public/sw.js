/* App shell + safe runtime caching. Bump VERSION after changing precache list or logic. */
const VERSION = 3;
const SHELL_CACHE = `ppc-shell-v${VERSION}`;
const ASSETS_CACHE = `ppc-assets-v${VERSION}`;

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/icon-source.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      await Promise.all(PRECACHE_URLS.map((url) => cache.add(url).catch(() => {})));
      self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key === SHELL_CACHE || key === ASSETS_CACHE) return undefined;
            return caches.delete(key);
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

function isNavigationRequest(request) {
  return request.mode === "navigate" || request.destination === "document";
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Documents: always prefer network so users get fresh HTML after deploy; offline → precached shell only.
  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request).catch(() => caches.match("/index.html") || caches.match("/"))
    );
    return;
  }

  // Hashed Vite bundles: safe to cache (URLs change each build → no mixed-version stale HTML/JS bugs).
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(networkFirstWithCache(request, ASSETS_CACHE));
    return;
  }

  // Other same-origin static files (manifest, icons, etc.): network-first, light caching for repeat visits.
  event.respondWith(networkFirstWithCache(request, SHELL_CACHE));
});

function networkFirstWithCache(request, cacheName) {
  return fetch(request)
    .then((response) => {
      if (response && response.ok && response.type === "basic") {
        const copy = response.clone();
        caches.open(cacheName).then((cache) => cache.put(request, copy));
      }
      return response;
    })
    .catch(() => caches.match(request));
}
