import { useState } from "react";
import { Scan, ChevronRight, Sparkles } from "lucide-react";
import mapBg from "@/assets/map-bg.jpg";
import { mockZones, mockMission, mockPlayers, zoneIcons } from "@/data/mockData";
import type { MapZone, Player } from "@/data/mockData";
import AnimatedPortrait from "./AnimatedPortrait";

const ExploreScreen = () => {
  const [selectedZone, setSelectedZone] = useState<MapZone | null>(null);
  const [encounterPlayer, setEncounterPlayer] = useState<Player | null>(null);
  const [scanning, setScanning] = useState(false);

  const handleScan = () => {
    setScanning(true);
    setTimeout(() => {
      const randomPlayer = mockPlayers[Math.floor(Math.random() * mockPlayers.length)];
      setEncounterPlayer(randomPlayer);
      setSelectedZone(null);
      setScanning(false);
    }, 800);
  };

  const rarityLabel = (rarity: string) => {
    const styles: Record<string, string> = {
      legendary: "bg-gradient-to-r from-amber-400/20 to-orange-500/20 text-accent",
      epic: "bg-gradient-to-r from-purple-500/20 to-purple-600/20 text-purple-400",
      rare: "bg-gradient-to-r from-blue-500/20 to-blue-600/20 text-blue-400",
      common: "bg-gradient-to-r from-zinc-500/20 to-zinc-600/20 text-zinc-400",
    };
    return styles[rarity] || styles.common;
  };

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Map Background */}
      <div className="absolute inset-0">
        <img src={mapBg} alt="Football world map" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-background/80" />
        <div className="absolute inset-0 stadium-glow" />
      </div>

      {/* Zone Markers */}
      {mockZones.map((zone, i) => (
        <button
          key={zone.id}
          onClick={() => { setSelectedZone(zone); setEncounterPlayer(null); }}
          className="absolute marker-float z-10 group"
          style={{ left: `${zone.x}%`, top: `${zone.y}%`, transform: "translate(-50%, -50%)", animationDelay: `${i * 0.4}s` }}
        >
          <div className="flex flex-col items-center gap-1.5">
            {/* Pulse ring */}
            <div className="absolute w-14 h-14 rounded-full border-2 border-primary/30 zone-pulse" />
            <div className="w-13 h-13 rounded-full bg-primary/15 backdrop-blur-md border border-primary/30 flex items-center justify-center text-xl transition-transform group-active:scale-90"
              style={{ width: 52, height: 52 }}>
              {zoneIcons[zone.type]}
            </div>
            <span className="text-[9px] font-bold text-foreground/90 bg-background/70 backdrop-blur-sm px-2.5 py-0.5 rounded-full border border-border/30">
              {zone.benefit}
            </span>
          </div>
        </button>
      ))}

      {/* Player encounter markers */}
      {[{ x: 38, y: 33 }, { x: 62, y: 58 }, { x: 28, y: 52 }].map((pos, i) => (
        <button
          key={i}
          onClick={() => {
            setEncounterPlayer(mockPlayers[i]);
            setSelectedZone(null);
          }}
          className="absolute marker-float z-10 group"
          style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%, -50%)", animationDelay: `${i * 0.6}s` }}
        >
          <div className="relative">
            <div className="absolute inset-0 w-11 h-11 rounded-full bg-accent/20 zone-pulse" />
            <div className="w-11 h-11 rounded-full bg-accent/15 backdrop-blur-md border border-accent/30 flex items-center justify-center transition-transform group-active:scale-90">
              <Sparkles className="w-5 h-5 text-accent" />
            </div>
          </div>
        </button>
      ))}

      {/* Floating Mission Card */}
      <div className="absolute top-12 left-4 right-4 z-20 animate-fade-in-up">
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
                className="h-full bg-gradient-to-r from-primary to-emerald-400 rounded-full transition-all duration-700"
                style={{ width: `${(mockMission.progress / mockMission.total) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-primary font-black">{mockMission.progress}/{mockMission.total}</span>
          </div>
        </div>
      </div>

      {/* Active Player Shortcut */}
      <div className="absolute top-28 right-4 z-20 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <div className="glass-card-strong p-2 flex items-center gap-2.5 pr-3.5">
          <AnimatedPortrait player={mockPlayers[0]} size="sm" showMood />
          <div>
            <p className="text-[10px] font-bold text-foreground">Mbappé</p>
            <p className="text-[9px] text-primary font-semibold">Active</p>
          </div>
        </div>
      </div>

      {/* Scan Button */}
      <button
        onClick={handleScan}
        className="absolute bottom-32 left-1/2 -translate-x-1/2 z-30"
      >
        {scanning && (
          <>
            <div className="absolute inset-0 w-16 h-16 rounded-full bg-primary/30 animate-scan-ripple" />
            <div className="absolute inset-0 w-16 h-16 rounded-full bg-primary/20 animate-scan-ripple" style={{ animationDelay: '0.3s' }} />
          </>
        )}
        <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-primary via-emerald-400 to-primary floating-button glow-primary flex items-center justify-center active:scale-90 transition-transform">
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
            <button className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary via-emerald-400 to-primary text-primary-foreground font-black text-sm floating-button flex items-center justify-center gap-2 glow-primary">
              Enter Zone <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Player Encounter Full Sheet */}
      {encounterPlayer && (
        <div className="fixed inset-0 z-40 bg-background/60 backdrop-blur-md" onClick={() => setEncounterPlayer(null)}>
          <div className="bottom-sheet p-6 pb-8 animate-slide-up max-h-[75vh]" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-5" />

            {/* Player reveal */}
            <div className="flex flex-col items-center mb-6 animate-encounter-reveal">
              <AnimatedPortrait player={encounterPlayer} size="xl" showMood />
              <h3 className="text-2xl font-black text-foreground mt-4">{encounterPlayer.name}</h3>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-lg">{encounterPlayer.country}</span>
                <span className="text-sm text-muted-foreground font-medium">{encounterPlayer.position}</span>
                <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${rarityLabel(encounterPlayer.rarity)}`}>
                  {encounterPlayer.rarity}
                </span>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-4 gap-2 mb-6">
              {Object.entries(encounterPlayer.attributes).map(([key, value]) => (
                <div key={key} className="glass-card p-2.5 text-center">
                  <p className="text-lg font-black text-foreground">{value}</p>
                  <p className="text-[9px] text-muted-foreground font-medium uppercase mt-0.5">
                    {key === "fanBond" ? "Bond" : key.slice(0, 4)}
                  </p>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-primary via-emerald-400 to-primary text-primary-foreground font-black text-sm floating-button glow-primary">
                ⚡ Recruit
              </button>
              <button className="flex-1 py-4 rounded-2xl glass-card-strong text-foreground font-bold text-sm floating-button border border-border/50">
                🔍 Scout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExploreScreen;
