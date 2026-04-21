/* App shell + safe runtime caching. Bump VERSION after changing precache list or logic. */
const VERSION = 6;
const SHELL_CACHE  = `ppl-shell-v${VERSION}`;
const ASSETS_CACHE = `ppl-assets-v${VERSION}`;
const TILE_CACHE   = "ppl-tiles-v1";   // intentionally separate — survives app updates
const MAX_TILE_ENTRIES = 3000;          // ~45 MB at ~15 KB/tile — safe for mobile

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

// ─── Starter city tile prefetch ───────────────────────────────────────────────
// Primary city prefetch (New Haven). Keeping this focused makes first-load
// much faster while still eliminating the black-map flash in the default view.
const PREFETCH_CITIES = [
  { lat: 41.3083,  lng: -72.9279,  zoom: 14 }, // Downtown New Haven
];

// Generous grid: 9 wide × 14 tall covers any phone in portrait or landscape,
// including Leaflet's keepBuffer=4 pre-fetch zone.
const DX = 4;        // ±4 tiles horizontally  → 9 wide
const DY_UP   = 5;   // 5 tiles above center
const DY_DOWN = 8;   // 8 tiles below (phones are tall)

const CARTO_SUBS = ["a", "b", "c", "d"];

function lngToTileX(lng, z) {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, z));
}
function latToTileY(lat, z) {
  const r = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z)
  );
}

function buildTileUrls() {
  const urls = [];
  for (const city of PREFETCH_CITIES) {
    const cx = lngToTileX(city.lng, city.zoom);
    const cy = latToTileY(city.lat, city.zoom);
    for (let dx = -DX; dx <= DX; dx++) {
      for (let dy = -DY_UP; dy <= DY_DOWN; dy++) {
        const x = cx + dx;
        const y = cy + dy;
        const s = CARTO_SUBS[(Math.abs(x) + Math.abs(y)) % 4];
        // Both 1× and @2x so retina and non-retina devices are covered
        urls.push(`https://${s}.basemaps.cartocdn.com/dark_all/${city.zoom}/${x}/${y}.png`);
        urls.push(`https://${s}.basemaps.cartocdn.com/dark_all/${city.zoom}/${x}/${y}@2x.png`);
      }
    }
  }
  return urls;
}

// Fire-and-forget — does NOT block install or activate.
// Batches 8 concurrent fetches to stay polite on the network.
async function prefetchStarterCityTiles() {
  const cache = await caches.open(TILE_CACHE);
  const existingKeys = new Set((await cache.keys()).map((r) => r.url));
  const urls = buildTileUrls().filter((u) => !existingKeys.has(u));
  if (urls.length === 0) return; // all already cached

  const BATCH = 8;
  for (let i = 0; i < urls.length; i += BATCH) {
    await Promise.allSettled(
      urls.slice(i, i + BATCH).map(async (url) => {
        try {
          const response = await fetch(url);
          if (response && response.ok) {
            await cache.put(url, response);
          }
        } catch {
          // Network unavailable — skip, will be cached on next live fetch
        }
      })
    );
  }
}
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      await Promise.all(PRECACHE_URLS.map((url) => cache.add(url).catch(() => {})));
      await self.skipWaiting();
      // Kick off tile prefetch without blocking install — runs concurrently
      prefetchStarterCityTiles();
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
  // Also kick off prefetch on activate in case install missed it
  prefetchStarterCityTiles();
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
        await Promise.all(keys.slice(0, 200).map((k) => cache.delete(k)));
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
  if (TILE_HOSTS.some((host) => url.hostname.includes(host))) {
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
