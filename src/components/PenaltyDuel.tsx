import { useState, useEffect, useCallback, useRef } from "react";
import type { Player } from "@/data/mockData";
import { rarityDifficulty } from "@/data/keeperItems";
import AnimatedPortrait from "./AnimatedPortrait";
import { fetchDuelLine } from "@/lib/apiService";

type Direction = "left" | "center" | "right";
type Phase = "intro" | "ready" | "runup" | "shoot" | "dive" | "save" | "goal";

interface PenaltyDuelProps {
  player: Player;
  gloveTimingBonus?: number;
  diveForgiveness?: boolean;
  slowShot?: boolean;
  hintDirection?: boolean;
  focusPoints: number;
  gloveName: string;
  onSave: () => void;
  onGoal: () => void;
}

function positionDifficultyMod(position: string): number {
  const p = position.toLowerCase();
  if (p.includes("st") || p.includes("cf") || p.includes("striker") || p.includes("forward")) return -120;
  if (p.includes("rw") || p.includes("lw") || p.includes("wing")) return -80;
  if (p.includes("cam") || p.includes("am")) return -50;
  if (p.includes("def") || p.includes("cb") || p.includes("rb") || p.includes("lb")) return 150;
  if (p.includes("gk") || p.includes("keeper")) return 200;
  return 0;
}

const ballTargetPos: Record<Direction, { left: string; top: string }> = {
  left: { left: "18%", top: "32%" },
  center: { left: "50%", top: "20%" },
  right: { left: "82%", top: "32%" },
};

const PenaltyDuel = ({
  player,
  gloveTimingBonus = 0,
  diveForgiveness = false,
  slowShot = false,
  hintDirection = false,
  focusPoints,
  gloveName,
  onSave,
  onGoal,
}: PenaltyDuelProps) => {
  const [phase, setPhase] = useState<Phase>("intro");
  const [shotDir, setShotDir] = useState<Direction | null>(null);
  const [diveDir, setDiveDir] = useState<Direction | null>(null);
  const [hint, setHint] = useState<Direction | null>(null);
  const [preLine, setPreLine] = useState(() => getPreDuelLine(player));
  const [postSaveLine, setPostSaveLine] = useState(() => getPostSaveLine(player));
  const [postGoalLine, setPostGoalLine] = useState(() => getPostGoalLine(player));
  const [powerPct, setPowerPct] = useState(0);
  const [capturedPower, setCapturedPower] = useState<number | null>(null);
  const powerDirRef = useRef(1);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const chosenRef = useRef<Direction>("center");
  const swipeRef = useRef<{ x: number; y: number; t: number } | null>(null);

  const diff = rarityDifficulty[player.rarity] ?? rarityDifficulty.common;
  const posMod = positionDifficultyMod(player.position);
  const effectiveWindow = Math.max(400, diff.windowMs + gloveTimingBonus + posMod);
  const shotSpeed = slowShot ? diff.shotSpeedMs * 1.35 : diff.shotSpeedMs;
  const diffLabel = player.rarity === "legendary" ? "Extreme" : player.rarity === "epic" ? "Hard" : player.rarity === "rare" ? "Medium" : "Easy";

  // Intro → ready after cinematic beat
  useEffect(() => {
    if (phase === "intro") {
      const t = setTimeout(() => setPhase("ready"), 2200);
      return () => clearTimeout(t);
    }
  }, [phase]);

  useEffect(() => {
    let cancelled = false;
    const loadPreLine = async () => {
      try {
        const ai = await fetchDuelLine({
          playerName: player.name,
          playerPosition: player.position,
          rarity: player.rarity,
        });
        if (!cancelled && ai.line) setPreLine(ai.line);
      } catch {
        // keep deterministic fallback
      }
    };
    void loadPreLine();
    return () => {
      cancelled = true;
    };
  }, [player.name, player.position, player.rarity]);

  useEffect(() => {
    let cancelled = false;
    const loadPostLine = async (result: "save" | "goal") => {
      try {
        const ai = await fetchDuelLine({
          playerName: player.name,
          playerPosition: player.position,
          rarity: player.rarity,
          result,
        });
        if (cancelled || !ai.line) return;
        if (result === "save") setPostSaveLine(ai.line);
        else setPostGoalLine(ai.line);
      } catch {
        // keep deterministic fallback
      }
    };
    if (phase === "save") void loadPostLine("save");
    if (phase === "goal") void loadPostLine("goal");
    return () => {
      cancelled = true;
    };
  }, [phase, player.name, player.position, player.rarity]);

  const pickDirection = useCallback((): Direction => {
    const dirs: Direction[] = ["left", "center", "right"];
    return dirs[Math.floor(Math.random() * dirs.length)];
  }, []);

  const startDuel = useCallback(() => {
    setPhase("runup");
    setShotDir(null);
    setDiveDir(null);
    setHint(null);
    const chosen = pickDirection();
    chosenRef.current = chosen;

    if (hintDirection) {
      setTimeout(() => setHint(chosen), 500);
      setTimeout(() => setHint(null), 1200);
    }

    const hasFeint = Math.random() < diff.feintChance;
    const runupMs = 1400 + Math.random() * 800;

    timerRef.current = setTimeout(() => {
      if (hasFeint) {
        const feintDirs = (["left", "center", "right"] as Direction[]).filter(d => d !== chosen);
        const feintDir = feintDirs[Math.floor(Math.random() * feintDirs.length)];
        setShotDir(feintDir);
        setPhase("shoot");
        setTimeout(() => setShotDir(chosen), 200);
      } else {
        setShotDir(chosen);
        setPhase("shoot");
      }
      // Auto-fail
      timerRef.current = setTimeout(() => {
        setPhase(prev => {
          if (prev === "shoot") { setShotDir(chosenRef.current); return "goal"; }
          return prev;
        });
      }, effectiveWindow);
    }, runupMs);
  }, [pickDirection, diff, effectiveWindow, hintDirection]);

  const executeDive = useCallback((dir: Direction) => {
    if (phase !== "shoot" && phase !== "runup") return;
    setCapturedPower(powerPct);
    setDiveDir(dir);
    setPhase("dive");
    clearTimeout(timerRef.current);

    setTimeout(() => {
      const actual = chosenRef.current;
      // If shot hasn't been revealed yet, set it
      setShotDir(actual);
      const isSave = dir === actual || (diveForgiveness && isAdjacent(dir, actual));
      setPhase(isSave ? "save" : "goal");
    }, Math.min(shotSpeed, 450));
  }, [phase, diveForgiveness, shotSpeed]);

  // Swipe handling
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (phase !== "shoot" && phase !== "runup") return;
    const t = e.touches[0];
    swipeRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  }, [phase]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!swipeRef.current || (phase !== "shoot" && phase !== "runup")) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - swipeRef.current.x;
    const elapsed = Date.now() - swipeRef.current.t;
    swipeRef.current = null;
    if (elapsed > 800) return;

    let dir: Direction;
    if (Math.abs(dx) < 35) dir = "center";
    else dir = dx < 0 ? "left" : "right";
    executeDive(dir);
  }, [phase, executeDive]);

  // Oscillating power bar during shoot phase
  useEffect(() => {
    if (phase !== "shoot") { setPowerPct(0); return; }
    setPowerPct(20);
    const tick = setInterval(() => {
      setPowerPct((prev) => {
        const next = prev + powerDirRef.current * 4;
        if (next >= 100) { powerDirRef.current = -1; return 100; }
        if (next <= 0)   { powerDirRef.current =  1; return 0;   }
        return next;
      });
    }, 40);
    return () => clearInterval(tick);
  }, [phase]);

  // Auto-transition only on goal — save now has explicit buttons
  useEffect(() => {
    if (phase === "goal") {
      const t = setTimeout(() => onGoal(), 3200);
      return () => clearTimeout(t);
    }
  }, [phase, onGoal]);

  useEffect(() => { return () => clearTimeout(timerRef.current); }, []);

  const rarityColor = {
    legendary: "hsl(42 95% 55%)",
    epic: "hsl(270 60% 55%)",
    rare: "hsl(210 80% 55%)",
    common: "hsl(var(--muted-foreground))",
  }[player.rarity];

  // ========================= RENDER =========================
  return (
    <div
      className="fixed inset-0 z-[1500] flex flex-col overflow-hidden select-none"
      style={{ background: "hsl(225 35% 4%)" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Stadium atmosphere layers */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Pitch gradient */}
        <div className="absolute inset-x-0 bottom-0 h-[45%]"
          style={{ background: "linear-gradient(to top, hsl(153 40% 8% / 0.5), transparent)" }} />
        {/* Stadium light cones */}
        <div className="absolute top-0 left-[15%] w-32 h-60 animate-duel-stadium-pulse"
          style={{ background: "linear-gradient(180deg, hsl(45 80% 90% / 0.04), transparent)", transform: "rotate(-8deg)" }} />
        <div className="absolute top-0 right-[15%] w-32 h-60 animate-duel-stadium-pulse"
          style={{ background: "linear-gradient(180deg, hsl(45 80% 90% / 0.04), transparent)", transform: "rotate(8deg)", animationDelay: "1.5s" }} />
        {/* Rarity ambience */}
        <div className="absolute inset-0" style={{
          background: `radial-gradient(ellipse at 50% 25%, ${rarityColor} / 0.06, transparent 55%)`
        }} />
        {/* Vignette */}
        <div className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 50% 50%, transparent 40%, hsl(225 35% 2% / 0.7) 100%)" }} />
      </div>

      {/* ─── INTRO CINEMATIC ─── */}
      {phase === "intro" && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center px-8">
          {/* Spotlight sweep */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-0 w-40 h-full opacity-[0.04] animate-duel-spotlight"
              style={{ background: "linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.8), transparent)", width: "30%" }} />
          </div>
          <div className="animate-encounter-reveal">
            <AnimatedPortrait player={player} size="xl" className="mb-4" />
          </div>
          <p className={`text-[10px] font-black uppercase tracking-[0.2em] mt-2 ${
            player.rarity === "legendary" ? "text-accent" :
            player.rarity === "epic" ? "text-glow-epic" :
            player.rarity === "rare" ? "text-glow-rare" : "text-muted-foreground"
          }`}>{player.rarity} encounter</p>
          <h2 className="text-3xl font-black text-foreground mt-1 tracking-tight animate-fade-in-up">{player.name}</h2>
          <p className="text-xs text-muted-foreground mt-1 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
            {player.position} · {player.representedCountry}
          </p>
          <div className="mt-6 animate-fade-in-up" style={{ animationDelay: "0.6s" }}>
            <p className="text-sm text-foreground/80 italic text-center max-w-[250px] leading-relaxed">
              "{preLine}"
            </p>
            <p className="text-[10px] text-muted-foreground text-center mt-1.5">— {player.name}</p>
          </div>
        </div>
      )}

      {/* ─── HUD (visible from ready onward) ─── */}
      {phase !== "intro" && (
        <div className="relative z-30 flex items-center justify-between px-4 pt-[max(2.75rem,env(safe-area-inset-top))] pb-1.5 animate-fade-in">
          {/* Glove */}
          <div className="flex items-center gap-1.5 glass-card px-2 py-1 rounded-xl">
            <span className="text-sm">🧤</span>
            <span className="text-[9px] font-bold text-foreground/70 max-w-[5rem] truncate">{gloveName}</span>
          </div>
          {/* Difficulty */}
          <div className="text-center">
            <p className="text-[8px] uppercase tracking-widest text-muted-foreground/60">Penalty Duel</p>
            <p className={`text-[10px] font-black ${
              player.rarity === "legendary" ? "text-accent" :
              player.rarity === "epic" ? "text-glow-epic" :
              player.rarity === "rare" ? "text-glow-rare" : "text-muted-foreground"
            }`}>{diffLabel}</p>
          </div>
          {/* Focus Points */}
          <div className="flex items-center gap-1 glass-card px-2 py-1 rounded-xl">
            <span className="text-sm">🎯</span>
            <span className="text-xs font-black text-accent">{focusPoints}</span>
            <span className="text-[8px] text-muted-foreground">FP</span>
          </div>
        </div>
      )}

      {/* ─── MAIN DUEL AREA ─── */}
      {phase !== "intro" && (
        <div className="relative flex-1 flex flex-col items-center justify-center px-4">
          {/* Shooter portrait (compact badge above goal) */}
          <div className={`relative z-20 mb-3 transition-all duration-700 ${
            phase === "runup" ? "animate-duel-runup" :
            phase === "shoot" ? "animate-duel-tension" : ""
          }`}>
            <AnimatedPortrait player={player} size="md" className={`
              ${phase === "save" ? "opacity-70 scale-90 transition-all duration-500" : ""}
              ${phase === "goal" ? "scale-105 transition-all duration-500" : ""}
            `} />
            {/* Rarity ring */}
            <div className="absolute -inset-1 rounded-full pointer-events-none" style={{
              boxShadow: `0 0 20px ${rarityColor} / 0.25, 0 0 60px ${rarityColor} / 0.08`,
            }} />
          </div>

          <p className="relative z-20 text-sm font-black text-foreground mb-0.5">{player.name}</p>
          <p className="relative z-20 text-[9px] text-muted-foreground mb-4">
            {player.position} · {player.nationalTeam}
          </p>

          {/* ─── GOAL FRAME ─── */}
          <div className={`relative z-20 w-full max-w-[320px] aspect-[5/3] mx-auto ${
            phase === "save" ? "animate-duel-save-shake" : ""
          }`}>
            {/* Frame structure */}
            <div className="absolute inset-0 rounded-t-2xl overflow-hidden"
              style={{
                border: "3px solid hsl(var(--foreground) / 0.15)",
                borderBottom: "3px solid hsl(var(--foreground) / 0.1)",
                background: "linear-gradient(175deg, hsl(var(--foreground) / 0.04) 0%, transparent 60%)",
              }}>

              {/* Net pattern */}
              <div className="absolute inset-0 opacity-[0.04]" style={{
                backgroundImage: `repeating-linear-gradient(90deg, hsl(var(--foreground)) 0px, transparent 1px, transparent 14px),
                                  repeating-linear-gradient(0deg, hsl(var(--foreground)) 0px, transparent 1px, transparent 14px)`,
              }} />

              {/* Zone lines */}
              <div className="absolute top-0 bottom-0 left-[33.3%] w-px bg-foreground/5" />
              <div className="absolute top-0 bottom-0 left-[66.6%] w-px bg-foreground/5" />

              {/* Hint zone highlight */}
              {hint && (
                <div className={`absolute top-0 bottom-0 rounded-sm transition-all duration-200 ${
                  hint === "left" ? "left-0 w-[33.3%]" :
                  hint === "center" ? "left-[33.3%] w-[33.3%]" : "left-[66.6%] w-[33.3%]"
                }`} style={{ background: `${rarityColor} / 0.12` }} />
              )}

              {/* Ball */}
              {shotDir && (phase === "shoot" || phase === "dive" || phase === "save" || phase === "goal") && (
                <div
                  className="absolute w-9 h-9 flex items-center justify-center text-2xl animate-duel-ball-flight z-10"
                  style={{
                    left: ballTargetPos[shotDir].left,
                    top: ballTargetPos[shotDir].top,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <span className="drop-shadow-lg">⚽</span>
                </div>
              )}

              {/* Keeper gloves */}
              <div className={`absolute bottom-1 left-1/2 -translate-x-1/2 text-3xl z-20 transition-all
                ${diveDir === "left" ? "animate-duel-dive-left" : ""}
                ${diveDir === "right" ? "animate-duel-dive-right" : ""}
                ${diveDir === "center" ? "animate-duel-dive-center" : ""}
                ${!diveDir ? "" : ""}
              `}>
                🧤
              </div>

              {/* Save burst effect */}
              {phase === "save" && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full animate-duel-save-burst"
                    style={{ background: `radial-gradient(circle, hsl(var(--primary) / 0.5), transparent)` }} />
                </div>
              )}

              {/* Goal flash */}
              {phase === "goal" && (
                <div className="absolute inset-0 bg-destructive/20 animate-duel-goal-flash rounded-t-2xl" />
              )}
            </div>

            {/* Grass edge */}
            <div className="absolute -bottom-3 inset-x-0 h-6 rounded-b-xl"
              style={{ background: "linear-gradient(to top, hsl(153 45% 15% / 0.35), transparent)" }} />

            {/* Penalty spot */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-foreground/15" />
          </div>

          {/* ─── PHASE MESSAGES ─── */}
          <div className="relative z-20 mt-4 text-center min-h-0 flex-1 overflow-y-auto flex flex-col items-center justify-center px-4">
            {phase === "ready" && (
              <div className="animate-fade-in-up">
                <p className="text-sm text-foreground/80 italic max-w-[260px] leading-relaxed">
                  "{preLine}"
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">— {player.name}</p>
                {gloveName && gloveName !== "Basic Gloves" && (
                  <p className="text-[10px] text-emerald-400 mt-2 font-bold">🧤 {gloveName} active — wider save window</p>
                )}
              </div>
            )}
            {phase === "runup" && (
              <div className="animate-fade-in">
                <p className="text-base font-black tracking-wide animate-pulse" style={{ color: rarityColor }}>
                  Running up…
                </p>
                <p className="text-[10px] text-foreground/40 mt-1">Get ready to dive</p>
              </div>
            )}
            {phase === "shoot" && (
              <div className="animate-fade-in w-full max-w-[280px]">
                <p className="text-2xl font-black text-foreground tracking-tight animate-bounce mb-3">
                  DIVE NOW!
                </p>
                {/* Power bar */}
                <div className="relative h-5 rounded-full overflow-hidden mb-1" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
                  {/* Sweet spot zone (35-70%) */}
                  <div className="absolute top-0 bottom-0 rounded-full" style={{ left: "35%", width: "35%", background: "rgba(34,197,94,0.25)" }} />
                  {/* Moving bar */}
                  <div className="absolute top-0 bottom-0 w-3 rounded-full transition-none"
                    style={{
                      left: `${Math.max(0, powerPct - 2)}%`,
                      background: powerPct >= 35 && powerPct <= 70
                        ? "linear-gradient(90deg,#22c55e,#86efac)"
                        : powerPct > 85
                        ? "linear-gradient(90deg,#ef4444,#fca5a5)"
                        : "linear-gradient(90deg,#f59e0b,#fcd34d)",
                      boxShadow: powerPct >= 35 && powerPct <= 70 ? "0 0 8px rgba(34,197,94,0.8)" : "none",
                    }}
                  />
                  {/* Labels */}
                  <span className="absolute left-[35%] top-0 bottom-0 flex items-center justify-center text-[7px] font-black text-emerald-400/80 pointer-events-none w-[35%]">SWEET SPOT</span>
                </div>
                <div className="flex justify-between text-[8px] text-foreground/30 mb-2">
                  <span>Weak</span><span>Perfect</span><span>Wild</span>
                </div>
                <p className="text-[10px] text-foreground/30">← Swipe left · Tap center · Swipe right →</p>
              </div>
            )}
            {phase === "dive" && (
              <p className="text-sm font-bold text-primary animate-fade-in">Diving {diveDir}…</p>
            )}
            {phase === "save" && (
              <div className="animate-duel-result-slam text-center">
                <p className="text-5xl font-black text-primary mb-2 tracking-tighter">SAVE!</p>
                {diveDir && shotDir && (
                  <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
                    <span className="text-[10px] px-2.5 py-1 rounded-full font-black bg-primary/20 text-primary">
                      Dived {diveDir} · Ball {shotDir} ✓
                    </span>
                    {capturedPower !== null && (
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-black ${capturedPower >= 35 && capturedPower <= 70 ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
                        {capturedPower >= 35 && capturedPower <= 70 ? "⚡ Perfect timing!" : capturedPower > 85 ? "🔥 Wild shot!" : "💨 Weak shot"}
                      </span>
                    )}
                  </div>
                )}
                <p className="text-sm text-foreground/80 italic max-w-[250px]">"{postSaveLine}"</p>
                <p className="text-[10px] text-muted-foreground mt-1">— {player.name}</p>
              </div>
            )}
            {phase === "goal" && (
              <div className="animate-duel-result-slam text-center">
                <p className="text-5xl font-black text-destructive mb-2 tracking-tighter">GOAL</p>
                <p className="text-sm text-foreground/80 italic max-w-[250px]">"{postGoalLine}"</p>
                <p className="text-[10px] text-muted-foreground mt-1">— {player.name}</p>
                {/* Coaching tip */}
                <p className="text-[11px] text-amber-400 mt-3 max-w-[260px] leading-relaxed font-semibold">
                  💡{" "}
                  {!diveDir
                    ? "You didn't dive in time! Commit to a direction the moment the player starts their run-up."
                    : diveDir !== shotDir
                    ? `You dived ${diveDir} but the ball went ${shotDir}. Watch the player's planted foot and hips — they reveal the direction.`
                    : "Close! Stay composed and react to the body shape, not the feint."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── BOTTOM CONTROLS ─── */}
      {phase !== "intro" && (
        <div className="relative z-30 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {phase === "ready" && (
            <button type="button" onClick={startDuel}
              className="w-full py-4 rounded-2xl font-black text-base active:scale-[0.97] transition-all animate-duel-ready-pulse"
              style={{
                background: `linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))`,
                color: "hsl(var(--primary-foreground))",
                boxShadow: `0 0 30px hsl(var(--primary) / 0.3), 0 4px 20px rgba(0,0,0,0.3)`,
              }}>
              ⚡ Take the Penalty
            </button>
          )}

          {(phase === "runup" || phase === "shoot") && (
            <div className="flex gap-2">
              {(["left", "center", "right"] as Direction[]).map((dir) => (
                <button key={dir} type="button"
                  onClick={() => executeDive(dir)}
                  className={`flex-1 py-4 rounded-2xl font-black text-base transition-all active:scale-90 ${
                    phase === "shoot"
                      ? "text-primary-foreground"
                      : "glass-card-strong text-foreground/50"
                  }`}
                  style={phase === "shoot" ? {
                    background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))",
                    boxShadow: "0 0 20px hsl(var(--primary) / 0.25)",
                  } : undefined}>
                  <span className="text-2xl block">{dir === "left" ? "←" : dir === "right" ? "→" : "↑"}</span>
                  <span className="text-[8px] uppercase tracking-widest block mt-0.5 opacity-50">{dir}</span>
                </button>
              ))}
            </div>
          )}

          {phase === "save" && (
            <div className="flex flex-col gap-2 animate-fade-in-up">
              <button
                type="button"
                onClick={onSave}
                className="w-full py-4 rounded-2xl font-black text-sm active:scale-[0.97] transition-transform"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))",
                  color: "hsl(var(--primary-foreground))",
                  boxShadow: "0 0 24px hsl(var(--primary) / 0.3)",
                }}
              >
                Add to Squad →
              </button>
              <button
                type="button"
                onClick={onSave}
                className="w-full py-3 rounded-2xl glass-card-strong text-foreground font-bold text-sm active:scale-[0.97] transition-transform"
              >
                🗺️ Catch more players
              </button>
            </div>
          )}

          {phase === "goal" && (
            <div className="flex flex-col gap-2 animate-fade-in-up">
              <div className="text-center py-3 rounded-2xl font-bold text-sm"
                style={{ background: "hsl(var(--destructive) / 0.1)", color: "hsl(var(--destructive))" }}>
                {!diveDir
                  ? "⏱️ Too slow — you didn't dive!"
                  : diveDir !== shotDir
                  ? `Wrong side — ${player.name.split(" ")[0]} went ${shotDir}`
                  : "They found the corner — unlucky!"}
              </div>
              <button
                type="button"
                onClick={onGoal}
                className="w-full py-3.5 rounded-2xl glass-card-strong text-foreground font-black text-sm active:scale-[0.97] transition-transform"
              >
                🗺️ Scout another player →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function isAdjacent(a: Direction, b: Direction): boolean {
  return a === b || a === "center" || b === "center";
}

function getPreDuelLine(player: Player): string {
  const pos = player.position.toLowerCase();
  const isAttacker = pos.includes("st") || pos.includes("cf") || pos.includes("fw") || pos.includes("wing") || pos.includes("rw") || pos.includes("lw");
  const lines: Record<string, string[]> = {
    legendary: [
      "You'll need fast hands for this one.",
      "I do not miss from here.",
      "Think you can stop me? Let's see.",
      isAttacker ? "This is what I do. Every single time." : "Even I can score from the spot.",
    ],
    epic: [
      "This won't be easy for you.",
      "Ready for a real challenge?",
      "I've scored from here a hundred times.",
      isAttacker ? "Strikers don't miss penalties." : "Watch closely, keeper.",
    ],
    rare: [
      "Let's see what you've got, keeper.",
      "Don't blink.",
      "I'm feeling confident today.",
      "Let's see if you can read me.",
    ],
    common: [
      "Here goes nothing.",
      "I'll give it my best shot.",
      "Let's do this!",
      "I still have something to prove.",
    ],
  };
  const pool = lines[player.rarity] ?? lines.common;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getPostSaveLine(player: Player): string {
  const lines = [
    "That was a real save. I'll join you.",
    "Impressive reflexes. You've earned it.",
    "You read me perfectly. Respect.",
    "Alright… you earned that.",
    "Fair play. I'm on your side now.",
    "A keeper like you? Count me in.",
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

function getPostGoalLine(player: Player): string {
  const lines = [
    "Not this time. Train harder.",
    "Better luck next time, keeper.",
    "Close, but not close enough.",
    "You'll have to do better than that.",
    "Maybe we'll meet again.",
    "Close. Train harder and try again.",
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

export default PenaltyDuel;
