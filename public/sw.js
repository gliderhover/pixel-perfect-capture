/* App shell + safe runtime caching. Bump VERSION after changing precache list or logic. */
const VERSION = 5;
const SHELL_CACHE  = `ppl-shell-v${VERSION}`;
const ASSETS_CACHE = `ppl-assets-v${VERSION}`;
const TILE_CACHE   = `ppl-tiles-v1`;   // intentionally separate — survives app updates
const MAX_TILE_ENTRIES = 2000;          // ~30 MB at ~15 KB/tile — safe for mobile

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.ico",
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
            // Keep tile cache across app version bumps — tiles never go stale
            if (key === SHELL_CACHE || key === ASSETS_CACHE || key === TILE_CACHE) return undefined;
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

// ─── Map tile hosts — cache-first, survive app updates ───────────────────────
const TILE_HOSTS = [
  "basemaps.cartocdn.com",
  "cartodb-basemaps-a.global.ssl.fastly.net",
  "cartodb-basemaps-b.global.ssl.fastly.net",
  "cartodb-basemaps-c.global.ssl.fastly.net",
  "cartodb-basemaps-d.global.ssl.fastly.net",
  "tile.openstreetmap.org",
  "a.tile.openstreetmap.org",
  "b.tile.openstreetmap.org",
  "c.tile.openstreetmap.org",
];

async function cacheFirstTile(request) {
  const cache = await caches.open(TILE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      // Evict oldest entries if we're over the limit (LRU-lite)
      const keys = await cache.keys();
      if (keys.length >= MAX_TILE_ENTRIES) {
        await Promise.all(keys.slice(0, 100).map((k) => cache.delete(k)));
      }
      cache.put(request, response.clone()); // fire-and-forget
    }
    return response;
  } catch {
    return new Response("", { status: 503, statusText: "Tile unavailable offline" });
  }
}
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Intercept map tile requests regardless of origin — cache-first
  const url = new URL(request.url);
  if (TILE_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirstTile(request));
    return;
  }

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
