import { useState, useEffect, useCallback, useRef } from "react";
import type { Player } from "@/data/mockData";
import { rarityDifficulty } from "@/data/keeperItems";

type Direction = "left" | "center" | "right";
type Phase = "ready" | "runup" | "shoot" | "dive" | "result";

interface PenaltyDuelProps {
  player: Player;
  gloveTimingBonus?: number;
  diveForgiveness?: boolean;
  slowShot?: boolean;
  hintDirection?: boolean;
  onSave: () => void;
  onGoal: () => void;
}

const directionLabels: Record<Direction, string> = { left: "←", center: "↑", right: "→" };
const directionNames: Record<Direction, string> = { left: "Left", center: "Center", right: "Right" };

const PenaltyDuel = ({
  player,
  gloveTimingBonus = 0,
  diveForgiveness = false,
  slowShot = false,
  hintDirection = false,
  onSave,
  onGoal,
}: PenaltyDuelProps) => {
  const [phase, setPhase] = useState<Phase>("ready");
  const [shotDir, setShotDir] = useState<Direction | null>(null);
  const [diveDir, setDiveDir] = useState<Direction | null>(null);
  const [hint, setHint] = useState<Direction | null>(null);
  const [saved, setSaved] = useState<boolean | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const diff = rarityDifficulty[player.rarity] ?? rarityDifficulty.common;
  const shotSpeed = slowShot ? diff.shotSpeedMs * 1.35 : diff.shotSpeedMs;
  const window = diff.windowMs + gloveTimingBonus;

  const pickDirection = useCallback((): Direction => {
    const dirs: Direction[] = ["left", "center", "right"];
    return dirs[Math.floor(Math.random() * dirs.length)];
  }, []);

  const startDuel = useCallback(() => {
    setPhase("runup");
    setShotDir(null);
    setDiveDir(null);
    setSaved(null);
    setHint(null);

    const chosen = pickDirection();

    if (hintDirection) {
      setTimeout(() => setHint(chosen), 300);
      setTimeout(() => setHint(null), 800);
    }

    const hasFeint = Math.random() < diff.feintChance;

    const runupDuration = 1200 + Math.random() * 600;
    timerRef.current = setTimeout(() => {
      if (hasFeint) {
        const feintDirs: Direction[] = (["left", "center", "right"] as Direction[]).filter(d => d !== chosen);
        const feintDir = feintDirs[Math.floor(Math.random() * feintDirs.length)];
        setShotDir(feintDir);
        setPhase("shoot");
        setTimeout(() => {
          setShotDir(chosen);
        }, 250);
      } else {
        setShotDir(chosen);
        setPhase("shoot");
      }

      timerRef.current = setTimeout(() => {
        setPhase((prev) => {
          if (prev === "shoot") {
            setSaved(false);
            return "result";
          }
          return prev;
        });
      }, window);
    }, runupDuration);
  }, [pickDirection, diff, window, hintDirection, slowShot]);

  const handleDive = useCallback(
    (dir: Direction) => {
      if (phase !== "shoot" && phase !== "runup") return;
      setDiveDir(dir);
      setPhase("dive");
      clearTimeout(timerRef.current);

      setTimeout(() => {
        const actualShot = shotDir;
        if (!actualShot) {
          const chosen = pickDirection();
          setShotDir(chosen);
          const isSave = dir === chosen || (diveForgiveness && isAdjacent(dir, chosen));
          setSaved(isSave);
        } else {
          const isSave = dir === actualShot || (diveForgiveness && isAdjacent(dir, actualShot));
          setSaved(isSave);
        }
        setPhase("result");
      }, shotSpeed);
    },
    [phase, shotDir, diveForgiveness, shotSpeed, pickDirection]
  );

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    if (phase === "result" && saved !== null) {
      const t = setTimeout(() => {
        if (saved) onSave();
        else onGoal();
      }, 2200);
      return () => clearTimeout(t);
    }
  }, [phase, saved, onSave, onGoal]);

  const isAdjacent = (a: Direction, b: Direction): boolean => {
    if (a === b) return true;
    if (a === "center" || b === "center") return true;
    return false;
  };

  const rarityGlow = {
    legendary: "from-accent/30 to-accent/5",
    epic: "from-glow-epic/30 to-glow-epic/5",
    rare: "from-glow-rare/30 to-glow-rare/5",
    common: "from-muted/30 to-muted/5",
  }[player.rarity];

  return (
    <div className="fixed inset-0 z-[1500] flex flex-col bg-background overflow-hidden">
      <div
        className={`absolute inset-0 bg-gradient-radial ${rarityGlow} opacity-60 pointer-events-none`}
        style={{ background: `radial-gradient(ellipse at 50% 70%, hsl(var(--primary) / 0.15), transparent 70%)` }}
      />

      <div className="relative flex-1 flex flex-col items-center justify-center px-4">
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-background to-transparent z-10" />

        <div className="relative z-20 mb-6 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Penalty Duel</p>
          <h2 className="text-2xl font-black text-foreground">{player.name}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {player.position} · {player.clubTeam}
          </p>
          <span
            className={`mt-2 inline-block rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest
              ${player.rarity === "legendary" ? "bg-accent/15 text-accent" : ""}
              ${player.rarity === "epic" ? "bg-glow-epic/15 text-glow-epic" : ""}
              ${player.rarity === "rare" ? "bg-glow-rare/15 text-glow-rare" : ""}
              ${player.rarity === "common" ? "bg-muted text-muted-foreground" : ""}
            `}
          >
            {player.rarity}
          </span>
        </div>

        <div className="relative z-20 w-full max-w-sm aspect-[3/2] mx-auto">
          <div className="absolute inset-0 border-2 border-foreground/20 rounded-t-lg bg-gradient-to-b from-foreground/5 to-transparent">
            <div className="absolute top-0 inset-x-0 h-1 bg-foreground/30 rounded-full" />
            <div className="absolute top-0 bottom-0 left-0 w-1 bg-foreground/30 rounded-full" />
            <div className="absolute top-0 bottom-0 right-0 w-1 bg-foreground/30 rounded-full" />

            <div className="absolute inset-1 opacity-10"
              style={{
                backgroundImage: `repeating-linear-gradient(90deg, hsl(var(--foreground)) 0px, transparent 1px, transparent 20px),
                                  repeating-linear-gradient(0deg, hsl(var(--foreground)) 0px, transparent 1px, transparent 20px)`,
              }}
            />

            <div className="absolute top-0 bottom-0 left-1/3 w-px bg-foreground/10" />
            <div className="absolute top-0 bottom-0 left-2/3 w-px bg-foreground/10" />

            {phase === "shoot" && shotDir && (
              <div
                className={`absolute top-1/4 w-8 h-8 rounded-full bg-destructive animate-ping
                  ${shotDir === "left" ? "left-[15%]" : shotDir === "center" ? "left-1/2 -translate-x-1/2" : "right-[15%]"}`}
              />
            )}

            {(phase === "shoot" || phase === "dive") && shotDir && (
              <div
                className={`absolute w-10 h-10 rounded-full bg-foreground shadow-lg transition-all flex items-center justify-center text-lg
                  ${shotDir === "left" ? "left-[12%] top-[30%]" : shotDir === "center" ? "left-1/2 -translate-x-1/2 top-[25%]" : "right-[12%] top-[30%]"}`}
                style={{ transitionDuration: `${shotSpeed}ms`, transitionTimingFunction: "cubic-bezier(0.2, 0, 0.3, 1)" }}
              >
                ⚽
              </div>
            )}

            {diveDir && (
              <div
                className={`absolute bottom-2 w-14 h-16 transition-all duration-300 flex items-end justify-center text-3xl
                  ${diveDir === "left" ? "left-[8%] -rotate-45" : diveDir === "center" ? "left-1/2 -translate-x-1/2" : "right-[8%] rotate-45"}`}
              >
                🧤
              </div>
            )}

            {hint && (
              <div
                className={`absolute top-0 bottom-0 bg-primary/20 animate-pulse transition-all
                  ${hint === "left" ? "left-0 w-1/3" : hint === "center" ? "left-1/3 w-1/3" : "left-2/3 w-1/3"}`}
              />
            )}
          </div>

          <div className="absolute -bottom-4 inset-x-0 h-8 bg-gradient-to-t from-primary/20 to-transparent rounded-b-2xl" />
        </div>

        <div className="relative z-20 mt-6 text-center min-h-[3rem]">
          {phase === "ready" && (
            <div className="animate-pulse">
              <p className="text-sm font-bold text-foreground/80">
                "{getPreDuelLine(player)}"
              </p>
              <p className="text-xs text-muted-foreground mt-1">— {player.name}</p>
            </div>
          )}
          {phase === "runup" && (
            <p className="text-sm font-bold text-accent animate-pulse">
              {player.name} is running up…
            </p>
          )}
          {phase === "shoot" && (
            <p className="text-lg font-black text-destructive animate-bounce">
              DIVE NOW!
            </p>
          )}
          {phase === "dive" && (
            <p className="text-sm font-bold text-primary">
              Diving {diveDir}…
            </p>
          )}
          {phase === "result" && saved === true && (
            <div className="animate-scale-in">
              <p className="text-3xl font-black text-primary mb-1">SAVE! 🧤</p>
              <p className="text-sm text-foreground/80">"{getPostSaveLine(player)}"</p>
              <p className="text-xs text-muted-foreground mt-0.5">— {player.name}</p>
            </div>
          )}
          {phase === "result" && saved === false && (
            <div className="animate-scale-in">
              <p className="text-3xl font-black text-destructive mb-1">GOAL ⚽</p>
              <p className="text-sm text-foreground/80">"{getPostGoalLine(player)}"</p>
              <p className="text-xs text-muted-foreground mt-0.5">— {player.name}</p>
            </div>
          )}
        </div>
      </div>

      <div className="relative z-30 pb-[max(1.5rem,env(safe-area-inset-bottom))] px-4">
        {phase === "ready" && (
          <button
            type="button"
            onClick={startDuel}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary to-primary text-primary-foreground font-black text-base glow-primary active:scale-[0.97] transition-transform"
          >
            ⚡ Start Penalty Duel
          </button>
        )}

        {(phase === "runup" || phase === "shoot") && (
          <div className="flex gap-2">
            {["left", "center", "right"].map((dir) => (
              <button
                key={dir}
                type="button"
                onClick={() => handleDive(dir as Direction)}
                className={`flex-1 py-5 rounded-2xl font-black text-lg transition-all active:scale-90
                  ${phase === "shoot"
                    ? "bg-primary text-primary-foreground glow-primary animate-pulse"
                    : "glass-card-strong text-foreground/70"
                  }`}
              >
                <span className="text-2xl block">{directionLabels[dir as Direction]}</span>
                <span className="text-[10px] uppercase tracking-wider block mt-1 opacity-70">
                  {directionNames[dir as Direction]}
                </span>
              </button>
            ))}
          </div>
        )}

        {phase === "result" && (
          <div className={`text-center py-3 rounded-2xl font-bold text-sm ${saved ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
            {saved ? "Player recruited! Starting at Level 1" : "The player escaped… try again later"}
          </div>
        )}
      </div>
    </div>
  );
};

function getPreDuelLine(player: Player): string {
  const lines: Record<string, string[]> = {
    legendary: [
      "You'll need fast hands for this one.",
      "Think you can stop me? Let's see.",
      "I don't miss often.",
    ],
    epic: [
      "This won't be easy for you.",
      "Ready for a real challenge?",
      "I've scored from here a hundred times.",
    ],
    rare: [
      "Let's see what you've got, keeper.",
      "Don't blink.",
      "I'm feeling confident today.",
    ],
    common: [
      "Here goes nothing.",
      "I'll give it my best shot.",
      "Let's do this!",
    ],
  };
  const pool = lines[player.rarity] ?? lines.common;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getPostSaveLine(player: Player): string {
  const lines = [
    "That was a real stop. I'll join you.",
    "Impressive reflexes. You've earned it.",
    "Fair play. I'm on your side now.",
    "A keeper like you? I'm in.",
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

function getPostGoalLine(player: Player): string {
  const lines = [
    "Not this time. Train harder.",
    "Better luck next time, keeper.",
    "Close, but not close enough.",
    "Maybe we'll meet again.",
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

export default PenaltyDuel;
