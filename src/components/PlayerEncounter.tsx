import { useState, useEffect } from "react";
import { ChevronRight, X, Shield } from "lucide-react";
import type { Player } from "@/data/mockData";
import { keeperGloves, recruitBoosts, type KeeperGloves, type RecruitBoost } from "@/data/keeperItems";
import AnimatedPortrait from "./AnimatedPortrait";
import PenaltyDuel from "./PenaltyDuel";
import { useGameProgress } from "@/context/GameProgressContext";

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

type EncounterPhase = "intro" | "equip" | "duel" | "recruited" | "escaped";

const PlayerEncounter = ({ player, onClose }: PlayerEncounterProps) => {
  const [phase, setPhase] = useState<EncounterPhase>("intro");
  const [revealed, setRevealed] = useState(false);
  const [selectedGloves, setSelectedGloves] = useState<KeeperGloves>(keeperGloves[0]);
  const [activeBoosts, setActiveBoosts] = useState<RecruitBoost[]>([]);
  const [canRetry, setCanRetry] = useState(false);
  const { updatePlayer } = useGameProgress();
  const rarity = rarityLabel[player.rarity];
  const headlineTrait = player.traits[0] ?? "Elite prospect";

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 100);
    return () => clearTimeout(t);
  }, []);

  const toggleBoost = (boost: RecruitBoost) => {
    setActiveBoosts((prev) =>
      prev.find((b) => b.id === boost.id)
        ? prev.filter((b) => b.id !== boost.id)
        : [...prev, boost]
    );
  };

  const handleSave = () => {
    // Recruit at level 1 with low base stats
    updatePlayer(player.id, {
      level: 1,
      currentXp: 0,
      xpToNext: 120,
      evolutionStage: 0,
      shardsCollected: 0,
      bondTrust: 10,
    });
    setPhase("recruited");
  };

  const handleGoal = () => {
    const hasRetry = activeBoosts.some((b) => b.effect === "retry") && !canRetry;
    if (hasRetry) {
      setCanRetry(true);
      setPhase("equip"); // go back to equip to retry
    } else {
      setPhase("escaped");
    }
  };

  // --- DUEL PHASE ---
  if (phase === "duel") {
    return (
      <PenaltyDuel
        player={player}
        gloveTimingBonus={selectedGloves.timingBonus}
        diveForgiveness={selectedGloves.diveForgiveness > 0}
        slowShot={activeBoosts.some((b) => b.effect === "slow_shot")}
        hintDirection={activeBoosts.some((b) => b.effect === "hint_direction")}
        onSave={handleSave}
        onGoal={handleGoal}
      />
    );
  }

  // --- RECRUITED / ESCAPED ---
  if (phase === "recruited") {
    return (
      <div className="fixed inset-0 z-[1400] flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl px-6">
        <div className="animate-scale-in text-center">
          <div className="text-6xl mb-4">🧤✨</div>
          <h2 className="text-3xl font-black text-primary mb-2">Player Recruited!</h2>
          <p className="text-foreground font-bold text-lg">{player.name}</p>
          <p className="text-sm text-muted-foreground mt-1">{player.position} · {player.clubTeam}</p>
          <div className="mt-4 glass-card px-4 py-3 rounded-2xl inline-block">
            <p className="text-xs text-muted-foreground">Starts at</p>
            <p className="text-lg font-black text-accent">Level 1</p>
            <p className="text-[10px] text-muted-foreground">Train, bond & evolve to unlock full potential</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-8 w-full max-w-xs py-4 rounded-2xl bg-primary text-primary-foreground font-black glow-primary active:scale-[0.97] transition-transform"
          >
            Go to Squad
          </button>
        </div>
      </div>
    );
  }

  if (phase === "escaped") {
    return (
      <div className="fixed inset-0 z-[1400] flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl px-6">
        <div className="animate-scale-in text-center">
          <div className="text-6xl mb-4">⚽💨</div>
          <h2 className="text-3xl font-black text-destructive mb-2">Player Escaped</h2>
          <p className="text-foreground font-bold text-lg">{player.name}</p>
          <p className="text-sm text-muted-foreground mt-2">The player may return to the map later.</p>
          <p className="text-xs text-muted-foreground mt-1">Train harder and try again!</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-8 w-full max-w-xs py-4 rounded-2xl glass-card-strong text-foreground font-black active:scale-[0.97] transition-transform"
          >
            Back to Map
          </button>
        </div>
      </div>
    );
  }

  // --- EQUIP PHASE ---
  if (phase === "equip") {
    return (
      <div className="fixed inset-0 z-[1400] flex flex-col bg-background/95 backdrop-blur-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-[max(3rem,env(safe-area-inset-top))] right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full glass-card"
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </button>

        <div className="flex-1 overflow-y-auto px-5 pt-[max(4rem,env(safe-area-inset-top))] pb-32">
          <div className="text-center mb-6">
            <Shield className="w-8 h-8 text-primary mx-auto mb-2" />
            <h2 className="text-xl font-black text-foreground">Prepare Your Gloves</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Equip gloves & boosts before the penalty duel vs <span className="text-foreground font-semibold">{player.name}</span>
            </p>
            {canRetry && (
              <p className="text-xs text-accent font-bold mt-2">🔄 Retry granted! One more chance.</p>
            )}
          </div>

          {/* Gloves */}
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Keeper Gloves</p>
          <div className="grid grid-cols-2 gap-2 mb-6">
            {keeperGloves.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedGloves(g)}
                className={`p-3 rounded-2xl text-left transition-all active:scale-95 ${
                  selectedGloves.id === g.id
                    ? "glass-card-strong border-primary/40 glow-primary"
                    : "glass-card border-transparent"
                }`}
              >
                <span className="text-xl">{g.icon}</span>
                <p className="text-xs font-bold text-foreground mt-1">{g.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{g.description}</p>
              </button>
            ))}
          </div>

          {/* Boosts */}
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Boosts</p>
          <div className="grid grid-cols-2 gap-2">
            {recruitBoosts.map((b) => {
              const active = activeBoosts.some((ab) => ab.id === b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => toggleBoost(b)}
                  className={`p-3 rounded-2xl text-left transition-all active:scale-95 ${
                    active
                      ? "glass-card-strong border-accent/40 glow-accent"
                      : "glass-card border-transparent"
                  }`}
                >
                  <span className="text-xl">{b.icon}</span>
                  <p className="text-xs font-bold text-foreground mt-1">{b.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{b.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent"
          style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            onClick={() => setPhase("duel")}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary to-primary text-primary-foreground font-black text-base glow-primary active:scale-[0.97] transition-transform flex items-center justify-center gap-2"
          >
            ⚡ Start Penalty Duel <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // --- INTRO PHASE (default) ---
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

          <p className="mb-1 text-xs text-muted-foreground line-clamp-2">{player.clubTeam} · Age {player.age}</p>

          <p className="text-xs font-bold tracking-wide text-primary">✦ {headlineTrait}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">OVR {player.stats.overall}</p>
        </div>

        {/* Penalty Duel CTA */}
        <div
          className={`mt-8 w-full max-w-sm transition-all delay-500 duration-500 ${revealed ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
        >
          <p className="text-center text-xs text-muted-foreground mb-3">
            🧤 Defend this penalty to recruit the player
          </p>
          <button
            type="button"
            onClick={() => setPhase("equip")}
            className="floating-button flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary via-primary to-primary py-4 text-sm font-black text-primary-foreground glow-primary"
          >
            ⚡ Start Penalty Duel <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlayerEncounter;
