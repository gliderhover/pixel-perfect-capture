import { useState } from "react";
import { Scan, ChevronRight } from "lucide-react";
import mapBg from "@/assets/map-bg.jpg";
import { mockZones, mockMission, mockPlayers, zoneIcons } from "@/data/mockData";
import type { MapZone, Player } from "@/data/mockData";

const ExploreScreen = () => {
  const [selectedZone, setSelectedZone] = useState<MapZone | null>(null);
  const [encounterPlayer, setEncounterPlayer] = useState<Player | null>(null);

  const handleScan = () => {
    const randomPlayer = mockPlayers[Math.floor(Math.random() * mockPlayers.length)];
    setEncounterPlayer(randomPlayer);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Map Background */}
      <div className="absolute inset-0">
        <img src={mapBg} alt="Football world map" className="w-full h-full object-cover" width={1080} height={1920} />
        <div className="absolute inset-0 stadium-glow" />
      </div>

      {/* Zone Markers */}
      {mockZones.map((zone) => (
        <button
          key={zone.id}
          onClick={() => { setSelectedZone(zone); setEncounterPlayer(null); }}
          className="absolute marker-float z-10"
          style={{ left: `${zone.x}%`, top: `${zone.y}%`, transform: "translate(-50%, -50%)" }}
        >
          <div className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 rounded-full bg-primary/20 backdrop-blur-sm border border-primary/40 flex items-center justify-center text-xl glow-primary">
              {zoneIcons[zone.type]}
            </div>
            <span className="text-[9px] font-semibold text-foreground/80 bg-background/60 backdrop-blur-sm px-2 py-0.5 rounded-full">
              {zone.benefit}
            </span>
          </div>
        </button>
      ))}

      {/* Player encounter markers */}
      {[{ x: 40, y: 35 }, { x: 60, y: 60 }, { x: 30, y: 50 }].map((pos, i) => (
        <button
          key={i}
          onClick={() => {
            setEncounterPlayer(mockPlayers[i]);
            setSelectedZone(null);
          }}
          className="absolute marker-float z-10"
          style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%, -50%)", animationDelay: `${i * 0.5}s` }}
        >
          <div className="w-10 h-10 rounded-full bg-accent/20 backdrop-blur-sm border border-accent/40 flex items-center justify-center glow-accent">
            <span className="text-sm">⚡</span>
          </div>
        </button>
      ))}

      {/* Floating Mission Card */}
      <div className="absolute top-12 left-4 right-4 z-20 animate-fade-in">
        <div className="glass-card p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
            <span className="text-lg">🎯</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-foreground truncate">{mockMission.title}</p>
            <p className="text-[10px] text-muted-foreground">{mockMission.reward}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-glow-primary rounded-full"
                style={{ width: `${(mockMission.progress / mockMission.total) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-primary font-bold">{mockMission.progress}/{mockMission.total}</span>
          </div>
        </div>
      </div>

      {/* Active Player Shortcut */}
      <div className="absolute top-28 right-4 z-20">
        <div className="glass-card p-2 flex items-center gap-2 pr-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xs font-bold text-background">
            95
          </div>
          <div>
            <p className="text-[10px] font-semibold text-foreground">Mbappé</p>
            <p className="text-[9px] text-primary">Active</p>
          </div>
        </div>
      </div>

      {/* Scan Button */}
      <button
        onClick={handleScan}
        className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 w-16 h-16 rounded-full bg-gradient-to-br from-primary to-emerald-400 floating-button glow-primary flex items-center justify-center"
      >
        <Scan className="w-7 h-7 text-primary-foreground" />
      </button>

      {/* Nearby Activity Strip */}
      <div className="absolute bottom-20 left-4 right-4 z-20 mb-2">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {["Training +2 nearby", "Rival spotted!", "Fan Arena event"].map((activity, i) => (
            <div key={i} className="glass-card px-3 py-2 shrink-0 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-medium text-foreground/80 whitespace-nowrap">{activity}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Zone Bottom Sheet */}
      {selectedZone && (
        <div className="bottom-sheet z-40 p-6 pb-8 animate-slide-up" onClick={() => setSelectedZone(null)}>
          <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-4" />
          <div className="flex items-center gap-4 mb-4" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center text-2xl">
              {zoneIcons[selectedZone.type]}
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">{selectedZone.name}</h3>
              <p className="text-sm text-primary font-medium">{selectedZone.benefit}</p>
            </div>
          </div>
          <button className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-emerald-400 text-primary-foreground font-bold text-sm floating-button flex items-center justify-center gap-2">
            Enter Zone <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Player Encounter Bottom Sheet */}
      {encounterPlayer && (
        <div className="bottom-sheet z-40 p-6 pb-8 animate-slide-up" onClick={() => setEncounterPlayer(null)}>
          <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-4" />
          <div className="flex items-center gap-4 mb-5" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-2xl font-black text-background">
              {encounterPlayer.overall}
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">{encounterPlayer.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm">{encounterPlayer.country}</span>
                <span className="text-xs text-muted-foreground">{encounterPlayer.position}</span>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-gradient-to-r ${
                  encounterPlayer.rarity === "legendary" ? "from-amber-400/20 to-orange-500/20 text-accent" :
                  encounterPlayer.rarity === "epic" ? "from-purple-500/20 to-purple-600/20 text-purple-400" :
                  "from-blue-500/20 to-blue-600/20 text-blue-400"
                }`}>
                  {encounterPlayer.rarity}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-primary to-emerald-400 text-primary-foreground font-bold text-sm floating-button">
              Recruit
            </button>
            <button className="flex-1 py-3 rounded-2xl bg-secondary text-secondary-foreground font-bold text-sm floating-button">
              Scout
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExploreScreen;
