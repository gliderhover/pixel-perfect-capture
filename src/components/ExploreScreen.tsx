import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Scan, ChevronRight, ZoomIn, ZoomOut, Crosshair } from "lucide-react";
import { mockZones, mockPlayerMarkers, zoneIcons, getPlayerById } from "@/data/mockData";
import type { MapZone, Player } from "@/data/mockData";
import { useGameProgress } from "@/context/GameProgressContext";
import {
  fetchNearbyFootballPlaces,
  fetchNearbyLocalTalents,
  fetchZoneFlavor,
  fetchZones,
  type ApiLocalTalentEncounter,
  type ApiNearbyPlace,
  type ApiZone,
} from "@/lib/apiService";
import "leaflet/dist/leaflet.css";

// Lazy-load heavy interaction screens — only fetched when the user actually triggers them
const PlayerEncounter = lazy(() => import("./PlayerEncounter"));
const CameraMission   = lazy(() => import("./CameraMission"));
const ZoneExperience  = lazy(() => import("./ZoneExperience"));

// Fix default marker icon issue in webpack/vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const ZONE_HIGH_VALUE = new Set(["stadium", "rival", "pressure"]);

const createZoneIcon = (type: string) => {
  const emoji = zoneIcons[type] || "📍";
  const big = ZONE_HIGH_VALUE.has(type);
  const size = big ? 64 : 52;
  const glowColor =
    type === "stadium" ? "rgba(250,204,21,0.55)" :
    type === "rival"   ? "rgba(239,68,68,0.55)" :
    type === "pressure"? "rgba(168,85,247,0.55)" :
    type === "training"? "rgba(34,197,94,0.4)" :
    type === "recovery"? "rgba(56,189,248,0.4)" :
    type === "fan-arena"? "rgba(251,146,60,0.4)" :
    "rgba(148,163,184,0.3)";
  const pulseAnim = big ? `animation:zone-pulse 2s ease-in-out infinite;` : "";
  return L.divIcon({
    className: "custom-zone-marker",
    html: `
      <style>
        @keyframes zone-pulse{0%,100%{box-shadow:0 0 0 0 ${glowColor},0 2px 8px rgba(0,0,0,0.35)}50%{box-shadow:0 0 0 8px rgba(0,0,0,0),0 2px 12px rgba(0,0,0,0.4)}}
      </style>
      <div class="zone-marker-inner zone-type-${type}" style="width:${size}px;height:${size}px;font-size:${big ? 28 : 22}px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(11,16,32,0.82);border:2px solid ${glowColor};box-shadow:0 0 12px ${glowColor},0 2px 8px rgba(0,0,0,0.35);${pulseAnim}backdrop-filter:blur(4px);">
        <span style="line-height:1;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.6))">${emoji}</span>
        ${big ? `<span style="position:absolute;top:-6px;right:-6px;background:${glowColor.replace("0.55","1").replace("0.4","1")};color:#000;font-size:8px;font-weight:900;padding:2px 5px;border-radius:999px;line-height:1.4;letter-spacing:0.05em">${type === "stadium" ? "LIVE" : type === "rival" ? "PVP" : "HOT"}</span>` : ""}
      </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const rarityRingColor: Record<string, string> = {
  common: "rgba(148,163,184,0.65)",
  rare: "rgba(59,130,246,0.75)",
  epic: "rgba(168,85,247,0.8)",
  legendary: "rgba(245,158,11,0.88)",
};

const createPlayerMarkerIcon = (
  portrait: string,
  rarity: string = "common",
  options?: { expiring?: boolean; leavingSoon?: boolean; remainingSec?: number },
  name: string = "??"
) => {
  const safe = portrait.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const ring = rarityRingColor[rarity] ?? rarityRingColor.common;
  const opacity = options?.expiring ? 0.32 : 1;
  const pulse = options?.leavingSoon ? "0 0 20px rgba(248,113,113,0.9)" : `0 0 12px ${ring}`;
  const timerBadge =
    options?.remainingSec !== undefined
      ? `<span style="position:absolute;right:-4px;bottom:-4px;min-width:16px;height:16px;border-radius:9999px;background:rgba(15,23,42,0.92);color:#f8fafc;border:1px solid rgba(226,232,240,0.45);font-size:9px;line-height:16px;text-align:center;font-weight:700;padding:0 3px;">${Math.max(0, options.remainingSec)}</span>`
      : "";
  const fallbackBg = ({ legendary: "rgba(245,158,11,0.45)", epic: "rgba(168,85,247,0.45)", rare: "rgba(59,130,246,0.45)", common: "rgba(148,163,184,0.35)" } as Record<string, string>)[rarity] ?? "rgba(148,163,184,0.35)";
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((w) => (w[0] ?? '').toUpperCase()).join('');
  return L.divIcon({
    className: "custom-player-marker",
    html: `<div style="position:relative;opacity:${opacity};transition:opacity 260ms ease;">
      <div class="player-marker-face" style="border-color:${ring}; box-shadow:${pulse};position:relative;overflow:hidden;"><img src="${safe}" alt="" loading="eager" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none';var fb=this.nextElementSibling;if(fb)fb.style.display='flex';" /><div style="display:none;position:absolute;inset:0;border-radius:50%;background:${fallbackBg};align-items:center;justify-content:center;font-size:11px;font-weight:900;color:white;letter-spacing:0.05em;">${initials}</div></div>
      ${timerBadge}
    </div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
};

const createUserLocationIcon = () =>
  L.divIcon({
    className: "custom-player-marker",
    html: `<div style="position:relative;width:18px;height:18px;">
      <span style="position:absolute;inset:-9px;border-radius:9999px;background:rgba(22,163,74,0.28);animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></span>
      <span style="position:absolute;inset:0;border-radius:9999px;background:rgb(34,197,94);border:2px solid rgba(255,255,255,0.95);box-shadow:0 0 0 2px rgba(34,197,94,0.25);"></span>
    </div>
    <style>@keyframes ping{75%,100%{transform:scale(1.9);opacity:0}}</style>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

// ─── Icon caches ─────────────────────────────────────────────────────────────
// Zone icons only depend on `type` — build each once and reuse.
const _zoneIconCache = new Map<string, L.DivIcon>();
const getZoneIcon = (type: string): L.DivIcon => {
  if (!_zoneIconCache.has(type)) _zoneIconCache.set(type, createZoneIcon(type));
  return _zoneIconCache.get(type)!;
};

// User-location icon never changes — create once at module load.
const USER_LOCATION_ICON = createUserLocationIcon();

// Player marker icons are keyed by all the values that affect their visual output.
// This prevents the 1s countdown tick from rebuilding every icon on the map.
const _playerIconCache = new Map<string, L.DivIcon>();
const getPlayerIcon = (
  portrait: string,
  rarity: string,
  options?: { expiring?: boolean; leavingSoon?: boolean; remainingSec?: number },
  name: string = "??"
): L.DivIcon => {
  const secKey = options?.remainingSec != null ? String(options.remainingSec) : "-";
  const key = `${portrait}|${rarity}|${options?.expiring ? 1 : 0}|${options?.leavingSoon ? 1 : 0}|${secKey}|${name}`;
  if (!_playerIconCache.has(key)) {
    // Cap cache size to avoid unbounded growth over a long session
    if (_playerIconCache.size > 400) {
      const oldest = _playerIconCache.keys().next().value;
      if (oldest) _playerIconCache.delete(oldest);
    }
    _playerIconCache.set(key, createPlayerMarkerIcon(portrait, rarity, options, name));
  }
  return _playerIconCache.get(key)!;
};
// ─────────────────────────────────────────────────────────────────────────────

const NA_MAX_BOUNDS: [[number, number], [number, number]] = [[14, -170], [72, -50]];

// ─── Starter city presets (2026 World Cup host cities) ───────────────────────
// Shown before the user sets their own location so the map renders immediately
// at street level with a real neighbourhood instead of a blank continent view.
// Tiles are cached by the browser after the first visit — subsequent opens are instant.
const STARTER_CITIES = [
  { label: "Manhattan, New York",   lat: 40.7549,  lng: -73.9840,  zoom: 14 },
  { label: "Downtown Los Angeles",  lat: 34.0522,  lng: -118.2437, zoom: 14 },
  { label: "Mexico City Centro",    lat: 19.4326,  lng: -99.1332,  zoom: 14 },
  { label: "Downtown Toronto",      lat: 43.6532,  lng: -79.3832,  zoom: 14 },
  { label: "South Beach, Miami",    lat: 25.7617,  lng: -80.1918,  zoom: 14 },
] as const;

// Stable for the whole session; rotates to a new city on each fresh app open.
const _storedCityIdx = (() => {
  try {
    const stored = sessionStorage.getItem("ppl-starter-city-idx");
    if (stored !== null) return parseInt(stored, 10) % STARTER_CITIES.length;
    const idx = Math.floor(Math.random() * STARTER_CITIES.length);
    sessionStorage.setItem("ppl-starter-city-idx", String(idx));
    return idx;
  } catch { return 0; }
})();
const STARTER_CITY = STARTER_CITIES[_storedCityIdx]!;
const NA_FALLBACK_CENTER: [number, number] = [STARTER_CITY.lat, STARTER_CITY.lng];

// ─── Tile preloading ──────────────────────────────────────────────────────────
// Warm the browser HTTP cache with the tiles Leaflet will ask for, so the map
// renders without black areas on first load.  Runs once at module init (not per
// render) so it never blocks the UI thread.
const _lngToTileX = (lng: number, z: number) =>
  Math.floor(((lng + 180) / 360) * Math.pow(2, z));
const _latToTileY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z)
  );
};
const _CARTO_SUBS = ["a", "b", "c", "d"] as const;
const _preloadCityTiles = (city: typeof STARTER_CITY) => {
  // Use fetch() so requests are guaranteed to pass through the Service Worker
  // and get written into the tile cache immediately — no race with Leaflet.
  // Runs synchronously at module init; promises are fire-and-forget.
  const cx = _lngToTileX(city.lng, city.zoom);
  const cy = _latToTileY(city.lat, city.zoom);
  for (let dx = -4; dx <= 4; dx++) {
    for (let dy = -5; dy <= 8; dy++) {
      const x = cx + dx;
      const y = cy + dy;
      const s = _CARTO_SUBS[(Math.abs(x) + Math.abs(y)) % 4];
      for (const retina of ["", "@2x"]) {
        const url = `https://${s}.basemaps.cartocdn.com/dark_all/${city.zoom}/${x}/${y}${retina}.png`;
        fetch(url).catch(() => {/* SW will cache on success; silently ignore network errors */});
      }
    }
  }
};
_preloadCityTiles(STARTER_CITY);
// ─────────────────────────────────────────────────────────────────────────────

const distanceKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const dx = (a.lng - b.lng) * 111 * Math.cos(((a.lat + b.lat) * 0.5 * Math.PI) / 180);
  const dy = (a.lat - b.lat) * 111;
  return Math.sqrt(dx * dx + dy * dy);
};

const mapZoneFromNearbyPlace = (place: ApiNearbyPlace): MapZone => ({
  id: `nearby-${place.id}`,
  type: place.mappedZoneType,
  name: place.name,
  lat: place.lat,
  lng: place.lng,
  benefit: place.mappedZoneLabel,
});

const spawnLimitByZoom = (zoom: number) => {
  if (zoom <= 6) return 10;
  if (zoom <= 8) return 14;
  if (zoom <= 10) return 20;
  if (zoom <= 12) return 26;
  if (zoom <= 14) return 32;
  return 38;
};

const visibleEncounterCapByZoom = (zoom: number) => {
  if (zoom <= 7) return 8;
  if (zoom <= 9) return 12;
  if (zoom <= 11) return 18;
  if (zoom <= 13) return 24;
  return 34;
};

const spawnRadiusByZoom = (zoom: number) => {
  if (zoom <= 7) return 7.5;
  if (zoom <= 10) return 5.5;
  if (zoom <= 13) return 4.2;
  return 3.2;
};

const LOCAL_TALENT_RUNTIME_CONFIG = {
  defaultLifetimeMs: 60_000,   // 60 s base — players stick around long enough to actually recruit
  respawnIntervalMs: 90_000,   // new wave every 90 s so the map doesn't feel empty right away
  countdownTickMs: 1_000,
  despawnFadeMs: 350,
  leavingSoonMs: 8_000,        // "leaving soon" warning in last 8 s
  freezeExpiryWhenActiveEncounter: true,
  maxNearbyByZoom: spawnLimitByZoom,
  distanceFromUserByZoomKm: spawnRadiusByZoom,
};

const MapControls = ({
  onLocationResolved,
  onLocationDenied,
  onLocationUnavailable,
  onLocatingChange,
}: {
  onLocationResolved: (lat: number, lng: number) => void;
  onLocationDenied: () => void;
  onLocationUnavailable: (message: string) => void;
  onLocatingChange: (locating: boolean) => void;
}) => {
  const map = useMap();
  return (
    <div className="absolute z-[1210] flex flex-col gap-1.5" style={{ bottom: "calc(var(--explore-fab-bottom, 80px) + 64px)", right: "calc(env(safe-area-inset-right, 0px) + 12px)" }}>
      <button
        type="button"
        onClick={() => map.zoomIn()}
        className="w-9 h-9 rounded-xl glass-card-strong flex items-center justify-center active:scale-90 transition-transform"
      >
        <ZoomIn className="w-4 h-4 text-foreground" />
      </button>
      <button
        type="button"
        onClick={() => map.zoomOut()}
        className="w-9 h-9 rounded-xl glass-card-strong flex items-center justify-center active:scale-90 transition-transform"
      >
        <ZoomOut className="w-4 h-4 text-foreground" />
      </button>
      <button
        type="button"
        onClick={() => {
          if (!navigator.geolocation) {
            onLocationUnavailable("Location services are unavailable on this device.");
            return;
          }
          onLocatingChange(true);
          navigator.geolocation?.getCurrentPosition(
            (pos) => {
              onLocatingChange(false);
              const { latitude: lat, longitude: lng } = pos.coords;
              onLocationResolved(lat, lng);
              map.flyTo([lat, lng], 15, { duration: 1.1 });
            },
            (error) => {
              onLocatingChange(false);
              if (error.code === 1) {
                onLocationDenied();
              } else if (error.code === 2) {
                onLocationUnavailable("Couldn't detect your location right now. Try again in open sky.");
              } else {
                onLocationUnavailable("Location request timed out. Try again.");
              }
              map.flyTo(NA_FALLBACK_CENTER, STARTER_CITY.zoom, { duration: 1.2 });
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 }
          );
        }}
        className="h-10 min-w-[7rem] rounded-xl glass-card-strong px-2.5 flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
      >
        <Crosshair className="w-4 h-4 text-foreground" />
        <span className="text-[10px] font-bold text-foreground">My location</span>
      </button>
    </div>
  );
};

const MapViewWatcher = ({
  onViewChanged,
}: {
  onViewChanged: (lat: number, lng: number, zoom: number) => void;
}) => {
  const map = useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      onViewChanged(center.lat, center.lng, map.getZoom());
    },
    zoomend: () => {
      const center = map.getCenter();
      onViewChanged(center.lat, center.lng, map.getZoom());
    },
  });

  useEffect(() => {
    const center = map.getCenter();
    onViewChanged(center.lat, center.lng, map.getZoom());
  }, [map, onViewChanged]);

  return null;
};

type SelectedPlace = ApiNearbyPlace | null;
type LocalTalentRuntime = ApiLocalTalentEncounter & {
  remainingMs: number;
  isExpiring: boolean;
  revealedAt: number; // epoch ms — marker is hidden until this time (staggered appearance)
};

// Fires as soon as the Leaflet map instance is initialised — does NOT wait
// for tiles to finish loading (which can hang forever on slow connections).
// Also forces invalidateSize() after layout settles to fix iOS dvh quirks
// where the URL bar hide/show causes the map to stop requesting tiles for
// the bottom of the viewport (this is THE root cause of the "black tiles" bug).
const MapReadyWatcher = ({ onReady }: { onReady: () => void }) => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    onReady();
    // Repeated invalidateSize() catches every iOS viewport jitter:
    // immediate (0ms), after first paint (100ms), after URL-bar settle (600ms),
    // after orientation/resize finishes (1500ms).
    const timers = [0, 100, 600, 1500].map((ms) =>
      setTimeout(() => map.invalidateSize({ animate: false, pan: false }), ms)
    );
    // Also re-invalidate when the page becomes visible again (PWA tab switch)
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        map.invalidateSize({ animate: false, pan: false });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      timers.forEach(clearTimeout);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  return null;
};

const ExploreScreen = () => {
  const { playersById, setExplorationZoneType } = useGameProgress();
  const [mapReady, setMapReady] = useState(false);
  const [zones, setZones] = useState<MapZone[]>(mockZones);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [zonesError, setZonesError] = useState<string | null>(null);
  const [usingMockZones, setUsingMockZones] = useState(true);
  const [selectedZone, setSelectedZone] = useState<MapZone | null>(null);
  const [encounterPlayer, setEncounterPlayer] = useState<Player | null>(null);
  const [scanning, setScanning] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [activeZone, setActiveZone] = useState<MapZone | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace>(null);
  const [zoneFlavorText, setZoneFlavorText] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [localTalents, setLocalTalents] = useState<LocalTalentRuntime[]>([]);
  const [talentsLoading, setTalentsLoading] = useState(false);
  const [scoutProgress, setScoutProgress] = useState(0);   // 0-100 – drives the loading bar
  const [scoutDone, setScoutDone] = useState(false);       // true for ~1.5 s after fetch lands
  const scoutTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const wasScoutingRef = useRef(false);
  const mapSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleCompletedRef = useRef(false);
  const [nearbyPlaces, setNearbyPlaces] = useState<ApiNearbyPlace[]>([]);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState(5);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [spawnSeedKey, setSpawnSeedKey] = useState(
    () => String(Math.floor(Date.now() / LOCAL_TALENT_RUNTIME_CONFIG.respawnIntervalMs))
  );
  const lastCoordsRefreshRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastDiscoveryFetchRef = useRef(0);
  const [activeLocalEncounterId, setActiveLocalEncounterId] = useState<string | null>(null);

  const handleMapReady = useCallback(() => setMapReady(true), []);

  // Drive the scouting progress bar: 0 → ~85% during fetch, snap 100% on completion
  useEffect(() => {
    const clearAll = () => { scoutTimersRef.current.forEach(clearTimeout); scoutTimersRef.current = []; };
    if (talentsLoading) {
      wasScoutingRef.current = true;
      setScoutDone(false);
      setScoutProgress(0);
      clearAll();
      // Staged milestones — keeps crawling so bar never freezes visibly
      scoutTimersRef.current = [
        setTimeout(() => setScoutProgress(15),  60),
        setTimeout(() => setScoutProgress(42),  420),
        setTimeout(() => setScoutProgress(68),  900),
        setTimeout(() => setScoutProgress(82), 1600),
        setTimeout(() => setScoutProgress(89), 2600),
        setTimeout(() => setScoutProgress(94), 3800),
        setTimeout(() => setScoutProgress(97), 5500),
      ];
      return clearAll;
    } else if (wasScoutingRef.current && !settleCompletedRef.current) {
      // API finished before map-settle timer — fill to 100 then briefly show "done" state
      wasScoutingRef.current = false;
      clearAll();
      setScoutProgress(100);
      setScoutDone(true);
      scoutTimersRef.current = [
        setTimeout(() => { setScoutDone(false); setScoutProgress(0); }, 1600),
      ];
      return clearAll;
    }
  }, [talentsLoading]);

  // Complete scouting bar ~1.5 s after user location is set — don't block on API latency
  useEffect(() => {
    if (!userCoords) return;
    settleCompletedRef.current = false;
    if (mapSettleTimerRef.current) clearTimeout(mapSettleTimerRef.current);
    mapSettleTimerRef.current = setTimeout(() => {
      settleCompletedRef.current = true;
      wasScoutingRef.current = false;
      scoutTimersRef.current.forEach(clearTimeout);
      scoutTimersRef.current = [];
      setScoutProgress(100);
      setScoutDone(true);
      const t = setTimeout(() => { setScoutDone(false); setScoutProgress(0); }, 1600);
      scoutTimersRef.current = [t];
    }, 1500);
    return () => {
      if (mapSettleTimerRef.current) clearTimeout(mapSettleTimerRef.current);
    };
  }, [userCoords]);

  // Hard fallback: if Leaflet somehow doesn't mount within 3 s, unblock UI
  useEffect(() => {
    const t = setTimeout(() => setMapReady(true), 3000);
    return () => clearTimeout(t);
  }, []);

  const handleScan = () => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      setShowCamera(true);
    }, 800);
  };

  const handleMapViewChanged = useCallback((lat: number, lng: number, zoom: number) => {
    setMapCenter({ lat, lng });
    setMapZoom(zoom);
  }, []);

  const visibleLocalTalents = useMemo(() => {
    const cap = visibleEncounterCapByZoom(mapZoom);
    const now = Date.now();
    return [...localTalents]
      .filter((t) => (t.revealedAt ?? 0) <= now) // hide until stagger delay elapses
      .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
      .slice(0, cap);
  }, [localTalents, mapZoom]);

  const activeLocalEncounter = useMemo(
    () => localTalents.find((t) => t.id === activeLocalEncounterId) ?? null,
    [localTalents, activeLocalEncounterId]
  );

  const nearestEncounterPlayer = useMemo(() => {
    if (visibleLocalTalents.length > 0) {
      const t = visibleLocalTalents[0];
      return playersById[t.basePlayerId] ?? getPlayerById(t.basePlayerId) ?? null;
    }
    const pm = mockPlayerMarkers[Math.floor(Math.random() * Math.min(mockPlayerMarkers.length, 10))];
    return playersById[pm.playerId] ?? getPlayerById(pm.playerId) ?? null;
  }, [visibleLocalTalents, playersById]);

  const handleEncounterFlowEnd = useCallback(
    (result: "recruited" | "escaped" | "closed") => {
      const activeId = activeLocalEncounterId;
      if (activeId) {
        setLocalTalents((prev) => {
          const updated = prev
            .map((item) => {
              if (item.id !== activeId) return item;
              if (result === "recruited") return null;
              return {
                ...item,
                isExpiring: false,
                expiresAt: new Date(Date.now() + Math.max(item.remainingMs, 0)).toISOString(),
              };
            })
            .filter((item): item is LocalTalentRuntime => Boolean(item));
          return updated;
        });
        if (result === "recruited") {
          setLocationNotice("Recruit secured before the encounter expired.");
        }
      }
      setActiveLocalEncounterId(null);
      setEncounterPlayer(null);
    },
    [activeLocalEncounterId]
  );

  useEffect(() => {
    setExplorationZoneType(activeZone?.type ?? selectedZone?.type ?? selectedPlace?.mappedZoneType ?? null);
  }, [activeZone, selectedZone, selectedPlace, setExplorationZoneType]);

  useEffect(() => {
    let cancelled = false;
    const loadFlavor = async () => {
      const type = selectedZone?.type ?? selectedPlace?.mappedZoneType;
      const name = selectedZone?.name ?? selectedPlace?.name;
      if (!type || !name) {
        setZoneFlavorText(null);
        return;
      }
      try {
        const result = await fetchZoneFlavor(type, name);
        if (!cancelled) setZoneFlavorText(result.flavor);
      } catch {
        if (!cancelled) setZoneFlavorText(null);
      }
    };
    void loadFlavor();
    return () => {
      cancelled = true;
    };
  }, [selectedZone, selectedPlace]);

  useEffect(() => {
    let cancelled = false;
    const loadNearbyDiscovery = async () => {
      if (!userCoords) return;
      const now = Date.now();
      if (now - lastDiscoveryFetchRef.current < 6000) return;
      lastDiscoveryFetchRef.current = now;
      setDiscoveryError(null);
      setTalentsLoading(true);
      try {
        const radiusKm = LOCAL_TALENT_RUNTIME_CONFIG.distanceFromUserByZoomKm(mapZoom);
        const spawnLimit = LOCAL_TALENT_RUNTIME_CONFIG.maxNearbyByZoom(mapZoom);
        const [talentResult, placesResult] = await Promise.all([
          fetchNearbyLocalTalents(userCoords.lat, userCoords.lng, {
            radiusKm,
            zoom: Math.round(mapZoom),
            limit: spawnLimit,
            seedKey: spawnSeedKey,
          }),
          fetchNearbyFootballPlaces(userCoords.lat, userCoords.lng, Math.max(4, Math.min(8, radiusKm + 1))),
        ]);
        if (cancelled) return;
        setLocalTalents((prev) => {
          const prevById = new Map(prev.map((item) => [item.id, item]));
          const ts = Date.now();
          // Shuffle incoming so stagger order isn't always distance-sorted
          const shuffled = [...talentResult.data].sort(() => Math.random() - 0.5);
          const merged = shuffled.map((item, idx) => {
            const existing = prevById.get(item.id);
            const computedRemaining = Math.max(0, new Date(item.expiresAt).getTime() - ts);
            if (existing) {
              return {
                ...item,
                remainingMs: existing.remainingMs,
                isExpiring: existing.isExpiring,
                revealedAt: existing.revealedAt,
                expiresAt: new Date(ts + existing.remainingMs).toISOString(),
              };
            }
            // Brand-new talent: stagger reveal (600 ms between each one) and
            // add a random ±20 s jitter to lifetime so they don't all expire together.
            const baseRemaining = computedRemaining || item.remainingMs || item.lifetimeMs || LOCAL_TALENT_RUNTIME_CONFIG.defaultLifetimeMs;
            const jitter = Math.random() * 20_000; // 0–20 s extra
            return {
              ...item,
              remainingMs: baseRemaining + jitter,
              isExpiring: false,
              revealedAt: ts + idx * 600, // appear one-by-one, 600 ms apart
            };
          });
          if (activeLocalEncounterId && !merged.some((item) => item.id === activeLocalEncounterId)) {
            const activeExisting = prevById.get(activeLocalEncounterId);
            if (activeExisting) merged.push(activeExisting);
          }
          return merged;
        });
        setNearbyPlaces(placesResult.data);
      } catch (error) {
        if (!cancelled) {
          setDiscoveryError(error instanceof Error ? error.message : "Nearby discovery unavailable");
          setLocalTalents([]);
          setNearbyPlaces([]);
        }
      } finally {
        if (!cancelled) setTalentsLoading(false);
      }
    };
    void loadNearbyDiscovery();
    return () => {
      cancelled = true;
    };
  }, [userCoords, mapZoom, mapCenter, spawnSeedKey, activeLocalEncounterId]);

  useEffect(() => {
    if (!userCoords) return;
    const interval = window.setInterval(() => {
      setSpawnSeedKey(String(Math.floor(Date.now() / LOCAL_TALENT_RUNTIME_CONFIG.respawnIntervalMs)));
    }, LOCAL_TALENT_RUNTIME_CONFIG.respawnIntervalMs);
    return () => window.clearInterval(interval);
  }, [userCoords]);

  useEffect(() => {
    if (!userCoords || !navigator.geolocation) return;
    lastCoordsRefreshRef.current = userCoords;
    const interval = window.setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const latest = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          const previous = lastCoordsRefreshRef.current;
          if (!previous || distanceKm(previous, latest) >= 0.18) {
            lastCoordsRefreshRef.current = latest;
            setUserCoords(latest);
            setLocationNotice("Nearby encounters refreshed from your latest position.");
          }
        },
        () => {},
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    }, 30000);
    return () => window.clearInterval(interval);
  }, [userCoords]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      const now = Date.now();
      setLocalTalents((prev) =>
        prev
          .map((talent) => {
            const isActive =
              LOCAL_TALENT_RUNTIME_CONFIG.freezeExpiryWhenActiveEncounter &&
              activeLocalEncounterId === talent.id;
            if (isActive) {
              return { ...talent, isExpiring: false };
            }

            const remainingMs = Math.max(0, new Date(talent.expiresAt).getTime() - now);
            if (remainingMs <= 0) {
              if (talent.isExpiring) {
                return {
                  ...talent,
                  remainingMs: 0,
                };
              }
              return {
                ...talent,
                remainingMs: 0,
                isExpiring: true,
                expiresAt: new Date(now + LOCAL_TALENT_RUNTIME_CONFIG.despawnFadeMs).toISOString(),
              };
            }

            return {
              ...talent,
              remainingMs,
              isExpiring: false,
            };
          })
          .filter((talent) => {
            if (!talent.isExpiring) return true;
            return new Date(talent.expiresAt).getTime() > now;
          })
      );
    }, LOCAL_TALENT_RUNTIME_CONFIG.countdownTickMs);
    return () => window.clearInterval(tick);
  }, [activeLocalEncounterId]);

  useEffect(() => {
    let cancelled = false;
    const mapZoneFromApi = (z: ApiZone, i: number): MapZone => ({
      id: `api-zone-${i}-${z.zoneType}-${z.name}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
      type: z.zoneType,
      name: z.name,
      lat: z.latitude,
      lng: z.longitude,
      benefit: z.rewardType,
    });
    const loadZones = async () => {
      setZonesLoading(true);
      setZonesError(null);
      try {
        const result = await fetchZones();
        if (!cancelled) {
          if (result.data.length > 0) {
            setZones(result.data.map(mapZoneFromApi));
            setUsingMockZones(false);
          } else {
            setZones([]);
            setUsingMockZones(false);
          }
        }
      } catch (error) {
        if (!cancelled) {
          const msg = error instanceof Error ? error.message : "Failed to load zones";
          setZonesError(msg);
          setZones(mockZones);
          setUsingMockZones(true);
        }
      } finally {
        if (!cancelled) setZonesLoading(false);
      }
    };
    loadZones();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative w-full min-h-[100dvh] h-[100dvh] overflow-hidden">
      {/* Real Leaflet Map — North America default; pan/zoom still real */}
      <MapContainer
        center={NA_FALLBACK_CENTER}
        zoom={STARTER_CITY.zoom}
        minZoom={4}
        maxZoom={18}
        maxBounds={NA_MAX_BOUNDS}
        maxBoundsViscosity={0.85}
        className="w-full h-full z-0"
        zoomControl={false}
        attributionControl={false}
        // Disable Leaflet's mobile tap shim — it intercepts touch events and
        // sends them to the map drag handler instead of the marker, causing
        // "tap moves the map instead of opening the player" on iOS.
        tap={false}
        style={{
          // City-grid placeholder shown while tiles load — better than solid black
          background: `
            repeating-linear-gradient(rgba(255,255,255,0.018) 0px, rgba(255,255,255,0.018) 1px, transparent 1px, transparent 52px),
            repeating-linear-gradient(90deg, rgba(255,255,255,0.018) 0px, rgba(255,255,255,0.018) 1px, transparent 1px, transparent 52px),
            hsl(225 30% 5%)
          `,
        }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution=""
          updateWhenZooming={false}
          updateWhenIdle={true}
          keepBuffer={4}
        />
        <MapControls
          onLocationResolved={(lat, lng) => {
            setUserCoords({ lat, lng });
            lastCoordsRefreshRef.current = { lat, lng };
            setSpawnSeedKey(String(Math.floor(Date.now() / LOCAL_TALENT_RUNTIME_CONFIG.respawnIntervalMs)));
            setLocationNotice("Centered on your current location.");
          }}
          onLocationDenied={() => {
            setLocationNotice("Location permission denied. You can still explore default zones.");
          }}
          onLocationUnavailable={(message) => {
            setLocationNotice(message);
          }}
          onLocatingChange={setLocating}
        />
        <MapViewWatcher onViewChanged={handleMapViewChanged} />
        <MapReadyWatcher onReady={handleMapReady} />

        {/* Real current-location marker */}
        {userCoords && (
          <Marker
            position={[userCoords.lat, userCoords.lng]}
            icon={USER_LOCATION_ICON}
            zIndexOffset={900}
          />
        )}

        {/* Zone markers */}
        {zones.map((zone) => (
          <Marker
            key={zone.id}
            position={[zone.lat, zone.lng]}
            icon={getZoneIcon(zone.type)}
            zIndexOffset={500}
            bubblingMouseEvents={false}
            eventHandlers={{
              click: (e) => {
                // Stop Leaflet from propagating to the map (prevents accidental pan on mobile)
                e.originalEvent?.stopPropagation();
                setSelectedZone(zone);
                setSelectedPlace(null);
                setEncounterPlayer(null);
                setActiveLocalEncounterId(null);
              },
            }}
          />
        ))}

        {/* Player encounter markers */}
        {mockPlayerMarkers.map((pm) => {
          const player = playersById[pm.playerId] ?? getPlayerById(pm.playerId);
          if (!player) return null;
          return (
            <Marker
              key={pm.id}
              position={[pm.lat, pm.lng]}
              icon={getPlayerIcon(player.portrait, player.rarity, undefined, player.name)}
              bubblingMouseEvents={false}
              eventHandlers={{
                click: (e) => {
                  e.originalEvent?.stopPropagation();
                  const full = playersById[pm.playerId] ?? player;
                  setActiveLocalEncounterId(null);
                  setEncounterPlayer(full);
                  setSelectedZone(null);
                  setSelectedPlace(null);
                },
              }}
            />
          );
        })}

        {/* Nearby hidden prospects */}
        {visibleLocalTalents.map((talent) => (
          <Marker
            key={talent.id}
            position={[talent.lat, talent.lng]}
            icon={getPlayerIcon(talent.portrait, talent.rarity, {
              expiring: talent.isExpiring,
              leavingSoon: talent.remainingMs <= LOCAL_TALENT_RUNTIME_CONFIG.leavingSoonMs,
              remainingSec: talent.remainingMs <= LOCAL_TALENT_RUNTIME_CONFIG.leavingSoonMs ? Math.ceil(talent.remainingMs / 1000) : undefined,
            }, talent.displayName)}
            bubblingMouseEvents={false}
            eventHandlers={{
              click: (e) => {
                e.originalEvent?.stopPropagation();
                const base = playersById[talent.basePlayerId] ?? getPlayerById(talent.basePlayerId);
                if (!base) return;
                setActiveLocalEncounterId(talent.id);
                setEncounterPlayer({
                  ...base,
                  name: talent.displayName,
                  representedCountry: talent.hometown,
                  rarity: talent.rarity === "legendary" ? "legendary" : base.rarity,
                  traits: [...base.traits.slice(0, 2), `Encounter: ${talent.encounterTier}`],
                });
                setSelectedZone(null);
                setSelectedPlace(null);
                setLocalTalents((prev) =>
                  prev.map((item) =>
                    item.id === talent.id
                      ? {
                          ...item,
                          isExpiring: false,
                        }
                      : item
                  )
                );
              },
            }}
          />
        ))}

        {/* Nearby football places */}
        {nearbyPlaces.map((place) => (
          <Marker
            key={place.id}
            position={[place.lat, place.lng]}
            icon={getZoneIcon(place.mappedZoneType)}
            bubblingMouseEvents={false}
            eventHandlers={{
              click: (e) => {
                e.originalEvent?.stopPropagation();
                setSelectedPlace(place);
                setSelectedZone(null);
                setEncounterPlayer(null);
                setActiveLocalEncounterId(null);
              },
            }}
          />
        ))}
      </MapContainer>

      {/* Starter city badge — centred over the MAP area only (right of sidebar) */}
      {mapReady && !userCoords && !locating && (
        <div
          className="absolute top-[max(16px,env(safe-area-inset-top,16px))] z-[1250] pointer-events-none flex justify-center"
          style={{
            left: "calc(env(safe-area-inset-left, 0px) + var(--game-sidebar-width, 56px))",
            right: "env(safe-area-inset-right, 0px)",
          }}
        >
          <div className="flex items-center gap-1.5 glass-card-strong px-3 py-1.5 rounded-full shadow-lg">
            <span className="text-[10px]">📍</span>
            <span className="text-[10px] font-bold text-foreground whitespace-nowrap">{STARTER_CITY.label}</span>
            <span className="text-[9px] text-muted-foreground whitespace-nowrap">· Tap ⬤ to use your location</span>
          </div>
        </div>
      )}

      {locating && (
        <div
          className="absolute top-[max(16px,env(safe-area-inset-top,16px))] z-[1250] pointer-events-none flex flex-col items-center"
          style={{
            left: "calc(env(safe-area-inset-left, 0px) + var(--game-sidebar-width, 56px))",
            right: "env(safe-area-inset-right, 0px)",
          }}
        >
          <div className="flex items-center gap-2 glass-card-strong px-4 py-2 rounded-full">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-bold text-foreground whitespace-nowrap">Finding your location…</span>
          </div>
          <div className="mt-1 h-0.5 w-full rounded-full overflow-hidden bg-muted">
            <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: "70%" }} />
          </div>
        </div>
      )}

      {/* Scouting progress bar — real animated progress, snaps to 100% on completion */}
      {mapReady && userCoords && (talentsLoading || scoutDone) && !encounterPlayer && !showCamera && !activeZone && (
        <div className="absolute left-1/2 -translate-x-1/2 z-[1250] pointer-events-none"
          style={{ bottom: "calc(var(--explore-fab-bottom, 80px) + 72px)" }}>
          <div className="glass-card-strong px-4 py-2.5 rounded-2xl min-w-[230px] shadow-lg">
            <div className="flex items-center gap-2 mb-1.5">
              {scoutDone
                ? <span className="text-[11px] shrink-0">✅</span>
                : <div className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
              }
              <p className="text-[11px] font-black text-foreground">
                {scoutDone
                  ? "Area scouted!"
                  : scoutProgress < 40
                  ? "Scanning the area…"
                  : "Finding players nearby…"}
              </p>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden bg-muted">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${scoutProgress}%`,
                  background: scoutDone
                    ? "hsl(var(--primary))"
                    : "linear-gradient(90deg, hsl(var(--primary)), hsl(153 70% 55%))",
                  transition: "width 0.55s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Nudge — only after loading + done animation finishes, and no players at all (local or mock) */}
      {mapReady && userCoords && !talentsLoading && !scoutDone && localTalents.length === 0 && mockPlayerMarkers.length === 0 && !encounterPlayer && !showCamera && !activeZone && (
        <div className="absolute left-1/2 -translate-x-1/2 z-[1250] pointer-events-none"
          style={{ bottom: "calc(var(--explore-fab-bottom, 80px) + 72px)" }}>
          <div className="flex items-center gap-2.5 glass-card-strong px-4 py-3 rounded-2xl max-w-[270px] shadow-lg">
            <span className="text-xl shrink-0">🚶</span>
            <div>
              <p className="text-[11px] font-black text-foreground leading-tight">No players spotted yet</p>
              <p className="text-[9px] text-muted-foreground leading-snug mt-0.5">
                Move towards a Stadium or Zone — or hang tight, players drift into the area every few minutes.
              </p>
            </div>
          </div>
        </div>
      )}

      {!mapReady && (
        <div className="absolute inset-0 z-[1300] bg-background flex flex-col items-center justify-center gap-4 pointer-events-none">
          <div className="text-5xl" style={{ animation: "bounce 1s infinite" }}>⚽</div>
          <p className="text-sm text-primary font-black tracking-widest uppercase" style={{ animation: "pulse 2s infinite" }}>
            Scouting the pitch…
          </p>
          <div className="h-1 w-32 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: "60%", animation: "pulse 1.5s ease-in-out infinite" }} />
          </div>
        </div>
      )}

      {/* Scan — above nav + activity strip; z above bottom nav */}
      <button
        type="button"
        onClick={handleScan}
        className="absolute left-1/2 -translate-x-1/2 z-[1240] min-h-[56px] min-w-[56px] flex items-center justify-center touch-manipulation"
        style={{ bottom: "var(--explore-fab-bottom)" }}
        aria-label="Scan for camera mission"
      >
        {scanning && (
          <>
            <div className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-primary/30 animate-scan-ripple" />
            <div className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-primary/20 animate-scan-ripple" style={{ animationDelay: "0.3s" }} />
          </>
        )}
        <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary floating-button glow-primary flex items-center justify-center active:scale-90 transition-transform ring-2 ring-background/90 ring-offset-0 shadow-[0_4px_24px_rgba(0,0,0,0.45)]">
          <Scan className={`w-7 h-7 text-primary-foreground ${scanning ? "animate-spin" : ""}`} />
        </div>
      </button>

      {/* Zone Bottom Sheet */}
      {selectedZone && !activeZone && (
        <div className="fixed inset-0 z-[1300] bg-background/40 backdrop-blur-sm" onClick={() => setSelectedZone(null)}>
          <div
            className="absolute bottom-0 left-0 right-0 p-5 rounded-t-3xl bg-background/95 backdrop-blur-xl border-t border-border/20 animate-slide-up"
            style={{ paddingBottom: "max(1.75rem, calc(env(safe-area-inset-bottom, 0px) + 1.25rem))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-4" />
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-2xl">
                {zoneIcons[selectedZone.type]}
              </div>
              <div>
                <h3 className="text-lg font-black text-foreground">{selectedZone.name}</h3>
                <p className="text-sm text-primary font-semibold">{selectedZone.benefit}</p>
                {zoneFlavorText && (
                  <p className="text-xs text-muted-foreground mt-1 max-w-[14rem]">{zoneFlavorText}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => setActiveZone(selectedZone)}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-primary text-primary-foreground font-black text-sm flex items-center justify-center gap-2 glow-primary active:scale-[0.98] transition-transform">
              Enter Zone <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Zone Experience */}
      {activeZone && (
        <Suspense fallback={null}>
          <ZoneExperience
            zone={activeZone}
            onClose={() => {
              setActiveZone(null);
              setSelectedZone(null);
              setSelectedPlace(null);
            }}
          />
        </Suspense>
      )}

      {/* Nearby Place Bottom Sheet */}
      {selectedPlace && !activeZone && (
        <div className="fixed inset-0 z-[1300] bg-background/40 backdrop-blur-sm" onClick={() => setSelectedPlace(null)}>
          <div
            className="absolute bottom-0 left-0 right-0 p-5 rounded-t-3xl bg-background/95 backdrop-blur-xl border-t border-border/20 animate-slide-up"
            style={{ paddingBottom: "max(1.75rem, calc(env(safe-area-inset-bottom, 0px) + 1.25rem))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-4" />
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-2xl">
                {zoneIcons[selectedPlace.mappedZoneType]}
              </div>
              <div>
                <h3 className="text-lg font-black text-foreground">{selectedPlace.name}</h3>
                <p className="text-sm text-primary font-semibold">{selectedPlace.mappedZoneLabel}</p>
                {zoneFlavorText && (
                  <p className="text-xs text-muted-foreground mt-1 max-w-[14rem]">{zoneFlavorText}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">{selectedPlace.distanceKm.toFixed(1)} km away</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Nearby {selectedPlace.type.replace("-", " ")} converted into a {selectedPlace.mappedZoneLabel.toLowerCase()}.
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveZone(mapZoneFromNearbyPlace(selectedPlace));
                setSelectedPlace(null);
              }}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-primary text-primary-foreground font-black text-sm flex items-center justify-center gap-2 glow-primary active:scale-[0.98] transition-transform">
              Enter Zone <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Player Encounter */}
      {encounterPlayer && (
        <Suspense fallback={null}>
          <PlayerEncounter
            player={encounterPlayer}
            encounterRemainingMs={activeLocalEncounter?.remainingMs}
            onFlowEnd={handleEncounterFlowEnd}
            onClose={() => {
              setEncounterPlayer(null);
              setActiveLocalEncounterId(null);
            }}
          />
        </Suspense>
      )}

      {/* Camera Mission */}
      {showCamera && (
        <Suspense fallback={null}>
          <CameraMission
            onClose={() => setShowCamera(false)}
            nearestPlayer={nearestEncounterPlayer}
            activeZoneName={activeZone?.name ?? selectedZone?.name ?? null}
            activeZoneType={activeZone?.type ?? selectedZone?.type ?? null}
            onChallenge={(player) => {
              setShowCamera(false);
              setEncounterPlayer(player);
            }}
          />
        </Suspense>
      )}
    </div>
  );
};

export default ExploreScreen;
