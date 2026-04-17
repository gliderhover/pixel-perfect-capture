import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
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

const createPlayerMarkerIcon = (portrait: string) => {
  const safe = portrait.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return L.divIcon({
    className: "custom-player-marker",
    html: `<div class="player-marker-face"><img src="${safe}" alt="" loading="lazy" referrerpolicy="no-referrer" /></div>`,
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

type SelectedPlace = ApiNearbyPlace | null;

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
  const [localTalents, setLocalTalents] = useState<ApiLocalTalentEncounter[]>([]);
  const [nearbyPlaces, setNearbyPlaces] = useState<ApiNearbyPlace[]>([]);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  const handleScan = () => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      setShowCamera(true);
    }, 800);
  };

  useEffect(() => {
    setExplorationZoneType(selectedZone?.type ?? null);
  }, [selectedZone, setExplorationZoneType]);

  useEffect(() => {
    let cancelled = false;
    const loadFlavor = async () => {
      if (!selectedZone) {
        setZoneFlavorText(null);
        return;
      }
      try {
        const result = await fetchZoneFlavor(selectedZone.type, selectedZone.name);
        if (!cancelled) setZoneFlavorText(result.flavor);
      } catch {
        if (!cancelled) setZoneFlavorText(null);
      }
    };
    void loadFlavor();
    return () => {
      cancelled = true;
    };
  }, [selectedZone]);

  useEffect(() => {
    let cancelled = false;
    const loadNearbyDiscovery = async () => {
      if (!userCoords) return;
      setDiscoveryError(null);
      try {
        const [talentResult, placesResult] = await Promise.all([
          fetchNearbyLocalTalents(userCoords.lat, userCoords.lng, 5),
          fetchNearbyFootballPlaces(userCoords.lat, userCoords.lng, 5),
        ]);
        if (cancelled) return;
        setLocalTalents(talentResult.data);
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
  }, [userCoords]);

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
              click: () => { setSelectedZone(zone); setEncounterPlayer(null); },
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
              icon={createPlayerMarkerIcon(player.portrait)}
              eventHandlers={{
                click: () => {
                  const full = playersById[pm.playerId] ?? player;
                  setEncounterPlayer(full);
                  setSelectedZone(null);
                },
              }}
            />
          );
        })}

        {/* Nearby hidden prospects */}
        {localTalents.map((talent) => (
          <Marker
            key={talent.id}
            position={[talent.lat, talent.lng]}
            icon={createPlayerMarkerIcon(talent.portrait)}
            eventHandlers={{
              click: () => {
                const base = playersById[talent.basePlayerId] ?? getPlayerById(talent.basePlayerId);
                if (!base) return;
                setEncounterPlayer({
                  ...base,
                  name: talent.displayName,
                  representedCountry: talent.hometown,
                  traits: [...base.traits.slice(0, 2), "Under-the-radar Prospect"],
                });
                setSelectedZone(null);
                setSelectedPlace(null);
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
            ...localTalents.slice(0, 2).map((t) => `Hidden prospect nearby: ${t.displayName}`),
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
        <ZoneExperience zone={activeZone} onClose={() => { setActiveZone(null); setSelectedZone(null); }} />
      )}

      {/* Nearby Place Bottom Sheet */}
      {selectedPlace && (
        <div className="fixed inset-0 z-[1300] bg-background/40 backdrop-blur-sm" onClick={() => setSelectedPlace(null)}>
          <div
            className="absolute bottom-0 left-0 right-0 p-5 rounded-t-3xl bg-background/95 backdrop-blur-xl border-t border-border/20 animate-slide-up"
            style={{ paddingBottom: "max(1.75rem, calc(env(safe-area-inset-bottom, 0px) + 1.25rem))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-4" />
            <div className="flex items-center gap-3 mb-3">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-2xl">
                {zoneIcons[selectedPlace.mappedZoneType]}
              </div>
              <div>
                <h3 className="text-lg font-black text-foreground">{selectedPlace.name}</h3>
                <p className="text-sm text-primary font-semibold">{selectedPlace.mappedZoneLabel}</p>
                <p className="text-xs text-muted-foreground mt-1">{selectedPlace.distanceKm.toFixed(1)} km away</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Nearby {selectedPlace.type.replace("-", " ")} converted into a {selectedPlace.mappedZoneLabel.toLowerCase()}.
            </p>
          </div>
        </div>
      )}

      {/* Player Encounter */}
      {encounterPlayer && (
        <PlayerEncounter player={encounterPlayer} onClose={() => setEncounterPlayer(null)} />
      )}

      {/* Camera Mission */}
      {showCamera && (
        <CameraMission onClose={() => setShowCamera(false)} onComplete={() => setShowCamera(false)} />
      )}
    </div>
  );
};

export default ExploreScreen;
