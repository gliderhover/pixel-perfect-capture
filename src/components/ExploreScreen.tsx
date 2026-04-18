import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Scan, ChevronRight, ZoomIn, ZoomOut, Crosshair } from "lucide-react";
import { mockZones, mockMission, mockPlayerMarkers, mockNearbyActivity, zoneIcons, getPlayerById } from "@/data/mockData";
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
import PlayerEncounter from "./PlayerEncounter";
import CameraMission from "./CameraMission";
import ZoneExperience from "./ZoneExperience";
import AnimatedPortrait from "./AnimatedPortrait";
import "leaflet/dist/leaflet.css";

// Fix default marker icon issue in webpack/vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const createZoneIcon = (type: string) => {
  const emoji = zoneIcons[type] || "📍";
  return L.divIcon({
    className: "custom-zone-marker",
    html: `<div class="zone-marker-inner zone-type-${type}"><span>${emoji}</span></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
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
  options?: { expiring?: boolean; leavingSoon?: boolean; remainingSec?: number }
) => {
  const safe = portrait.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const ring = rarityRingColor[rarity] ?? rarityRingColor.common;
  const opacity = options?.expiring ? 0.32 : 1;
  const pulse = options?.leavingSoon ? "0 0 20px rgba(248,113,113,0.9)" : `0 0 12px ${ring}`;
  const timerBadge =
    options?.remainingSec !== undefined
      ? `<span style="position:absolute;right:-4px;bottom:-4px;min-width:16px;height:16px;border-radius:9999px;background:rgba(15,23,42,0.92);color:#f8fafc;border:1px solid rgba(226,232,240,0.45);font-size:9px;line-height:16px;text-align:center;font-weight:700;padding:0 3px;">${Math.max(0, options.remainingSec)}</span>`
      : "";
  return L.divIcon({
    className: "custom-player-marker",
    html: `<div style="position:relative;opacity:${opacity};transition:opacity 260ms ease;">
      <div class="player-marker-face" style="border-color:${ring}; box-shadow:${pulse};"><img src="${safe}" alt="" loading="lazy" referrerpolicy="no-referrer" /></div>
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

const NA_FALLBACK_CENTER: [number, number] = [40, -98];
const WORLD_MAX_BOUNDS: [[number, number], [number, number]] = [
  [-85, -180],
  [85, 180],
];

const mapControlLeft = {
  left: "calc(env(safe-area-inset-left, 0px) + var(--game-sidebar-width, 56px) + 10px)",
} as const;

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
  defaultLifetimeMs: 10_000,
  respawnIntervalMs: 12_000,
  countdownTickMs: 1_000,
  despawnFadeMs: 350,
  leavingSoonMs: 3_000,
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
    <div className="absolute top-28 z-[1210] flex flex-col gap-1.5" style={mapControlLeft}>
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
              map.flyTo(NA_FALLBACK_CENTER, 5, { duration: 1.2 });
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
};

const ExploreScreen = () => {
  const { activePlayer, playersById, setExplorationZoneType } = useGameProgress();
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
  const [nearbyPlaces, setNearbyPlaces] = useState<ApiNearbyPlace[]>([]);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState(4);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [spawnSeedKey, setSpawnSeedKey] = useState(
    () => String(Math.floor(Date.now() / LOCAL_TALENT_RUNTIME_CONFIG.respawnIntervalMs))
  );
  const lastCoordsRefreshRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastDiscoveryFetchRef = useRef(0);
  const [activeLocalEncounterId, setActiveLocalEncounterId] = useState<string | null>(null);

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
    return [...localTalents]
      .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
      .slice(0, cap);
  }, [localTalents, mapZoom]);

  const activeLocalEncounter = useMemo(
    () => localTalents.find((t) => t.id === activeLocalEncounterId) ?? null,
    [localTalents, activeLocalEncounterId]
  );

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
          const now = Date.now();
          const merged = talentResult.data.map((item) => {
            const existing = prevById.get(item.id);
            const computedRemaining = Math.max(0, new Date(item.expiresAt).getTime() - now);
            if (existing) {
              return {
                ...item,
                remainingMs: existing.remainingMs,
                isExpiring: existing.isExpiring,
                expiresAt: new Date(now + existing.remainingMs).toISOString(),
              };
            }
            return {
              ...item,
              remainingMs: computedRemaining || item.remainingMs || item.lifetimeMs || LOCAL_TALENT_RUNTIME_CONFIG.defaultLifetimeMs,
              isExpiring: false,
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
        zoom={4}
        minZoom={3}
        maxZoom={18}
        maxBounds={WORLD_MAX_BOUNDS}
        maxBoundsViscosity={0.85}
        className="w-full h-full z-0"
        zoomControl={false}
        attributionControl={false}
        style={{ background: "hsl(225 30% 5%)" }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution=""
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

        {/* Real current-location marker */}
        {userCoords && (
          <Marker
            position={[userCoords.lat, userCoords.lng]}
            icon={createUserLocationIcon()}
            zIndexOffset={900}
          />
        )}

        {/* Zone markers */}
        {zones.map((zone) => (
          <Marker
            key={zone.id}
            position={[zone.lat, zone.lng]}
            icon={createZoneIcon(zone.type)}
            eventHandlers={{
              click: () => {
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
              icon={createPlayerMarkerIcon(player.portrait, player.rarity)}
              eventHandlers={{
                click: () => {
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
            icon={createPlayerMarkerIcon(talent.portrait, talent.rarity, {
              expiring: talent.isExpiring,
              leavingSoon: talent.remainingMs <= LOCAL_TALENT_RUNTIME_CONFIG.leavingSoonMs,
              remainingSec: talent.remainingMs <= LOCAL_TALENT_RUNTIME_CONFIG.leavingSoonMs ? Math.ceil(talent.remainingMs / 1000) : undefined,
            })}
            eventHandlers={{
              click: () => {
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
            icon={createZoneIcon(place.mappedZoneType)}
            eventHandlers={{
              click: () => {
                setSelectedPlace(place);
                setSelectedZone(null);
                setEncounterPlayer(null);
                setActiveLocalEncounterId(null);
              },
            }}
          />
        ))}
      </MapContainer>

      {/* Floating Mission Pill */}
      <div
        className="absolute top-[env(safe-area-inset-top,12px)] right-14 z-[1210] mt-3 animate-fade-in-up max-w-[min(100%-7rem,16rem)]"
        style={{ left: "calc(env(safe-area-inset-left, 0px) + var(--game-sidebar-width, 56px) + 10px)" }}
      >
        <div className="glass-card-strong px-3 py-2.5 flex items-center gap-2.5 rounded-2xl">
          <span className="text-base">🎯</span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-foreground truncate">{mockMission.title}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${(mockMission.progress / mockMission.total) * 100}%` }}
                />
              </div>
              <span className="text-[9px] text-primary font-black">{mockMission.progress}/{mockMission.total}</span>
            </div>
            {zonesLoading && (
              <p className="text-[9px] text-muted-foreground mt-1">Loading zones...</p>
            )}
            {zonesError && (
              <p className="text-[9px] text-destructive mt-1">Zones unavailable, using fallback</p>
            )}
            {!zonesLoading && !zonesError && zones.length === 0 && (
              <p className="text-[9px] text-muted-foreground mt-1">No active zones</p>
            )}
            {!zonesLoading && !zonesError && !usingMockZones && zones.length > 0 && (
              <p className="text-[9px] text-primary/80 mt-1">Live zone feed</p>
            )}
            {discoveryError && (
              <p className="text-[9px] text-destructive mt-1">Nearby discovery unavailable, using defaults</p>
            )}
            {locating && (
              <p className="text-[9px] text-primary mt-1">Locating your position…</p>
            )}
            {locationNotice && !locating && (
              <p className="text-[9px] text-muted-foreground mt-1">{locationNotice}</p>
            )}
            {!discoveryError && userCoords && (
              <p className="text-[9px] text-primary/80 mt-1">
                Nearby encounters: {visibleLocalTalents.length} shown ({localTalents.length} generated)
              </p>
            )}
            {!discoveryError && userCoords && visibleLocalTalents.some((t) => t.remainingMs <= LOCAL_TALENT_RUNTIME_CONFIG.leavingSoonMs) && (
              <p className="text-[9px] text-destructive mt-1">Some nearby players are leaving soon.</p>
            )}
          </div>
        </div>
      </div>

      {/* Active Player Shortcut */}
      <div className="absolute top-[env(safe-area-inset-top,12px)] right-3 z-[1210] mt-3 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
        <div className="glass-card-strong p-1.5 pr-2.5 flex items-center gap-2 rounded-2xl max-w-[9.5rem]">
          <AnimatedPortrait player={activePlayer} size="xs" />
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold text-foreground leading-tight truncate">{activePlayer.name}</p>
            <p className="text-[8px] text-muted-foreground truncate">
              {activePlayer.position} · {activePlayer.representedCountry}
            </p>
            <p className="text-[8px] text-primary font-semibold">Active</p>
          </div>
        </div>
      </div>

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

      {/* Nearby activity — dedicated strip above bottom nav */}
      <div
        className="absolute left-2 right-2 z-[1220] pointer-events-auto"
        style={{ bottom: "var(--explore-activity-bottom)" }}
      >
        <div className="flex gap-1.5 overflow-x-auto py-0.5 scrollbar-hide min-h-[2.5rem] items-center">
          {[...mockNearbyActivity,
            ...visibleLocalTalents
              .slice(0, 3)
              .map((t) => `${t.encounterTier}: ${t.displayName} (${Math.max(0, Math.ceil(t.remainingMs / 1000))}s)`),
            ...nearbyPlaces.slice(0, 2).map((p) => `${p.name} → ${p.mappedZoneLabel}`),
          ].map((activity, i) => (
            <div key={i} className="glass-card px-2.5 py-1.5 shrink-0 flex items-center gap-1.5 rounded-xl">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
              <span className="text-[9px] font-semibold text-foreground/80 whitespace-nowrap">{activity}</span>
            </div>
          ))}
        </div>
      </div>

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
        <ZoneExperience
          zone={activeZone}
          onClose={() => {
            setActiveZone(null);
            setSelectedZone(null);
            setSelectedPlace(null);
          }}
        />
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
        <PlayerEncounter
          player={encounterPlayer}
          encounterRemainingMs={activeLocalEncounter?.remainingMs}
          onFlowEnd={handleEncounterFlowEnd}
          onClose={() => {
            setEncounterPlayer(null);
            setActiveLocalEncounterId(null);
          }}
        />
      )}

      {/* Camera Mission */}
      {showCamera && (
        <CameraMission onClose={() => setShowCamera(false)} onComplete={() => setShowCamera(false)} />
      )}
    </div>
  );
};

export default ExploreScreen;
