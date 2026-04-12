import { useState, useRef, useCallback } from "react";
import { Scan, ChevronRight, Sparkles, ZoomIn, ZoomOut } from "lucide-react";
import mapBg from "@/assets/map-bg.jpg";
import { mockZones, mockMission, mockPlayers, zoneIcons } from "@/data/mockData";
import type { MapZone, Player } from "@/data/mockData";
import AnimatedPortrait from "./AnimatedPortrait";
import PlayerEncounter from "./PlayerEncounter";
import CameraMission from "./CameraMission";

const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.5;

const ExploreScreen = () => {
  const [selectedZone, setSelectedZone] = useState<MapZone | null>(null);
  const [encounterPlayer, setEncounterPlayer] = useState<Player | null>(null);
  const [scanning, setScanning] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  // Zoom state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const mapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, panX: 0, panY: 0 });
  const pinchRef = useRef({ dist: 0, zoom: 1 });

  const clampPan = useCallback((x: number, y: number, z: number) => {
    const max = ((z - 1) / z) * 50;
    return { x: Math.max(-max, Math.min(max, x)), y: Math.max(-max, Math.min(max, y)) };
  }, []);

  const handleZoomIn = () => {
    const newZoom = Math.min(zoom + ZOOM_STEP, ZOOM_MAX);
    setZoom(newZoom);
    setPan(clampPan(pan.x, pan.y, newZoom));
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoom - ZOOM_STEP, ZOOM_MIN);
    setZoom(newZoom);
    setPan(clampPan(pan.x, pan.y, newZoom));
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom + delta));
    setZoom(newZoom);
    setPan(clampPan(pan.x, pan.y, newZoom));
  };

  // Touch handlers for pinch-to-zoom and pan
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { dist: Math.hypot(dx, dy), zoom };
    } else if (e.touches.length === 1 && zoom > 1) {
      dragRef.current = { dragging: true, startX: e.touches[0].clientX, startY: e.touches[0].clientY, panX: pan.x, panY: pan.y };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.hypot(dx, dy);
      const scale = newDist / pinchRef.current.dist;
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pinchRef.current.zoom * scale));
      setZoom(newZoom);
      setPan(clampPan(pan.x, pan.y, newZoom));
    } else if (dragRef.current.dragging && e.touches.length === 1) {
      const dx = ((e.touches[0].clientX - dragRef.current.startX) / zoom) * 0.15;
      const dy = ((e.touches[0].clientY - dragRef.current.startY) / zoom) * 0.15;
      setPan(clampPan(dragRef.current.panX + dx, dragRef.current.panY + dy, zoom));
    }
  };

  const handleTouchEnd = () => {
    dragRef.current.dragging = false;
  };

  const handleScan = () => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      setShowCamera(true);
    }, 800);
  };

  const markerScale = Math.max(0.7, 1 / Math.sqrt(zoom));

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Map Background with zoom/pan */}
      <div
        ref={mapRef}
        className="absolute inset-0 transition-transform duration-300 ease-out"
        style={{
          transform: `scale(${zoom}) translate(${pan.x}%, ${pan.y}%)`,
          transformOrigin: "center center",
        }}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img src={mapBg} alt="Football world map" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-background/80" />
        <div className="absolute inset-0 stadium-glow" />

        {/* Zone Markers */}
        {mockZones.map((zone, i) => (
          <button
            key={zone.id}
            onClick={() => { setSelectedZone(zone); setEncounterPlayer(null); }}
            className="absolute marker-float z-10 group"
            style={{
              left: `${zone.x}%`, top: `${zone.y}%`,
              transform: `translate(-50%, -50%) scale(${markerScale})`,
              animationDelay: `${i * 0.4}s`,
            }}
          >
            <div className="flex flex-col items-center gap-1.5">
              <div className="absolute w-14 h-14 rounded-full border-2 border-primary/30 zone-pulse" />
              <div className="w-13 h-13 rounded-full bg-primary/15 backdrop-blur-md border border-primary/30 flex items-center justify-center text-xl transition-transform group-active:scale-90"
                style={{ width: 52, height: 52 }}>
                {zoneIcons[zone.type]}
              </div>
              {zoom >= 1.5 && (
                <span className="text-[9px] font-bold text-foreground/90 bg-background/70 backdrop-blur-sm px-2.5 py-0.5 rounded-full border border-border/30">
                  {zone.benefit}
                </span>
              )}
            </div>
          </button>
        ))}

        {/* Player encounter markers */}
        {[{ x: 38, y: 33 }, { x: 62, y: 58 }, { x: 28, y: 52 }].map((pos, i) => (
          <button
            key={i}
            onClick={() => { setEncounterPlayer(mockPlayers[i]); setSelectedZone(null); }}
            className="absolute marker-float z-10 group"
            style={{
              left: `${pos.x}%`, top: `${pos.y}%`,
              transform: `translate(-50%, -50%) scale(${markerScale})`,
              animationDelay: `${i * 0.6}s`,
            }}
          >
            <div className="relative">
              <div className="absolute inset-0 w-11 h-11 rounded-full bg-accent/20 zone-pulse" />
              <div className="w-11 h-11 rounded-full bg-accent/15 backdrop-blur-md border border-accent/30 flex items-center justify-center transition-transform group-active:scale-90">
                <Sparkles className="w-5 h-5 text-accent" />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Zoom Controls - fixed position, not affected by map transform */}
      <div className="absolute top-28 left-4 z-30 flex flex-col gap-2 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        <button
          onClick={handleZoomIn}
          disabled={zoom >= ZOOM_MAX}
          className="w-10 h-10 rounded-xl glass-card-strong flex items-center justify-center transition-all active:scale-90 disabled:opacity-30"
        >
          <ZoomIn className="w-5 h-5 text-foreground" />
        </button>
        <button
          onClick={handleZoomOut}
          disabled={zoom <= ZOOM_MIN}
          className="w-10 h-10 rounded-xl glass-card-strong flex items-center justify-center transition-all active:scale-90 disabled:opacity-30"
        >
          <ZoomOut className="w-5 h-5 text-foreground" />
        </button>
        {zoom > 1 && (
          <div className="text-center">
            <span className="text-[9px] text-foreground/70 font-bold">{zoom.toFixed(1)}x</span>
          </div>
        )}
      </div>

      {/* Floating Mission Card */}
      <div className="absolute top-12 left-4 right-16 z-20 animate-fade-in-up">
        <div className="glass-card-strong p-3.5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-accent/15 border border-accent/20 flex items-center justify-center shrink-0">
            <span className="text-lg">🎯</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-foreground truncate">{mockMission.title}</p>
            <p className="text-[10px] text-muted-foreground">{mockMission.reward}</p>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary rounded-full transition-all duration-700"
                style={{ width: `${(mockMission.progress / mockMission.total) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-primary font-black">{mockMission.progress}/{mockMission.total}</span>
          </div>
        </div>
      </div>

      {/* Active Player Shortcut */}
      <div className="absolute top-12 right-4 z-20 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <div className="glass-card-strong p-2 flex items-center gap-2.5 pr-3.5">
          <AnimatedPortrait player={mockPlayers[0]} size="sm" showMood />
          <div>
            <p className="text-[10px] font-bold text-foreground">Mbappé</p>
            <p className="text-[9px] text-primary font-semibold">Active</p>
          </div>
        </div>
      </div>

      {/* Scan Button */}
      <button onClick={handleScan} className="absolute bottom-32 left-1/2 -translate-x-1/2 z-30">
        {scanning && (
          <>
            <div className="absolute inset-0 w-16 h-16 rounded-full bg-primary/30 animate-scan-ripple" />
            <div className="absolute inset-0 w-16 h-16 rounded-full bg-primary/20 animate-scan-ripple" style={{ animationDelay: '0.3s' }} />
          </>
        )}
        <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-primary via-primary to-primary floating-button glow-primary flex items-center justify-center active:scale-90 transition-transform">
          <Scan className={`w-7 h-7 text-primary-foreground ${scanning ? 'animate-spin' : ''}`} />
        </div>
      </button>

      {/* Nearby Activity Strip */}
      <div className="absolute bottom-[5.5rem] left-3 right-3 z-20">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {["Training +2 nearby", "Rival spotted!", "Fan Arena event"].map((activity, i) => (
            <div key={i} className="glass-card px-3 py-2 shrink-0 flex items-center gap-2 animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-semibold text-foreground/80 whitespace-nowrap">{activity}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Zone Bottom Sheet */}
      {selectedZone && (
        <div className="fixed inset-0 z-40 bg-background/40 backdrop-blur-sm" onClick={() => setSelectedZone(null)}>
          <div className="bottom-sheet p-6 pb-8 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-5" />
            <div className="flex items-center gap-4 mb-5">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-3xl">
                {zoneIcons[selectedZone.type]}
              </div>
              <div>
                <h3 className="text-xl font-black text-foreground">{selectedZone.name}</h3>
                <p className="text-sm text-primary font-semibold">{selectedZone.benefit}</p>
              </div>
            </div>
            <button className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary to-primary text-primary-foreground font-black text-sm floating-button flex items-center justify-center gap-2 glow-primary">
              Enter Zone <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Player Encounter - Full Screen */}
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
