import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Scan, ChevronRight, Sparkles, ZoomIn, ZoomOut, Crosshair } from "lucide-react";
import { mockZones, mockMission, mockPlayers, mockPlayerMarkers, zoneIcons } from "@/data/mockData";
import type { MapZone, Player } from "@/data/mockData";
import PlayerEncounter from "./PlayerEncounter";
import CameraMission from "./CameraMission";
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

const playerIcon = L.divIcon({
  className: "custom-player-marker",
  html: `<div class="player-marker-inner"><span>⚡</span></div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const MapControls = () => {
  const map = useMap();
  return (
    <div className="absolute top-28 left-3 z-[1000] flex flex-col gap-1.5">
      <button
        onClick={() => map.zoomIn()}
        className="w-9 h-9 rounded-xl glass-card-strong flex items-center justify-center active:scale-90 transition-transform"
      >
        <ZoomIn className="w-4 h-4 text-foreground" />
      </button>
      <button
        onClick={() => map.zoomOut()}
        className="w-9 h-9 rounded-xl glass-card-strong flex items-center justify-center active:scale-90 transition-transform"
      >
        <ZoomOut className="w-4 h-4 text-foreground" />
      </button>
      <button
        onClick={() => {
          navigator.geolocation?.getCurrentPosition(
            (pos) => map.flyTo([pos.coords.latitude, pos.coords.longitude], 14, { duration: 1.5 }),
            () => {}
          );
        }}
        className="w-9 h-9 rounded-xl glass-card-strong flex items-center justify-center active:scale-90 transition-transform"
      >
        <Crosshair className="w-4 h-4 text-foreground" />
      </button>
    </div>
  );
};

const MapEventHandler = ({ onZoomChange }: { onZoomChange: (z: number) => void }) => {
  useMapEvents({
    zoomend: (e) => onZoomChange(e.target.getZoom()),
  });
  return null;
};

const ExploreScreen = () => {
  const [selectedZone, setSelectedZone] = useState<MapZone | null>(null);
  const [encounterPlayer, setEncounterPlayer] = useState<Player | null>(null);
  const [scanning, setScanning] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(5);

  const handleScan = () => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      setShowCamera(true);
    }, 800);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Real Leaflet Map */}
      <MapContainer
        center={[48.0, 5.0]}
        zoom={5}
        className="w-full h-full z-0"
        zoomControl={false}
        attributionControl={false}
        style={{ background: "hsl(225 30% 5%)" }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution=""
        />
        <MapControls />
        <MapEventHandler onZoomChange={setZoomLevel} />

        {/* Zone markers */}
        {mockZones.map((zone) => (
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
          const player = mockPlayers.find((p) => p.id === pm.playerId);
          if (!player) return null;
          return (
            <Marker
              key={pm.id}
              position={[pm.lat, pm.lng]}
              icon={playerIcon}
              eventHandlers={{
                click: () => { setEncounterPlayer(player); setSelectedZone(null); },
              }}
            />
          );
        })}
      </MapContainer>

      {/* Floating Mission Pill */}
      <div className="absolute top-[env(safe-area-inset-top,12px)] left-3 right-14 z-[1001] mt-3 animate-fade-in-up">
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
          </div>
        </div>
      </div>

      {/* Active Player Shortcut */}
      <div className="absolute top-[env(safe-area-inset-top,12px)] right-3 z-[1001] mt-3 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
        <div className="glass-card-strong p-1.5 pr-2.5 flex items-center gap-2 rounded-2xl">
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-sm font-black text-primary">
            {mockPlayers[0].overall}
          </div>
          <div>
            <p className="text-[9px] font-bold text-foreground leading-tight">Mbappé</p>
            <p className="text-[8px] text-primary font-semibold">Active</p>
          </div>
        </div>
      </div>

      {/* Scan Button */}
      <button onClick={handleScan} className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[1001]">
        {scanning && (
          <>
            <div className="absolute inset-0 w-14 h-14 rounded-full bg-primary/30 animate-scan-ripple" />
            <div className="absolute inset-0 w-14 h-14 rounded-full bg-primary/20 animate-scan-ripple" style={{ animationDelay: "0.3s" }} />
          </>
        )}
        <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary floating-button glow-primary flex items-center justify-center active:scale-90 transition-transform">
          <Scan className={`w-6 h-6 text-primary-foreground ${scanning ? "animate-spin" : ""}`} />
        </div>
      </button>

      {/* Nearby Activity Strip */}
      <div className="absolute bottom-[3.75rem] left-2 right-2 z-[1001]">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {["Training +2 nearby", "Rival spotted!", "Fan Arena event"].map((activity, i) => (
            <div key={i} className="glass-card px-2.5 py-1.5 shrink-0 flex items-center gap-1.5 rounded-xl">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[9px] font-semibold text-foreground/80 whitespace-nowrap">{activity}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Zone Bottom Sheet */}
      {selectedZone && (
        <div className="fixed inset-0 z-[1100] bg-background/40 backdrop-blur-sm" onClick={() => setSelectedZone(null)}>
          <div className="absolute bottom-0 left-0 right-0 p-5 pb-8 rounded-t-3xl bg-background/95 backdrop-blur-xl border-t border-border/20 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-4" />
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-2xl">
                {zoneIcons[selectedZone.type]}
              </div>
              <div>
                <h3 className="text-lg font-black text-foreground">{selectedZone.name}</h3>
                <p className="text-sm text-primary font-semibold">{selectedZone.benefit}</p>
              </div>
            </div>
            <button className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-primary text-primary-foreground font-black text-sm flex items-center justify-center gap-2 glow-primary active:scale-[0.98] transition-transform">
              Enter Zone <ChevronRight className="w-4 h-4" />
            </button>
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
