import { useState, useEffect } from "react";
import { ChevronRight, X, Shield, Zap } from "lucide-react";
import type { Player } from "@/data/mockData";
import { keeperGloves, recruitBoosts, type KeeperGloves, type RecruitBoost } from "@/data/keeperItems";
import AnimatedPortrait from "./AnimatedPortrait";
import PenaltyDuel from "./PenaltyDuel";
import { useGameProgress } from "@/context/GameProgressContext";
import { recruitUserPlayer } from "@/lib/apiService";

interface PlayerEncounterProps {
  player: Player;
  onClose: () => void;
  encounterRemainingMs?: number;
  onFlowEnd?: (result: "recruited" | "escaped" | "closed") => void;
}

const rarityLabel: Record<string, { bg: string; text: string; glow: string }> = {
  legendary: { bg: "bg-accent/15", text: "text-accent", glow: "glow-accent" },
  epic: { bg: "bg-glow-epic/15", text: "text-glow-epic", glow: "glow-epic" },
  rare: { bg: "bg-glow-rare/15", text: "text-glow-rare", glow: "glow-rare" },
  common: { bg: "bg-muted", text: "text-muted-foreground", glow: "" },
};

const focusCostByRarity: Record<string, number> = {
  common: 1,
  rare: 2,
  epic: 3,
  legendary: 5,
};

type EncounterPhase = "intro" | "equip" | "duel" | "recruited" | "escaped";

const PlayerEncounter = ({ player, onClose, encounterRemainingMs, onFlowEnd }: PlayerEncounterProps) => {
  const [phase, setPhase] = useState<EncounterPhase>("intro");
  const [revealed, setRevealed] = useState(false);
  const [selectedGloves, setSelectedGloves] = useState<KeeperGloves>(keeperGloves[0]);
  const [activeBoosts, setActiveBoosts] = useState<RecruitBoost[]>([]);
  const [hasUsedRetry, setHasUsedRetry] = useState(false);
  const [recruitError, setRecruitError] = useState<string | null>(null);
  const [isRecruiting, setIsRecruiting] = useState(false);
  const { userId, refreshOwnedPlayers, focusPoints, spendFocusPoints } = useGameProgress();
  const rarity = rarityLabel[player.rarity];
  const headlineTrait = player.traits[0] ?? "Elite prospect";
  const retryCost = focusCostByRarity[player.rarity] ?? 2;
  const remainingSeconds = encounterRemainingMs !== undefined ? Math.max(0, Math.ceil(encounterRemainingMs / 1000)) : null;
  const leavingSoon = remainingSeconds !== null && remainingSeconds <= 3;

  const closeWithResult = (result: "recruited" | "escaped" | "closed") => {
    onFlowEnd?.(result);
    onClose();
  };

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

  const handleStartDuel = () => {
    // First attempt costs Focus Points
    const cost = focusCostByRarity[player.rarity] ?? 2;
    const ok = spendFocusPoints(cost);
    if (!ok) return; // not enough FP
    setPhase("duel");
  };

  const handleSave = async () => {
    setRecruitError(null);
    setIsRecruiting(true);
    try {
      await recruitUserPlayer(userId, player.id);
      await refreshOwnedPlayers();
      setPhase("recruited");
    } catch (error) {
      setRecruitError(error instanceof Error ? error.message : "Recruit failed");
      setPhase("escaped");
    } finally {
      setIsRecruiting(false);
    }
  };

  const handleGoal = () => {
    const hasRetryBoost = activeBoosts.some((b) => b.effect === "retry") && !hasUsedRetry;
    if (hasRetryBoost) {
      setHasUsedRetry(true);
      setPhase("equip");
      return;
    }
    setPhase("escaped");
  };

  const handleRetry = () => {
    const ok = spendFocusPoints(retryCost);
    if (!ok) return;
    setPhase("duel");
  };

  // --- DUEL ---
  if (phase === "duel") {
    return (
      <PenaltyDuel
        player={player}
        gloveTimingBonus={selectedGloves.timingBonus}
        diveForgiveness={selectedGloves.diveForgiveness > 0}
        slowShot={activeBoosts.some((b) => b.effect === "slow_shot")}
        hintDirection={activeBoosts.some((b) => b.effect === "hint_direction")}
        focusPoints={focusPoints}
        gloveName={selectedGloves.name}
        onSave={handleSave}
        onGoal={handleGoal}
      />
    );
  }

  // --- RECRUITED ---
  if (phase === "recruited") {
    return (
      <div className="fixed inset-0 z-[1400] flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl px-6">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(circle at 50% 40%, hsl(var(--primary) / 0.12), transparent 65%)"
        }} />
        <div className="animate-scale-in text-center relative z-10">
          <div className="text-6xl mb-4">🧤✨</div>
          <h2 className="text-3xl font-black text-primary mb-2">Player Recruited!</h2>
          <div className="mb-4">
            <AnimatedPortrait player={player} size="lg" />
          </div>
          <p className="text-foreground font-bold text-xl leading-tight text-center px-2">{player.name}</p>
          <p className="text-sm text-muted-foreground mt-1">{player.position} · {player.nationalTeam}</p>
          <div className="mt-4 glass-card px-5 py-3 rounded-2xl inline-block">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Starts at</p>
            <p className="text-xl font-black text-accent">Level 1</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Train, bond & evolve to unlock full potential</p>
          </div>
          <div className="mt-3 flex items-center justify-center gap-3 text-[10px] text-muted-foreground">
            <span>Confidence 25</span>
            <span>·</span>
            <span>Form 30</span>
            <span>·</span>
            <span>Morale 40</span>
          </div>
          <button
            type="button"
            onClick={() => closeWithResult("recruited")}
            className="mt-8 w-full max-w-xs py-4 rounded-2xl bg-primary text-primary-foreground font-black glow-primary active:scale-[0.97] transition-transform"
          >
            Add to Squad →
          </button>
        </div>
      </div>
    );
  }

  // --- ESCAPED ---
  if (phase === "escaped") {
    const canRetry = focusPoints >= retryCost;
    return (
      <div className="fixed inset-0 z-[1400] flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl px-6">
        <div className="animate-scale-in text-center">
          <div className="text-6xl mb-4">⚽💨</div>
          <h2 className="text-3xl font-black text-destructive mb-2">Player Escaped</h2>
          <div className="mb-3 opacity-60">
            <AnimatedPortrait player={player} size="md" />
          </div>
          <p className="text-foreground font-bold text-lg">{player.name}</p>
          <p className="text-sm text-muted-foreground mt-2">The penalty beat you this time.</p>

          <div className="mt-4 glass-card px-4 py-2.5 rounded-xl inline-flex items-center gap-2">
            <span className="text-sm">🎯</span>
            <span className="text-xs font-black text-accent">{focusPoints}</span>
            <span className="text-[10px] text-muted-foreground">Focus Points remaining</span>
          </div>

          <div className="mt-6 flex flex-col gap-2 w-full max-w-xs mx-auto">
            {recruitError && (
              <p className="text-[10px] text-destructive text-center">{recruitError}</p>
            )}
            {canRetry && (
              <button
                type="button"
                onClick={handleRetry}
                className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-black glow-primary active:scale-[0.97] transition-transform flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" /> Retry ({retryCost} FP)
              </button>
            )}
            <button
              type="button"
              onClick={() => closeWithResult("escaped")}
              className="w-full py-3.5 rounded-2xl glass-card-strong text-foreground font-bold active:scale-[0.97] transition-transform"
            >
              Back to Map
            </button>
            {!canRetry && (
              <p className="text-[10px] text-muted-foreground text-center mt-1">
                Not enough Focus Points to retry. Explore to earn more!
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- EQUIP ---
  if (phase === "equip") {
    return (
      <div className="fixed inset-0 z-[1400] flex flex-col bg-background/95 backdrop-blur-xl">
        <button type="button" onClick={() => closeWithResult("closed")}
          className="absolute top-[max(3rem,env(safe-area-inset-top))] right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full glass-card">
          <X className="h-5 w-5 text-muted-foreground" />
        </button>

        <div className="flex-1 overflow-y-auto px-5 pt-[max(4rem,env(safe-area-inset-top))] pb-36">
          <div className="text-center mb-5">
            <Shield className="w-7 h-7 text-primary mx-auto mb-2" />
            <h2 className="text-xl font-black text-foreground">Prepare Your Gloves</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Equip gloves & boosts before facing <span className="text-foreground font-semibold">{player.name}</span>
            </p>
            {hasUsedRetry && (
              <p className="text-xs text-accent font-bold mt-2">🔄 Free retry from Pressure Calm!</p>
            )}
          </div>

          {/* Focus Points */}
          <div className="glass-card px-4 py-3 rounded-2xl mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎯</span>
              <div>
                <p className="text-xs font-bold text-foreground">Focus Points</p>
                <p className="text-[10px] text-muted-foreground">Used for retries if you miss</p>
              </div>
            </div>
            <span className="text-xl font-black text-accent">{focusPoints}</span>
          </div>

          {/* Gloves */}
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Keeper Gloves</p>
          <div className="grid grid-cols-2 gap-2 mb-5">
            {keeperGloves.map((g) => (
              <button key={g.id} type="button" onClick={() => setSelectedGloves(g)}
                className={`p-3 rounded-2xl text-left transition-all active:scale-95 ${
                  selectedGloves.id === g.id ? "glass-card-strong border-primary/40 glow-primary" : "glass-card border-transparent"
                }`}>
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
                <button key={b.id} type="button" onClick={() => toggleBoost(b)}
                  className={`p-3 rounded-2xl text-left transition-all active:scale-95 ${
                    active ? "glass-card-strong border-accent/40 glow-accent" : "glass-card border-transparent"
                  }`}>
                  <span className="text-xl">{b.icon}</span>
                  <p className="text-xs font-bold text-foreground mt-1">{b.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{b.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/95 to-transparent"
          style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
          {recruitError && (
            <p className="mb-2 text-[10px] text-destructive text-center">{recruitError}</p>
          )}
          <button type="button" onClick={() => setPhase("duel")}
            disabled={isRecruiting}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary to-primary text-primary-foreground font-black text-base glow-primary active:scale-[0.97] transition-transform flex items-center justify-center gap-2">
            ⚡ {isRecruiting ? "Saving recruit..." : "Start Penalty Duel"} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // --- INTRO ---
  return (
    <div className="fixed inset-0 z-[1400]" onClick={() => closeWithResult("closed")}>
      <div className="absolute inset-0 bg-background/85 backdrop-blur-xl" />
      <div className={`absolute inset-0 transition-opacity duration-700 ${revealed ? "opacity-100" : "opacity-0"}`}
        style={{
          background:
            player.rarity === "legendary"
              ? "radial-gradient(circle at 50% 35%, hsl(42 95% 55% / 0.2), transparent 65%)"
              : player.rarity === "epic"
                ? "radial-gradient(circle at 50% 35%, hsl(270 60% 55% / 0.2), transparent 65%)"
                : player.rarity === "rare"
                  ? "radial-gradient(circle at 50% 35%, hsl(210 80% 55% / 0.15), transparent 65%)"
                  : "radial-gradient(circle at 50% 35%, hsl(var(--muted) / 0.2), transparent 65%)",
        }}
      />

      <button type="button" onClick={() => closeWithResult("closed")}
        className="absolute top-[max(3rem,env(safe-area-inset-top))] right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full glass-card">
        <X className="h-5 w-5 text-muted-foreground" />
      </button>

      <div className="relative flex h-full flex-col items-center justify-center px-6" onClick={(e) => e.stopPropagation()}>
        {/* Energy burst */}
        {revealed && (
          <div className="absolute left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2">
            <div className="h-36 w-36 animate-energy-burst rounded-full" style={{
              background: player.rarity === "legendary"
                ? "radial-gradient(circle, hsl(42 95% 55% / 0.35), transparent)"
                : player.rarity === "epic"
                  ? "radial-gradient(circle, hsl(270 60% 55% / 0.25), transparent)"
                  : "radial-gradient(circle, hsl(var(--primary) / 0.25), transparent)",
            }} />
          </div>
        )}

        {/* Portrait */}
        <div className={`transition-all duration-700 ${revealed ? "animate-encounter-reveal" : "scale-75 opacity-0"}`}>
          <AnimatedPortrait player={player} size="xl" className="mb-4" />
        </div>

        {/* Info */}
        <div className={`max-w-sm text-center transition-all delay-200 duration-500 ${revealed ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}>
          <span className={`mb-2 inline-block rounded-full border border-current/20 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest ${rarity.bg} ${rarity.text}`}>
            {player.rarity}
          </span>
          {remainingSeconds !== null && (
            <p className={`mb-1 text-[10px] font-bold ${leavingSoon ? "text-destructive" : "text-primary"}`}>
              {leavingSoon ? "Leaving soon" : "Encounter timer"}: {remainingSeconds}s
            </p>
          )}
          <h2 className="mb-1 text-2xl font-black text-foreground">{player.name}</h2>
          <p className="mb-0.5 text-sm font-semibold text-muted-foreground">
            {player.position} · <span className="text-foreground/90">{player.representedCountry}</span>
          </p>
          <p className="mb-0.5 text-xs text-muted-foreground">{player.nationalTeam} · Age {player.age}</p>
          <p className="text-xs font-bold tracking-wide text-primary">✦ {headlineTrait}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">OVR {player.stats.overall}</p>
        </div>

        {/* Focus Points + CTA */}
        <div className={`mt-6 w-full max-w-sm transition-all delay-500 duration-500 ${revealed ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}>
          {recruitError && (
            <p className="mb-2 text-center text-[10px] text-destructive">{recruitError}</p>
          )}
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="glass-card px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <span className="text-sm">🎯</span>
              <span className="text-xs font-black text-accent">{focusPoints}</span>
              <span className="text-[9px] text-muted-foreground">FP</span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              Cost: {focusCostByRarity[player.rarity] ?? 2} FP
            </span>
          </div>

          <p className="text-center text-xs text-muted-foreground mb-3">
            🧤 Defend this penalty to recruit the player
          </p>

          {focusPoints >= (focusCostByRarity[player.rarity] ?? 2) ? (
            <button type="button" onClick={() => setPhase("equip")}
              className="floating-button flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary via-primary to-primary py-4 text-sm font-black text-primary-foreground glow-primary">
              ⚡ Start Penalty Duel <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <div className="text-center">
              <p className="text-sm font-bold text-destructive/80 mb-1">Not enough Focus Points</p>
              <p className="text-[10px] text-muted-foreground">Explore the map and train to earn more!</p>
              <button type="button" onClick={() => closeWithResult("closed")}
                className="mt-3 w-full py-3 rounded-2xl glass-card-strong text-foreground font-bold active:scale-[0.97] transition-transform">
                Back to Map
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayerEncounter;
