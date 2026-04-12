import { useState, useEffect, useCallback, useRef } from "react";
import type { Player } from "@/data/mockData";
import { rarityDifficulty } from "@/data/keeperItems";
import AnimatedPortrait from "./AnimatedPortrait";

type Direction = "left" | "center" | "right";
type Phase = "ready" | "runup" | "shoot" | "dive" | "result";

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

/** Position-based difficulty bump — attackers are harder */
function positionDifficultyMod(position: string): number {
  const p = position.toLowerCase();
  if (p.includes("st") || p.includes("cf") || p.includes("striker") || p.includes("forward")) return -120;
  if (p.includes("rw") || p.includes("lw") || p.includes("wing")) return -80;
  if (p.includes("cam") || p.includes("am")) return -50;
  if (p.includes("def") || p.includes("cb") || p.includes("rb") || p.includes("lb")) return 150;
  if (p.includes("gk") || p.includes("keeper")) return 200;
  return 0; // midfielders
}

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
  const [phase, setPhase] = useState<Phase>("ready");
  const [shotDir, setShotDir] = useState<Direction | null>(null);
  const [diveDir, setDiveDir] = useState<Direction | null>(null);
  const [hint, setHint] = useState<Direction | null>(null);
  const [saved, setSaved] = useState<boolean | null>(null);
  const [ballPos, setBallPos] = useState<{ x: number; y: number } | null>(null);
  const [keeperPos, setKeeperPos] = useState(50); // 0-100 horizontal %
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const chosenRef = useRef<Direction>("center");
  const swipeRef = useRef<{ startX: number; startY: number; startTime: number } | null>(null);
  const duelAreaRef = useRef<HTMLDivElement>(null);

  const diff = rarityDifficulty[player.rarity] ?? rarityDifficulty.common;
  const posMod = positionDifficultyMod(player.position);
  const effectiveWindow = Math.max(400, diff.windowMs + gloveTimingBonus + posMod);
  const shotSpeed = slowShot ? diff.shotSpeedMs * 1.35 : diff.shotSpeedMs;

  const pickDirection = useCallback((): Direction => {
    const dirs: Direction[] = ["left", "center", "right"];
    return dirs[Math.floor(Math.random() * dirs.length)];
  }, []);

  // Swipe detection
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (phase !== "shoot" && phase !== "runup") return;
    const t = e.touches[0];
    swipeRef.current = { startX: t.clientX, startY: t.clientY, startTime: Date.now() };
  }, [phase]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!swipeRef.current || (phase !== "shoot" && phase !== "runup")) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - swipeRef.current.startX;
    const dy = t.clientY - swipeRef.current.startY;
    const elapsed = Date.now() - swipeRef.current.startTime;
    swipeRef.current = null;

    // Must be a quick gesture
    if (elapsed > 800) return;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    let dir: Direction;
    if (absDx < 30 && absDy < 30) {
      // Tap = center
      dir = "center";
    } else if (absDx > absDy) {
      dir = dx < 0 ? "left" : "right";
    } else {
      dir = "center"; // upward swipe = center
    }
    executeDive(dir);
  }, [phase]);

  // Mouse/click fallback for desktop
  const handleClickDive = useCallback((dir: Direction) => {
    if (phase !== "shoot" && phase !== "runup") return;
    executeDive(dir);
  }, [phase]);

  const executeDive = useCallback((dir: Direction) => {
    if (phase !== "shoot" && phase !== "runup") return;
    setDiveDir(dir);
    setKeeperPos(dir === "left" ? 15 : dir === "right" ? 85 : 50);
    setPhase("dive");
    clearTimeout(timerRef.current);

    setTimeout(() => {
      const actual = chosenRef.current;
      const isSave = dir === actual || (diveForgiveness && isAdjacent(dir, actual));
      setSaved(isSave);
      setPhase("result");
    }, Math.min(shotSpeed, 500));
  }, [phase, diveForgiveness, shotSpeed]);

  const startDuel = useCallback(() => {
    setPhase("runup");
    setShotDir(null);
    setDiveDir(null);
    setSaved(null);
    setHint(null);
    setBallPos(null);
    setKeeperPos(50);

    const chosen = pickDirection();
    chosenRef.current = chosen;

    if (hintDirection) {
      setTimeout(() => setHint(chosen), 400);
      setTimeout(() => setHint(null), 1000);
    }

    const hasFeint = Math.random() < diff.feintChance;
    const runupDuration = 1200 + Math.random() * 800;

    timerRef.current = setTimeout(() => {
      if (hasFeint) {
        const feintDirs: Direction[] = (["left", "center", "right"] as Direction[]).filter(d => d !== chosen);
        const feintDir = feintDirs[Math.floor(Math.random() * feintDirs.length)];
        setShotDir(feintDir);
        setBallPos(dirToPos(feintDir));
        setPhase("shoot");
        setTimeout(() => {
          setShotDir(chosen);
          setBallPos(dirToPos(chosen));
        }, 220);
      } else {
        setShotDir(chosen);
        setBallPos(dirToPos(chosen));
        setPhase("shoot");
      }

      // Auto-fail if user doesn't dive in time
      timerRef.current = setTimeout(() => {
        setPhase((prev) => {
          if (prev === "shoot") {
            setSaved(false);
            return "result";
          }
          return prev;
        });
      }, effectiveWindow);
    }, runupDuration);
  }, [pickDirection, diff, effectiveWindow, hintDirection]);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    if (phase === "result" && saved !== null) {
      const t = setTimeout(() => {
        if (saved) onSave();
        else onGoal();
      }, 2800);
      return () => clearTimeout(t);
    }
  }, [phase, saved, onSave, onGoal]);

  const diffLabel = player.rarity === "legendary" ? "Extreme" : player.rarity === "epic" ? "Hard" : player.rarity === "rare" ? "Medium" : "Easy";

  return (
    <div
      className="fixed inset-0 z-[1500] flex flex-col bg-background overflow-hidden select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Atmospheric background */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `radial-gradient(ellipse at 50% 30%, hsl(var(--primary) / 0.08), transparent 60%),
                     radial-gradient(ellipse at 50% 90%, hsl(153 70% 20% / 0.15), transparent 50%)`
      }} />

      {/* HUD strip */}
      <div className="relative z-30 flex items-center justify-between px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">🧤</span>
          <span className="text-[10px] font-bold text-foreground/70">{gloveName}</span>
        </div>
        <div className="flex items-center gap-1.5 glass-card px-2.5 py-1 rounded-full">
          <span className="text-sm">🎯</span>
          <span className="text-xs font-black text-accent">{focusPoints}</span>
          <span className="text-[9px] text-muted-foreground">FP</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold text-muted-foreground">Difficulty:</span>
          <span className={`text-[10px] font-black ${
            player.rarity === "legendary" ? "text-accent" :
            player.rarity === "epic" ? "text-glow-epic" :
            player.rarity === "rare" ? "text-glow-rare" : "text-muted-foreground"
          }`}>{diffLabel}</span>
        </div>
      </div>

      {/* Main duel area */}
      <div ref={duelAreaRef} className="relative flex-1 flex flex-col items-center justify-center px-4">
        {/* Player portrait — floating above goal */}
        <div className="relative z-20 mb-4">
          <AnimatedPortrait player={player} size="lg" className={`
            transition-all duration-500
            ${phase === "runup" ? "scale-110" : ""}
            ${phase === "shoot" ? "scale-105 brightness-125" : ""}
            ${phase === "result" && saved ? "opacity-80 scale-95" : ""}
            ${phase === "result" && !saved ? "scale-110 brightness-110" : ""}
          `} />
        </div>

        {/* Player name */}
        <p className="relative z-20 text-lg font-black text-foreground mb-1">{player.name}</p>
        <p className="relative z-20 text-[10px] text-muted-foreground mb-4">
          {player.position} · {player.representedCountry} · {player.clubTeam}
        </p>

        {/* Goal frame */}
        <div className="relative z-20 w-full max-w-xs aspect-[5/3] mx-auto">
          <div className="absolute inset-0 rounded-t-xl overflow-hidden"
            style={{
              border: "2.5px solid hsl(var(--foreground) / 0.2)",
              borderBottom: "none",
              background: "linear-gradient(180deg, hsl(var(--foreground) / 0.03), transparent)",
            }}
          >
            {/* Net */}
            <div className="absolute inset-0 opacity-[0.06]" style={{
              backgroundImage: `repeating-linear-gradient(90deg, hsl(var(--foreground)) 0px, transparent 1px, transparent 16px),
                                repeating-linear-gradient(0deg, hsl(var(--foreground)) 0px, transparent 1px, transparent 16px)`,
            }} />

            {/* Zone dividers */}
            <div className="absolute top-0 bottom-0 left-1/3 w-px bg-foreground/8" />
            <div className="absolute top-0 bottom-0 left-2/3 w-px bg-foreground/8" />

            {/* Hint highlight */}
            {hint && (
              <div className={`absolute top-0 bottom-0 bg-primary/15 animate-pulse transition-all duration-200
                ${hint === "left" ? "left-0 w-1/3" : hint === "center" ? "left-1/3 w-1/3" : "left-2/3 w-1/3"}`}
              />
            )}

            {/* Ball */}
            {ballPos && (phase === "shoot" || phase === "dive" || phase === "result") && (
              <div
                className="absolute w-8 h-8 flex items-center justify-center text-xl transition-all z-10"
                style={{
                  left: `${ballPos.x}%`,
                  top: `${ballPos.y}%`,
                  transform: "translate(-50%, -50%)",
                  transitionDuration: `${shotSpeed}ms`,
                  transitionTimingFunction: "cubic-bezier(0.1, 0, 0.2, 1)",
                }}
              >
                ⚽
              </div>
            )}

            {/* Keeper */}
            <div
              className="absolute bottom-1 w-10 h-12 flex items-end justify-center text-2xl transition-all duration-300 z-20"
              style={{
                left: `${keeperPos}%`,
                transform: `translateX(-50%) ${diveDir === "left" ? "rotate(-35deg)" : diveDir === "right" ? "rotate(35deg)" : ""}`,
              }}
            >
              🧤
            </div>

            {/* Result flash overlay */}
            {phase === "result" && saved && (
              <div className="absolute inset-0 bg-primary/20 animate-pulse rounded-t-xl" />
            )}
            {phase === "result" && saved === false && (
              <div className="absolute inset-0 bg-destructive/15 rounded-t-xl" />
            )}
          </div>

          {/* Grass line */}
          <div className="absolute -bottom-2 inset-x-0 h-6 rounded-b-2xl"
            style={{ background: "linear-gradient(to top, hsl(153 50% 20% / 0.3), transparent)" }} />
        </div>

        {/* Phase messages */}
        <div className="relative z-20 mt-5 text-center min-h-[4rem] flex flex-col items-center justify-center">
          {phase === "ready" && (
            <div className="animate-fade-in">
              <p className="text-sm font-bold text-foreground/90 italic">
                "{getPreDuelLine(player)}"
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">— {player.name}</p>
            </div>
          )}
          {phase === "runup" && (
            <div>
              <p className="text-base font-black text-accent animate-pulse tracking-wide">
                {player.name} is running up…
              </p>
              <p className="text-[10px] text-muted-foreground mt-1 animate-pulse">Swipe or tap to dive!</p>
            </div>
          )}
          {phase === "shoot" && (
            <div>
              <p className="text-xl font-black text-destructive animate-bounce">
                DIVE NOW!
              </p>
              <p className="text-[10px] text-foreground/50 mt-0.5">← Swipe left · Tap center · Swipe right →</p>
            </div>
          )}
          {phase === "dive" && (
            <p className="text-sm font-bold text-primary">
              Diving {diveDir}…
            </p>
          )}
          {phase === "result" && saved === true && (
            <div className="animate-scale-in">
              <p className="text-4xl font-black text-primary mb-2 tracking-tight">SAVE! 🧤</p>
              <p className="text-sm text-foreground/80 italic">"{getPostSaveLine(player)}"</p>
              <p className="text-[10px] text-muted-foreground mt-1">— {player.name}</p>
            </div>
          )}
          {phase === "result" && saved === false && (
            <div className="animate-scale-in">
              <p className="text-4xl font-black text-destructive mb-2 tracking-tight">GOAL ⚽</p>
              <p className="text-sm text-foreground/80 italic">"{getPostGoalLine(player)}"</p>
              <p className="text-[10px] text-muted-foreground mt-1">— {player.name}</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="relative z-30 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {phase === "ready" && (
          <button
            type="button"
            onClick={startDuel}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary to-primary text-primary-foreground font-black text-base glow-primary active:scale-[0.97] transition-transform"
          >
            ⚡ Start Penalty Duel
          </button>
        )}

        {/* Tap fallback buttons for desktop / accessibility */}
        {(phase === "runup" || phase === "shoot") && (
          <div className="flex gap-2">
            {(["left", "center", "right"] as Direction[]).map((dir) => (
              <button
                key={dir}
                type="button"
                onClick={() => handleClickDive(dir)}
                className={`flex-1 py-4 rounded-2xl font-black text-base transition-all active:scale-90 ${
                  phase === "shoot"
                    ? "bg-primary text-primary-foreground glow-primary"
                    : "glass-card-strong text-foreground/60"
                }`}
              >
                <span className="text-xl block">{dir === "left" ? "←" : dir === "right" ? "→" : "↑"}</span>
                <span className="text-[9px] uppercase tracking-wider block mt-0.5 opacity-60">
                  {dir}
                </span>
              </button>
            ))}
          </div>
        )}

        {phase === "result" && (
          <div className={`text-center py-3 rounded-2xl font-bold text-sm ${
            saved ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
          }`}>
            {saved ? "Player recruited! Starting at Level 1 ✨" : "The player escaped…"}
          </div>
        )}
      </div>
    </div>
  );
};

function dirToPos(dir: Direction): { x: number; y: number } {
  if (dir === "left") return { x: 18, y: 35 };
  if (dir === "right") return { x: 82, y: 35 };
  return { x: 50, y: 22 };
}

function isAdjacent(a: Direction, b: Direction): boolean {
  if (a === b) return true;
  if (a === "center" || b === "center") return true;
  return false;
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
