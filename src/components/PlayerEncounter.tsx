import { useState, useEffect } from "react";
import { ChevronRight, X, Eye, Swords } from "lucide-react";
import type { Player } from "@/data/mockData";
import AnimatedPortrait from "./AnimatedPortrait";

interface PlayerEncounterProps {
  player: Player;
  onClose: () => void;
}

const traitMap: Record<string, string> = {
  ST: "Clinical Finisher",
  LW: "Explosive Dribbler",
  RW: "Creative Playmaker",
  CM: "Midfield Maestro",
  AM: "Vision Artist",
  CB: "Defensive Rock",
  GK: "Shot Stopper",
};

const rarityLabel: Record<string, { bg: string; text: string; glow: string }> = {
  legendary: { bg: "bg-accent/15", text: "text-accent", glow: "glow-accent" },
  epic: { bg: "bg-glow-epic/15", text: "text-glow-epic", glow: "glow-epic" },
  rare: { bg: "bg-glow-rare/15", text: "text-glow-rare", glow: "glow-rare" },
  common: { bg: "bg-muted", text: "text-muted-foreground", glow: "" },
};

const PlayerEncounter = ({ player, onClose }: PlayerEncounterProps) => {
  const [revealed, setRevealed] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const rarity = rarityLabel[player.rarity];
  const trait = traitMap[player.position] || "Versatile";

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 100);
    return () => clearTimeout(t);
  }, []);

  const handleAction = (type: string) => {
    setAction(type);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      {/* Backdrop with rarity-colored radial glow */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-xl" />
      <div
        className={`absolute inset-0 opacity-30 transition-opacity duration-700 ${revealed ? "opacity-30" : "opacity-0"}`}
        style={{
          background: player.rarity === "legendary"
            ? "radial-gradient(circle at 50% 40%, hsl(42 95% 55% / 0.3), transparent 70%)"
            : player.rarity === "epic"
            ? "radial-gradient(circle at 50% 40%, hsl(270 60% 55% / 0.3), transparent 70%)"
            : player.rarity === "rare"
            ? "radial-gradient(circle at 50% 40%, hsl(210 80% 55% / 0.25), transparent 70%)"
            : "radial-gradient(circle at 50% 40%, hsl(var(--muted) / 0.3), transparent 70%)"
        }}
      />

      {/* Close */}
      <button onClick={onClose} className="absolute top-12 right-4 z-50 w-10 h-10 rounded-full glass-card flex items-center justify-center">
        <X className="w-5 h-5 text-muted-foreground" />
      </button>

      {/* Content */}
      <div className="relative h-full flex flex-col items-center justify-center px-6" onClick={(e) => e.stopPropagation()}>
        {/* Energy burst on reveal */}
        {revealed && (
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-40 h-40 rounded-full animate-energy-burst" style={{
              background: player.rarity === "legendary"
                ? "radial-gradient(circle, hsl(42 95% 55% / 0.4), transparent)"
                : player.rarity === "epic"
                ? "radial-gradient(circle, hsl(270 60% 55% / 0.3), transparent)"
                : "radial-gradient(circle, hsl(var(--primary) / 0.3), transparent)"
            }} />
          </div>
        )}

        {/* Player portrait - large, centered */}
        <div className={`transition-all duration-700 ${revealed ? "animate-encounter-reveal" : "opacity-0 scale-75"}`}>
          <AnimatedPortrait player={player} size="xl" showMood className="mb-6" />
        </div>

        {/* Player info */}
        <div className={`text-center transition-all duration-500 delay-200 ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          {/* Rarity badge */}
          <span className={`inline-block text-[10px] font-black uppercase px-4 py-1.5 rounded-full tracking-widest mb-3 ${rarity.bg} ${rarity.text} border border-current/20`}>
            {player.rarity}
          </span>

          <h2 className="text-3xl font-black text-foreground mb-1">{player.name}</h2>
          
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-lg">{player.country}</span>
            <span className="text-sm text-muted-foreground font-semibold">{player.position}</span>
            <span className="text-sm font-black text-foreground">OVR {player.overall}</span>
          </div>

          {/* Defining trait */}
          <p className="text-xs text-primary font-bold tracking-wide">✦ {trait}</p>
        </div>

        {/* Quick stats row */}
        <div className={`grid grid-cols-4 gap-2 w-full max-w-sm mt-6 transition-all duration-500 delay-300 ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          {Object.entries(player.attributes).map(([key, value]) => (
            <div key={key} className="glass-card p-2.5 text-center">
              <p className="text-lg font-black text-foreground">{value}</p>
              <p className="text-[9px] text-muted-foreground font-medium uppercase mt-0.5">
                {key === "fanBond" ? "Bond" : key.slice(0, 4)}
              </p>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className={`w-full max-w-sm mt-8 space-y-3 transition-all duration-500 delay-500 ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          {action ? (
            <div className="text-center animate-encounter-reveal">
              <div className="text-4xl mb-2">{action === "recruit" ? "⚡" : action === "scout" ? "🔍" : "⚔️"}</div>
              <p className="text-lg font-black text-primary">
                {action === "recruit" ? "Recruiting..." : action === "scout" ? "Scouting..." : "Challenging..."}
              </p>
            </div>
          ) : (
            <>
              <button
                onClick={() => handleAction("recruit")}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary via-primary to-primary text-primary-foreground font-black text-sm flex items-center justify-center gap-2 floating-button glow-primary"
              >
                ⚡ Recruit Player <ChevronRight className="w-4 h-4" />
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => handleAction("scout")}
                  className="flex-1 py-3.5 rounded-2xl glass-card-strong text-foreground font-bold text-sm flex items-center justify-center gap-2 floating-button border border-border/50"
                >
                  <Eye className="w-4 h-4" /> Scout
                </button>
                <button
                  onClick={() => handleAction("challenge")}
                  className="flex-1 py-3.5 rounded-2xl glass-card-strong text-foreground font-bold text-sm flex items-center justify-center gap-2 floating-button border border-border/50"
                >
                  <Swords className="w-4 h-4" /> Challenge
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayerEncounter;
