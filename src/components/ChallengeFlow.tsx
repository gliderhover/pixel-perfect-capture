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

type MatchEvent = { text: string; side: "you" | "them" | "neutral"; icon: string };

function shuffleEvents(events: MatchEvent[]): MatchEvent[] {
  // Interleave "you" and "them" events so they don't clump
  const you = events.filter((e) => e.side === "you");
  const them = events.filter((e) => e.side === "them");
  const neutral = events.filter((e) => e.side === "neutral");
  const result: MatchEvent[] = [];
  let yi = 0, ti = 0, ni = 0;
  while (yi < you.length || ti < them.length || ni < neutral.length) {
    if (yi < you.length) result.push(you[yi++]);
    if (ti < them.length) result.push(them[ti++]);
    if (ni < neutral.length) result.push(neutral[ni++]);
  }
  return result;
}

const ChallengeFlow = ({ rival, rivalPlayer, onClose }: ChallengeFlowProps) => {
  const [step, setStep] = useState<ChallengeStep>("setup");
  const [result, setResult] = useState<ChallengeResult | null>(null);
  const [battleProgress, setBattleProgress] = useState(0);
  const [resultError, setResultError] = useState<string | null>(null);
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);
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

  // Battle simulation — reveal one event every 1.3 s
  useEffect(() => {
    if (step !== "battle") return;
    if (matchEvents.length === 0) return;
    const interval = setInterval(() => {
      setRevealedCount((prev) => {
        const next = prev + 1;
        if (next >= matchEvents.length) {
          clearInterval(interval);
          setBattleProgress(100);
        }
        return next;
      });
    }, 1300);
    return () => clearInterval(interval);
  }, [step, matchEvents]);

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
        } finally {
          setStep("result");
        }
        };
        void persistResult();
      }, 500);
      return () => clearTimeout(t);
    }
  }, [step, battleProgress, activePlayer, refreshOwnedPlayers, rival.name, userId]);

  const startBattle = () => {
    const yourName = activePlayer.name.split(" ").pop() ?? activePlayer.name;
    const rivalName = rivalPlayer.name.split(" ").pop() ?? rivalPlayer.name;

    const yourPower =
      activePlayer.stats.overall * 2 +
      activePlayer.attributes.confidence +
      activePlayer.attributes.form +
      activePlayer.attributes.morale;
    const theirPower =
      rivalPlayer.stats.overall * 2 +
      rivalPlayer.attributes.confidence +
      rivalPlayer.attributes.form +
      rivalPlayer.attributes.morale;

    const youTemplates = [
      `⚡ ${yourName} drives forward with pace`,
      "🎯 Pinpoint pass splits the defense",
      `💪 ${yourName} wins the physical battle`,
      "🔥 Clinical finish — top corner!",
      "🛡️ Dominant in the air",
      "⚽ Strike from distance beats the keeper",
    ];
    const themTemplates = [
      "💥 Rival breaks through on the counter",
      `😤 ${rivalName} takes control of midfield`,
      "🎭 Clever movement creates space",
      "⚡ Quick combination catches you off guard",
      "🔴 Pressure telling in the final third",
      "😮 Stunning long-range effort",
    ];
    const neutralTemplates = [
      "🤝 Evenly matched in possession",
      "⏱️ Tension building on the pitch",
    ];

    const toEvent = (text: string, side: "you" | "them" | "neutral"): MatchEvent => ({
      text,
      side,
      icon: text.split(" ")[0],
    });

    let youCount: number, themCount: number;
    if (yourPower > theirPower + 5) {
      youCount = 4;
      themCount = 2;
    } else if (theirPower > yourPower + 5) {
      youCount = 2;
      themCount = 4;
    } else {
      youCount = 3;
      themCount = 3;
    }

    const shuffled = (arr: string[]) => [...arr].sort(() => Math.random() - 0.5);
    const youEvents = shuffled(youTemplates).slice(0, youCount).map((t) => toEvent(t, "you"));
    const themEvents = shuffled(themTemplates).slice(0, themCount).map((t) => toEvent(t, "them"));
    const neutralEvents = shuffled(neutralTemplates).slice(0, 2).map((t) => toEvent(t, "neutral"));

    const events = shuffleEvents([...youEvents, ...themEvents, ...neutralEvents]);

    setMatchEvents(events);
    setRevealedCount(0);
    setBattleProgress(0);
    setStep("battle");
  };

  return (
    <div className="fixed inset-0 z-[1350] flex items-center justify-center bg-background/70 backdrop-blur-xl p-4" onClick={onClose}>
      <div className="relative glass-card-strong w-full max-w-sm rounded-3xl animate-encounter-reveal flex flex-col max-h-[92dvh]" onClick={(e) => e.stopPropagation()}>
        {/* Close button — always visible above scrollable content */}
        <div className="shrink-0 flex justify-end px-3 pt-3 pb-0">
          <button type="button" onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/60">
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* Scrollable content area */}
        <div className="overflow-y-auto flex-1 rounded-b-3xl">

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
                <p className="text-[10px] font-black text-foreground break-words leading-tight w-full text-center">{activePlayer.name}</p>
                <p className="text-[9px] text-muted-foreground">{activePlayer.position}</p>
              </div>
              <div className="flex flex-col items-center pt-3 shrink-0">
                <span className="text-xs font-black text-primary">VS</span>
              </div>
              <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                <AnimatedPortrait player={rivalPlayer} size="md" />
                <p className="text-[10px] font-black text-foreground break-words leading-tight w-full text-center">{rivalPlayer.name}</p>
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
          <div className="relative">
            {/* Stadium atmosphere */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 0%, hsl(var(--primary)/0.08), transparent 70%)" }} />
            </div>
            <div className="p-5 animate-fade-in flex flex-col gap-3">
              {/* Header */}
              <p className="text-[10px] font-black uppercase tracking-widest text-center text-muted-foreground" style={{ fontVariant: "small-caps" }}>
                ⚔️ Live Match
              </p>

              {/* Portraits */}
              <div className="flex items-center justify-center gap-4">
                <div className="flex flex-col items-center gap-1">
                  <AnimatedPortrait player={activePlayer} size="md" />
                  <p className="text-[9px] font-black text-foreground break-words leading-tight max-w-[5rem] text-center">
                    {activePlayer.name}
                  </p>
                </div>
                <div className="flex flex-col items-center shrink-0">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "hsl(var(--primary)/0.15)", border: "1px solid hsl(var(--primary)/0.3)" }}>
                    <Swords className="w-3.5 h-3.5 text-primary animate-pulse" />
                  </div>
                  <span className="text-[8px] font-black text-primary uppercase tracking-widest mt-0.5">VS</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <AnimatedPortrait player={rivalPlayer} size="md" />
                  <p className="text-[9px] font-black text-foreground break-words leading-tight max-w-[5rem] text-center">
                    {rivalPlayer.name}
                  </p>
                </div>
              </div>

              {/* Events ticker */}
              <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto pr-1" style={{ scrollBehavior: "smooth" }}>
                {matchEvents.slice(0, revealedCount).map((event, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold animate-fade-in"
                    style={{
                      animationDuration: "0.4s",
                      background:
                        event.side === "you"
                          ? "hsl(var(--primary)/0.15)"
                          : event.side === "them"
                          ? "hsl(var(--destructive)/0.15)"
                          : "hsl(var(--muted))",
                      color:
                        event.side === "you"
                          ? "hsl(var(--primary))"
                          : event.side === "them"
                          ? "hsl(var(--destructive))"
                          : "hsl(var(--muted-foreground))",
                      border:
                        event.side === "you"
                          ? "1px solid hsl(var(--primary)/0.3)"
                          : event.side === "them"
                          ? "1px solid hsl(var(--destructive)/0.3)"
                          : "1px solid hsl(var(--border))",
                    }}
                  >
                    <span>{event.icon}</span>
                    <span>{event.text.replace(/^\S+\s/, "")}</span>
                  </div>
                ))}
                {revealedCount < matchEvents.length && (
                  <div className="flex items-center gap-1 px-3 py-1 text-[9px] text-muted-foreground animate-pulse">
                    <span>●</span><span>●</span><span>●</span>
                  </div>
                )}
              </div>

              {/* Full time banner */}
              {battleProgress >= 100 && (
                <div className="text-center py-1 animate-fade-in">
                  <span className="text-[10px] font-black uppercase tracking-widest text-accent">⏱ Full Time</span>
                </div>
              )}
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
              <button type="button" onClick={() => { setStep("setup"); setResult(null); setBattleProgress(0); setMatchEvents([]); setRevealedCount(0); }}
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
    </div>
  );
};

export default ChallengeFlow;
