import { useState, useEffect } from "react";
import { X, Swords, Trophy, ChevronRight, TrendingUp, TrendingDown, RotateCcw } from "lucide-react";
import type { Player, Rival } from "@/data/mockData";
import { useGameProgress } from "@/context/GameProgressContext";
import { recalculateLeaderboard, submitChallengeResult } from "@/lib/apiService";
import AnimatedPortrait from "./AnimatedPortrait";

interface ChallengeFlowProps {
  rival: Rival;
  rivalPlayer: Player;
  onClose: () => void;
}

type ChallengeStep = "setup" | "battle" | "result";
type ChallengeResult = "win" | "lose" | "draw";

function computeMatchScore(p: Player): number {
  const base = p.stats.overall * 2 + p.level * 3;
  const attr = (p.attributes.confidence + p.attributes.form + p.attributes.morale) / 3;
  return base + attr + Math.random() * 30;
}

const ChallengeFlow = ({ rival, rivalPlayer, onClose }: ChallengeFlowProps) => {
  const [step, setStep] = useState<ChallengeStep>("setup");
  const [result, setResult] = useState<ChallengeResult | null>(null);
  const [battleProgress, setBattleProgress] = useState(0);
  const [resultError, setResultError] = useState<string | null>(null);
  const { userId, activePlayer, refreshOwnedPlayers } = useGameProgress();

  const statComparisons = [
    { label: "Overall", you: activePlayer.stats.overall, them: rivalPlayer.stats.overall },
    { label: "Level", you: activePlayer.level, them: rivalPlayer.level },
    { label: "Confidence", you: activePlayer.attributes.confidence, them: rivalPlayer.attributes.confidence },
    { label: "Form", you: activePlayer.attributes.form, them: rivalPlayer.attributes.form },
    { label: "Morale", you: activePlayer.attributes.morale, them: rivalPlayer.attributes.morale },
  ];

  const rewards = {
    win: { xp: 30, fp: 2, confidence: 3 },
    draw: { xp: 10, fp: 1, confidence: 1 },
    lose: { xp: 5, fp: 0, confidence: -1 },
  };

  // Battle simulation
  useEffect(() => {
    if (step !== "battle") return;
    const interval = setInterval(() => {
      setBattleProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          return 100;
        }
        return p + Math.random() * 12 + 4;
      });
    }, 350);
    return () => clearInterval(interval);
  }, [step]);

  useEffect(() => {
    if (step === "battle" && battleProgress >= 100) {
      const t = setTimeout(() => {
        const persistResult = async () => {
        const yourScore = computeMatchScore(activePlayer);
        const theirScore = computeMatchScore(rivalPlayer);
        const diff = yourScore - theirScore;
        const r: ChallengeResult = diff > 5 ? "win" : diff < -5 ? "lose" : "draw";
        setResult(r);

        setResultError(null);
        try {
          await submitChallengeResult({
            userId,
            playerId: activePlayer.id,
            result: r === "lose" ? "loss" : r,
            opponentPower: Math.max(0, Math.round(theirScore)),
            region: "CONCACAF · NA",
            opponentUserId: rival.name,
          });
          await recalculateLeaderboard("global", undefined, userId);
          await recalculateLeaderboard("region", "CONCACAF · NA", userId);
          await refreshOwnedPlayers();
        } catch (error) {
          setResultError(error instanceof Error ? error.message : "Failed to persist challenge");
        }

        setStep("result");
        };
        void persistResult();
      }, 500);
      return () => clearTimeout(t);
    }
  }, [step, battleProgress, activePlayer, refreshOwnedPlayers, rival.name, userId]);

  const startBattle = () => {
    setBattleProgress(0);
    setStep("battle");
  };

  return (
    <div className="fixed inset-0 z-[1350] flex items-center justify-center bg-background/70 backdrop-blur-xl p-4" onClick={onClose}>
      <div className="glass-card-strong w-full max-w-sm rounded-3xl overflow-hidden animate-encounter-reveal" onClick={(e) => e.stopPropagation()}>
        {/* Close */}
        <button type="button" onClick={onClose}
          className="absolute top-4 right-4 z-50 flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/60">
          <X className="h-5 w-5" />
        </button>

        {step === "setup" && (
          <div className="p-5 animate-fade-in">
            <div className="text-center mb-4">
              <Swords className="w-6 h-6 text-primary mx-auto mb-1" />
              <h2 className="text-lg font-black text-foreground">Challenge</h2>
              <p className="text-[10px] text-muted-foreground">@{rival.name} · Level {rival.level}</p>
            </div>

            {/* Head to head */}
            <div className="flex items-start justify-center gap-3 mb-4">
              <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                <AnimatedPortrait player={activePlayer} size="md" />
                <p className="text-[10px] font-black text-foreground truncate w-full text-center">{activePlayer.name}</p>
                <p className="text-[9px] text-muted-foreground">{activePlayer.position}</p>
              </div>
              <div className="flex flex-col items-center pt-3 shrink-0">
                <span className="text-xs font-black text-primary">VS</span>
              </div>
              <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                <AnimatedPortrait player={rivalPlayer} size="md" />
                <p className="text-[10px] font-black text-foreground truncate w-full text-center">{rivalPlayer.name}</p>
                <p className="text-[9px] text-muted-foreground">{rivalPlayer.position}</p>
              </div>
            </div>

            {/* Stat comparison */}
            <div className="space-y-1.5 mb-4">
              {statComparisons.map(({ label, you, them }) => {
                const sum = you + them || 1;
                const youPct = (you / sum) * 100;
                return (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-foreground w-6 text-right">{you}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden flex">
                      <div className="h-full bg-primary rounded-l-full" style={{ width: `${youPct}%` }} />
                      <div className="h-full bg-destructive/60 rounded-r-full" style={{ width: `${100 - youPct}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-foreground w-6">{them}</span>
                    <span className="text-[8px] text-muted-foreground w-16">{label}</span>
                  </div>
                );
              })}
            </div>

            {/* Rewards preview */}
            <div className="glass-card p-3 rounded-xl mb-4 flex items-center justify-center gap-2">
              <Trophy className="w-4 h-4 text-accent shrink-0" />
              <span className="text-[11px] font-bold text-accent">Win: +30 XP · +2 FP · +3 Confidence</span>
            </div>

            <button type="button" onClick={startBattle}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-primary text-primary-foreground font-black text-sm flex items-center justify-center gap-2 glow-primary active:scale-[0.97] transition-transform">
              <Swords className="w-4 h-4" /> Start Challenge <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === "battle" && (
          <div className="relative overflow-hidden">
            {/* Stadium atmosphere */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 0%, hsl(var(--primary)/0.08), transparent 70%)" }} />
            </div>
            <div className="p-5 text-center animate-fade-in">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">
                {battleProgress < 30 ? "Analyzing matchup…" : battleProgress < 60 ? "Stats in collision…" : battleProgress < 90 ? "Deciding the outcome…" : "Locking in result!"}
              </p>
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className={`transition-all duration-300 ${battleProgress > 20 ? "scale-105" : ""}`}>
                  <AnimatedPortrait player={activePlayer} size="lg" />
                  <p className="text-[9px] font-black text-foreground mt-1.5 text-center truncate max-w-[5rem] mx-auto">{activePlayer.name.split(" ").pop()}</p>
                </div>
                <div className="flex flex-col items-center gap-1 shrink-0 w-12">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "hsl(var(--primary)/0.15)", border: "1px solid hsl(var(--primary)/0.3)" }}>
                    <Swords className={`w-4 h-4 text-primary ${battleProgress < 100 ? "animate-pulse" : ""}`} />
                  </div>
                  <span className="text-[8px] font-black text-primary uppercase tracking-widest">VS</span>
                </div>
                <div className={`transition-all duration-300 ${battleProgress > 20 ? "scale-105" : ""}`}>
                  <AnimatedPortrait player={rivalPlayer} size="lg" />
                  <p className="text-[9px] font-black text-foreground mt-1.5 text-center truncate max-w-[5rem] mx-auto">{rivalPlayer.name.split(" ").pop()}</p>
                </div>
              </div>
              <div className="relative mx-auto max-w-[240px] mb-2">
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(battleProgress, 100)}%`,
                      background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary)/0.7))",
                      boxShadow: "0 0 12px hsl(var(--primary)/0.5)",
                    }} />
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground">{Math.round(Math.min(battleProgress, 100))}%</p>
            </div>
          </div>
        )}

        {step === "result" && result && (
          <div className="p-5 text-center animate-fade-in">
            <div className="text-5xl mb-3">
              {result === "win" ? "🏆" : result === "draw" ? "🤝" : "💔"}
            </div>
            <h2 className={`text-2xl font-black mb-1 ${
              result === "win" ? "text-primary" : result === "draw" ? "text-accent" : "text-destructive"
            }`}>
              {result === "win" ? "Victory!" : result === "draw" ? "Draw" : "Defeat"}
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              {result === "win" ? "You dominated the matchup!" : result === "draw" ? "Evenly matched. Keep training." : "They had the edge this time."}
            </p>

            <div className="flex gap-2 justify-center mb-5">
              {[
                { label: `+${rewards[result].xp} XP`, icon: "⭐" },
                { label: `+${rewards[result].fp} FP`, icon: "🎯" },
                {
                  label: `${rewards[result].confidence > 0 ? "+" : ""}${rewards[result].confidence} Conf`,
                  icon: rewards[result].confidence >= 0 ? "📈" : "📉",
                },
              ].map((r) => (
                <div key={r.label} className="glass-card px-3 py-2 rounded-xl">
                  <span className="text-sm">{r.icon}</span>
                  <p className="text-[10px] font-bold text-foreground mt-0.5">{r.label}</p>
                </div>
              ))}
            </div>
            {resultError && (
              <p className="mb-3 text-[10px] text-destructive">{resultError}</p>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={() => { setStep("setup"); setResult(null); setBattleProgress(0); }}
                className="flex-1 py-3 rounded-2xl glass-card-strong text-foreground font-bold text-sm flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform">
                <RotateCcw className="w-3.5 h-3.5" /> Rematch
              </button>
              <button type="button" onClick={onClose}
                className="flex-1 py-3 rounded-2xl bg-primary text-primary-foreground font-black text-sm active:scale-[0.97] transition-transform">
                Continue
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChallengeFlow;
