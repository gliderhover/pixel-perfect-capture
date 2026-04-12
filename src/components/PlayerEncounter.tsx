import { useState, useEffect } from "react";
import { ChevronRight, X } from "lucide-react";
import type { Player } from "@/data/mockData";
import AnimatedPortrait from "./AnimatedPortrait";

interface PlayerEncounterProps {
  player: Player;
  onClose: () => void;
}

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
  const headlineTrait = player.traits[0] ?? "Elite prospect";

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 100);
    return () => clearTimeout(t);
  }, []);

  const handleRecruit = () => {
    setAction("recruit");
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-[1400]" onClick={onClose}>
      <div className="absolute inset-0 bg-background/80 backdrop-blur-xl" />
      <div
        className={`absolute inset-0 opacity-30 transition-opacity duration-700 ${revealed ? "opacity-30" : "opacity-0"}`}
        style={{
          background:
            player.rarity === "legendary"
              ? "radial-gradient(circle at 50% 38%, hsl(42 95% 55% / 0.3), transparent 70%)"
              : player.rarity === "epic"
                ? "radial-gradient(circle at 50% 38%, hsl(270 60% 55% / 0.3), transparent 70%)"
                : player.rarity === "rare"
                  ? "radial-gradient(circle at 50% 38%, hsl(210 80% 55% / 0.25), transparent 70%)"
                  : "radial-gradient(circle at 50% 38%, hsl(var(--muted) / 0.3), transparent 70%)",
        }}
      />

      <button
        type="button"
        onClick={onClose}
        className="absolute top-[max(3rem,env(safe-area-inset-top))] right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full glass-card"
      >
        <X className="h-5 w-5 text-muted-foreground" />
      </button>

      <div className="relative flex h-full flex-col items-center justify-center px-6" onClick={(e) => e.stopPropagation()}>
        {revealed && (
          <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2">
            <div
              className="h-40 w-40 animate-energy-burst rounded-full"
              style={{
                background:
                  player.rarity === "legendary"
                    ? "radial-gradient(circle, hsl(42 95% 55% / 0.4), transparent)"
                    : player.rarity === "epic"
                      ? "radial-gradient(circle, hsl(270 60% 55% / 0.3), transparent)"
                      : "radial-gradient(circle, hsl(var(--primary) / 0.3), transparent)",
              }}
            />
          </div>
        )}

        <div className={`transition-all duration-700 ${revealed ? "animate-encounter-reveal" : "scale-75 opacity-0"}`}>
          <AnimatedPortrait player={player} size="xl" className="mb-5" />
        </div>

        <div
          className={`max-w-sm text-center transition-all delay-200 duration-500 ${revealed ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
        >
          <span
            className={`mb-3 inline-block rounded-full border border-current/20 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest ${rarity.bg} ${rarity.text}`}
          >
            {player.rarity}
          </span>

          <h2 className="mb-1 text-3xl font-black text-foreground">{player.name}</h2>

          <p className="mb-1 text-sm font-semibold text-muted-foreground">
            {player.position} · <span className="text-foreground/90">{player.representedCountry}</span>
          </p>

          <p className="mb-1 text-xs text-muted-foreground line-clamp-2">{player.clubTeam}</p>

          <p className="text-xs font-bold tracking-wide text-primary">✦ {headlineTrait}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">OVR {player.stats.overall}</p>
        </div>

        <div
          className={`mt-10 w-full max-w-sm transition-all delay-500 duration-500 ${revealed ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
        >
          {action ? (
            <div className="animate-encounter-reveal text-center">
              <div className="mb-2 text-4xl">⚡</div>
              <p className="text-lg font-black text-primary">Recruiting…</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleRecruit}
              className="floating-button flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary via-primary to-primary py-4 text-sm font-black text-primary-foreground glow-primary"
            >
              Recruit player <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayerEncounter;
