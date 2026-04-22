import { useState, useEffect, useCallback, useRef } from "react";
import type { Player } from "@/data/mockData";
import { rarityDifficulty } from "@/data/keeperItems";
import AnimatedPortrait from "./AnimatedPortrait";
import { fetchDuelLine } from "@/lib/apiService";

type Direction = "left" | "center" | "right";
type GoalZone = "tl" | "tc" | "tr" | "bl" | "bc" | "br";
type ShotType = "high" | "curve" | "speed";
type RoleMode = "kick" | "defend";
type Phase = "intro" | "ready" | "role" | "setup" | "runup" | "shoot" | "dive" | "result";
type DuelOutcome = "goal" | "save" | "missed" | "woodwork" | "deflected" | "close-miss";

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
  const [roleMode, setRoleMode] = useState<RoleMode | null>(null);
  const [shotZone, setShotZone] = useState<GoalZone | null>(null);
  const [diveDir, setDiveDir] = useState<Direction | null>(null);
  const [selectedKickZone, setSelectedKickZone] = useState<GoalZone | null>(null);
  const [selectedDefendZone, setSelectedDefendZone] = useState<GoalZone | null>(null);
  const [predictedShotType, setPredictedShotType] = useState<ShotType | null>(null);
  const [actualShotType, setActualShotType] = useState<ShotType | null>(null);
  const [outcome, setOutcome] = useState<DuelOutcome | null>(null);
  const [resultTitle, setResultTitle] = useState("");
  const [resultExplain, setResultExplain] = useState("");
  const [preLine, setPreLine] = useState(() => getPreDuelLine(player));
  const [postSaveLine, setPostSaveLine] = useState(() => getPostSaveLine(player));
  const [postGoalLine, setPostGoalLine] = useState(() => getPostGoalLine(player));
  const [powerPct, setPowerPct] = useState(0);
  const [capturedPower, setCapturedPower] = useState<number | null>(null);
  const powerDirRef = useRef(1);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const keeperGuessRef = useRef<GoalZone>("bc");
  const chosenRef = useRef<GoalZone>("bc");
  const outcomeRef = useRef<DuelOutcome>("goal");
  const swipeRef = useRef<{ x: number; y: number; t: number } | null>(null);

  const diff = rarityDifficulty[player.rarity] ?? rarityDifficulty.common;
  const posMod = positionDifficultyMod(player.position);
  const effectiveWindow = Math.max(400, diff.windowMs + gloveTimingBonus + posMod);
  const shotSpeed = slowShot ? diff.shotSpeedMs * 1.35 : diff.shotSpeedMs;
  const diffLabel = player.rarity === "legendary" ? "Extreme" : player.rarity === "epic" ? "Hard" : player.rarity === "rare" ? "Medium" : "Easy";

  const overall = player.stats?.overall ?? 70;
  const conf = player.attributes?.confidence ?? 55;
  const form = player.attributes?.form ?? 55;

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
    if (phase !== "result") return;
    let cancelled = false;
    const result = isSuccessOutcome(outcomeRef.current, roleMode) ? "save" : "goal";
    const loadPostLine = async () => {
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
    void loadPostLine();
    return () => {
      cancelled = true;
    };
  }, [phase, roleMode, player.name, player.position, player.rarity]);

  const pickZone = useCallback((): GoalZone => {
    const zones: GoalZone[] = ["tl", "tc", "tr", "bl", "bc", "br"];
    return zones[Math.floor(Math.random() * zones.length)];
  }, []);

  const startRoleSelection = useCallback(() => {
    setRoleMode(null);
    setSelectedKickZone(null);
    setSelectedDefendZone(null);
    setPredictedShotType(null);
    setShotZone(null);
    setDiveDir(null);
    setCapturedPower(null);
    setOutcome(null);
    setResultTitle("");
    setResultExplain("");
    setPhase("role");
  }, []);

  const enterSetup = useCallback((mode: RoleMode) => {
    setRoleMode(mode);
    setSelectedKickZone(null);
    setSelectedDefendZone(null);
    setPredictedShotType(mode === "defend" ? "speed" : null);
    setShotZone(null);
    setDiveDir(null);
    setCapturedPower(null);
    setOutcome(null);
    setResultTitle("");
    setResultExplain("");
    setPowerPct(20);
    setPhase("setup");
  }, []);

  const startKickRun = useCallback(() => {
    if (!selectedKickZone) return;
    const captured = powerPct;
    setCapturedPower(captured);
    chosenRef.current = selectedKickZone;
    keeperGuessRef.current = pickZone();
    setActualShotType(captured > 80 ? "speed" : captured < 30 ? "curve" : "high");
    const kickResult = resolveKickResult({
      targetZone: selectedKickZone,
      powerPct: captured,
      overall,
      confidence: conf,
      form,
      keeperGuess: keeperGuessRef.current,
    });

    outcomeRef.current = kickResult.outcome;
    setResultTitle(kickResult.title);
    setResultExplain(kickResult.explain);
    setOutcome(kickResult.outcome);

    setPhase("runup");
    setDiveDir(zoneToDirection(keeperGuessRef.current));
    const runupMs = 500 + Math.random() * 280;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setShotZone(selectedKickZone);
      setPhase("shoot");
      timerRef.current = setTimeout(() => {
        setPhase("dive");
        timerRef.current = setTimeout(() => setPhase("result"), Math.min(shotSpeed, 420));
      }, 280);
    }, runupMs);
  }, [selectedKickZone, powerPct, pickZone, overall, conf, form, shotSpeed]);

  const startDefendRun = useCallback(() => {
    if (!selectedDefendZone || !predictedShotType) return;
    setCapturedPower(null);
    setPhase("runup");
    setDiveDir(zoneToDirection(selectedDefendZone));
    const actualType = pickOpponentShotType(diff.feintChance);
    const actualZone = pickShotZoneForType(actualType);
    chosenRef.current = actualZone;
    setActualShotType(actualType);
    setShotZone(null);

    const defendResult = resolveDefendResult({
      defendedZone: selectedDefendZone,
      actualZone,
      guessedType: predictedShotType,
      actualType,
      gloveTimingBonus,
      diveForgiveness,
      focusPoints,
      overall,
    });
    outcomeRef.current = defendResult.outcome;
    setOutcome(defendResult.outcome);
    setResultTitle(defendResult.title);
    setResultExplain(defendResult.explain);

    const runupMs = 620 + Math.random() * 360;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setShotZone(actualZone);
      setPhase("shoot");
      timerRef.current = setTimeout(() => {
        setPhase("dive");
        timerRef.current = setTimeout(() => setPhase("result"), Math.min(shotSpeed, 460));
      }, actualType === "speed" ? 180 : 280);
    }, runupMs);
  }, [
    selectedDefendZone,
    predictedShotType,
    diff.feintChance,
    gloveTimingBonus,
    diveForgiveness,
    focusPoints,
    overall,
    shotSpeed,
  ]);

  // Swipe handling
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (phase !== "setup" || roleMode !== "kick") return;
    const t = e.touches[0];
    swipeRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  }, [phase, roleMode]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!swipeRef.current || phase !== "setup" || roleMode !== "kick") return;
    const t = e.changedTouches[0];
    const dx = t.clientX - swipeRef.current.x;
    const elapsed = Date.now() - swipeRef.current.t;
    swipeRef.current = null;
    if (elapsed > 800) return;
    if (Math.abs(dx) < 40) return;
    setSelectedKickZone((prev) => {
      if (!prev) return dx < 0 ? "bl" : "br";
      const row = prev.startsWith("t") ? "t" : "b";
      if (dx < 0) return `${row}l` as GoalZone;
      return `${row}r` as GoalZone;
    });
  }, [phase, roleMode]);

  // Oscillating power bar during shoot phase
  useEffect(() => {
    if (phase !== "setup" || roleMode !== "kick") { setPowerPct(0); return; }
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
  }, [phase, roleMode]);

  useEffect(() => { return () => clearTimeout(timerRef.current); }, []);

  const rarityColor = {
    legendary: "hsl(42 95% 55%)",
    epic: "hsl(270 60% 55%)",
    rare: "hsl(210 80% 55%)",
    common: "hsl(var(--muted-foreground))",
  }[player.rarity];
  const isResultSuccess = isSuccessOutcome(outcome ?? "goal", roleMode);
  const showKickMotion = roleMode === "kick" && (phase === "runup" || phase === "shoot");
  const keeperShiftClass =
    diveDir === "left"
      ? "-translate-x-[120%]"
      : diveDir === "right"
        ? "translate-x-[20%]"
        : diveDir === "center"
          ? "-translate-x-1/2"
          : "-translate-x-1/2";

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
              <div className="absolute left-0 right-0 top-1/2 h-px bg-foreground/5" />

              {/* 6-zone selector (setup only) */}
              {phase === "setup" && (
                <SixZoneGoalSelector
                  selectedZone={roleMode === "kick" ? selectedKickZone : selectedDefendZone}
                  onSelect={(z) => roleMode === "kick" ? setSelectedKickZone(z) : setSelectedDefendZone(z)}
                />
              )}

              {/* Ball */}
              {shotZone && (phase === "shoot" || phase === "dive" || phase === "result") && (
                <div
                  className="absolute w-9 h-9 flex items-center justify-center text-2xl animate-duel-ball-flight z-10"
                  style={{
                    left: ballTargetPos[shotZone].left,
                    top: ballTargetPos[shotZone].top,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <span className="drop-shadow-lg">⚽</span>
                </div>
              )}
              {shotZone && (phase === "shoot" || phase === "dive") && (
                <div
                  className={`absolute w-20 h-2 rounded-full pointer-events-none ${
                    actualShotType === "curve" ? "animate-pulse" : ""
                  }`}
                  style={{
                    left: ballTargetPos[shotZone].left,
                    top: ballTargetPos[shotZone].top,
                    transform: actualShotType === "curve"
                      ? "translate(-60%, -50%) rotate(-18deg)"
                      : actualShotType === "high"
                        ? "translate(-50%, -110%) rotate(-8deg)"
                        : "translate(-50%, -50%)",
                    background: actualShotType === "speed"
                      ? "linear-gradient(90deg, transparent, rgba(248,250,252,0.95), transparent)"
                      : "linear-gradient(90deg, transparent, rgba(125,211,252,0.8), transparent)",
                    opacity: 0.65,
                  }}
                />
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

              {/* Goalkeeper character (explicit in-scene) */}
              <div
                className={`absolute bottom-4 left-1/2 z-[18] transition-all duration-300 ${keeperShiftClass}`}
                style={{ filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.45))" }}
              >
                <div
                  className={`h-8 w-8 rounded-full border-2 flex items-center justify-center text-[10px] font-black ${
                    phase === "dive"
                      ? "border-primary bg-primary/25 text-primary"
                      : "border-foreground/30 bg-background/70 text-foreground/80"
                  }`}
                >
                  GK
                </div>
              </div>

              {/* Save burst effect */}
              {phase === "result" && (outcome === "save" || outcome === "deflected") && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full animate-duel-save-burst"
                    style={{ background: `radial-gradient(circle, hsl(var(--primary) / 0.5), transparent)` }} />
                </div>
              )}

              {/* Goal flash */}
              {phase === "result" && (outcome === "goal" || outcome === "missed" || outcome === "woodwork") && (
                <div className="absolute inset-0 bg-destructive/20 animate-duel-goal-flash rounded-t-2xl" />
              )}
            </div>

            {/* Grass edge */}
            <div className="absolute -bottom-3 inset-x-0 h-6 rounded-b-xl"
              style={{ background: "linear-gradient(to top, hsl(153 45% 15% / 0.35), transparent)" }} />

            {/* Penalty spot */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-foreground/15" />

            {/* Kicker character + idle/run-up near penalty spot */}
            <div
              className={`absolute -bottom-11 left-1/2 z-20 transition-all duration-300 ${
                showKickMotion ? "-translate-x-[35%] -translate-y-[6px]" : "-translate-x-1/2"
              }`}
              style={{ filter: "drop-shadow(0 5px 10px rgba(0,0,0,0.45))" }}
            >
              <div className={`h-9 w-9 rounded-full border-2 flex items-center justify-center text-xs font-black ${
                showKickMotion
                  ? "border-amber-300/70 bg-amber-500/20 text-amber-200"
                  : "border-foreground/30 bg-background/70 text-foreground/80"
              }`}>
                ST
              </div>
            </div>

            {/* Ball on spot before strike for clearer setup scene */}
            {(phase === "setup" || phase === "runup") && (
              <div
                className="absolute -bottom-[2.35rem] left-1/2 z-[21] text-base transition-all duration-300"
                style={{
                  transform: showKickMotion ? "translate(-22%, -2px)" : "translate(-50%, 0)",
                  filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.45))",
                }}
              >
                ⚽
              </div>
            )}
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
            {phase === "role" && (
              <div className="w-full max-w-[300px] space-y-2 animate-fade-in">
                <p className="text-xs font-black tracking-wider text-foreground/80 uppercase">Choose your role</p>
                <button
                  type="button"
                  onClick={() => enterSetup("kick")}
                  className={`w-full rounded-2xl p-3 text-left border transition-all ${
                    roleMode === "kick" ? "border-primary bg-primary/15" : "border-border/40 bg-background/40"
                  }`}
                >
                  <p className="text-sm font-black text-foreground">Kick</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Pick your corner. Time your power.</p>
                </button>
                <button
                  type="button"
                  onClick={() => enterSetup("defend")}
                  className={`w-full rounded-2xl p-3 text-left border transition-all ${
                    roleMode === "defend" ? "border-primary bg-primary/15" : "border-border/40 bg-background/40"
                  }`}
                >
                  <p className="text-sm font-black text-foreground">Defend</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Read the shot. Cover the right zone.</p>
                </button>
              </div>
            )}
            {phase === "setup" && roleMode === "kick" && (
              <div className="animate-fade-in w-full max-w-[300px]">
                <p className="text-xs font-black text-foreground mb-1">Kick mode</p>
                <p className="text-[10px] text-muted-foreground mb-2">
                  Zone: {selectedKickZone ? goalZoneLabel[selectedKickZone] : "Pick a corner"}
                </p>
                <div className="relative h-5 rounded-full overflow-hidden mb-1" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
                  <div className="absolute top-0 bottom-0 rounded-full" style={{ left: "34%", width: "34%", background: "rgba(34,197,94,0.25)" }} />
                  <div className="absolute top-0 bottom-0 w-3 rounded-full transition-none"
                    style={{
                      left: `${Math.max(0, powerPct - 2)}%`,
                      background: powerPct >= 34 && powerPct <= 68
                        ? "linear-gradient(90deg,#22c55e,#86efac)"
                        : powerPct > 82
                        ? "linear-gradient(90deg,#ef4444,#fca5a5)"
                        : "linear-gradient(90deg,#f59e0b,#fcd34d)",
                      boxShadow: powerPct >= 34 && powerPct <= 68 ? "0 0 8px rgba(34,197,94,0.8)" : "none",
                    }}
                  />
                  <span className="absolute left-[34%] top-0 bottom-0 flex items-center justify-center text-[7px] font-black text-emerald-400/80 pointer-events-none w-[34%]">SWEET SPOT</span>
                </div>
                <div className="flex justify-between text-[8px] text-foreground/35 mb-2">
                  <span>Low</span><span>Mid</span><span>High</span>
                </div>
                <p className="text-[9px] text-muted-foreground">Low = safer, Mid = balanced, High = power but riskier.</p>
              </div>
            )}
            {phase === "setup" && roleMode === "defend" && (
              <div className="animate-fade-in w-full max-w-[300px]">
                <p className="text-xs font-black text-foreground mb-1">Defend mode</p>
                <p className="text-[10px] text-muted-foreground mb-2">
                  Zone: {selectedDefendZone ? goalZoneLabel[selectedDefendZone] : "Pick your coverage zone"}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(["high", "curve", "speed"] as ShotType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setPredictedShotType(t)}
                      className={`rounded-xl py-2 text-[10px] font-black uppercase tracking-wide border transition-all ${
                        predictedShotType === t ? "border-primary bg-primary/15 text-primary" : "border-border/40 bg-background/40 text-foreground/80"
                      }`}
                    >
                      {t === "high" ? "High Ball" : t === "curve" ? "Curve Ball" : "Speed Ball"}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {phase === "runup" && (
              <div className="animate-fade-in">
                <p className="text-base font-black tracking-wide animate-pulse" style={{ color: rarityColor }}>
                  {roleMode === "kick" ? "Lining up shot…" : "Reading run-up…"}
                </p>
                <p className="text-[10px] text-foreground/40 mt-1">
                  {roleMode === "kick" ? "Keeper is guessing" : "Commit to your zone"}
                </p>
              </div>
            )}
            {phase === "shoot" && (
              <div className="animate-fade-in w-full max-w-[280px]">
                <p className="text-2xl font-black text-foreground tracking-tight animate-bounce mb-3">
                  {roleMode === "kick" ? "KICK!" : "SHOT!"}
                </p>
                <p className="text-[10px] text-foreground/40">
                  {roleMode === "kick"
                    ? `${goalZoneLabel[chosenRef.current]} · ${powerBandLabel(capturedPower)}`
                    : `${goalZoneLabel[chosenRef.current]} · ${(actualShotType ?? "speed").toUpperCase()}`}
                </p>
              </div>
            )}
            {phase === "dive" && (
              <p className="text-sm font-bold text-primary animate-fade-in">
                {roleMode === "kick" ? `Keeper dives ${diveDir}…` : `Diving ${diveDir}…`}
              </p>
            )}
            {phase === "result" && (
              <div className="animate-duel-result-slam text-center">
                <p className={`text-5xl font-black mb-2 tracking-tighter ${
                  outcome === "save" || outcome === "deflected" ? "text-primary" :
                  outcome === "close-miss" ? "text-amber-400" :
                  "text-destructive"
                }`}>
                  {resultTitle}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 mb-2">
                  {roleMode && (
                    <span className="text-[10px] px-2.5 py-1 rounded-full font-black bg-primary/20 text-primary uppercase">{roleMode}</span>
                  )}
                  {shotZone && (
                    <span className="text-[10px] px-2.5 py-1 rounded-full font-black bg-background/50 text-foreground/80">{goalZoneLabel[shotZone]}</span>
                  )}
                  {roleMode === "kick" && (
                    <span className="text-[10px] px-2.5 py-1 rounded-full font-black bg-amber-500/20 text-amber-300">{powerBandLabel(capturedPower)}</span>
                  )}
                  {roleMode === "defend" && predictedShotType && (
                    <span className="text-[10px] px-2.5 py-1 rounded-full font-black bg-sky-500/20 text-sky-300">{predictedShotType.toUpperCase()}</span>
                  )}
                </div>
                <p className="text-[11px] text-foreground/80 max-w-[280px] leading-relaxed">{resultExplain}</p>
                <p className={`text-[10px] font-black mt-1.5 ${isResultSuccess ? "text-emerald-300" : "text-amber-300"}`}>
                  {roleMode === "kick" ? "Kicker vs Keeper resolved" : "Keeper vs Kicker resolved"}
                </p>
                <p className="text-sm text-foreground/80 italic max-w-[250px] mt-2">
                  "{isSuccessOutcome(outcome ?? "goal", roleMode) ? postSaveLine : postGoalLine}"
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">— {player.name}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── BOTTOM CONTROLS ─── */}
      {phase !== "intro" && (
        <div className="relative z-30 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {phase === "ready" && (
            <button type="button" onClick={startRoleSelection}
              className="w-full py-4 rounded-2xl font-black text-base active:scale-[0.97] transition-all animate-duel-ready-pulse"
              style={{
                background: `linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))`,
                color: "hsl(var(--primary-foreground))",
                boxShadow: `0 0 30px hsl(var(--primary) / 0.3), 0 4px 20px rgba(0,0,0,0.3)`,
              }}>
              ⚡ Start Duel
            </button>
          )}
          {phase === "role" && (
            <button
              type="button"
              onClick={() => setPhase("ready")}
              className="w-full py-3 rounded-2xl glass-card-strong text-foreground font-bold text-sm active:scale-[0.97] transition-transform"
            >
              Back
            </button>
          )}
          {phase === "setup" && roleMode === "kick" && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={!selectedKickZone}
                onClick={startKickRun}
                className={`w-full py-4 rounded-2xl font-black text-sm active:scale-[0.97] transition-transform ${
                  selectedKickZone ? "" : "opacity-55"
                }`}
                style={{
                  background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))",
                  color: "hsl(var(--primary-foreground))",
                }}
              >
                Kick
              </button>
              <button type="button" onClick={() => setPhase("role")} className="w-full py-3 rounded-2xl glass-card-strong text-foreground font-bold text-sm active:scale-[0.97] transition-transform">
                Change role
              </button>
            </div>
          )}
          {phase === "setup" && roleMode === "defend" && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={!selectedDefendZone || !predictedShotType}
                onClick={startDefendRun}
                className={`w-full py-4 rounded-2xl font-black text-sm active:scale-[0.97] transition-transform ${
                  !selectedDefendZone || !predictedShotType ? "opacity-55" : ""
                }`}
                style={{
                  background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))",
                  color: "hsl(var(--primary-foreground))",
                }}
              >
                Dive / Defend
              </button>
              <button type="button" onClick={() => setPhase("role")} className="w-full py-3 rounded-2xl glass-card-strong text-foreground font-bold text-sm active:scale-[0.97] transition-transform">
                Change role
              </button>
            </div>
          )}

          {phase === "result" && isSuccessOutcome(outcome ?? "goal", roleMode) && (
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
                onClick={startRoleSelection}
                className="w-full py-3 rounded-2xl glass-card-strong text-foreground font-bold text-sm active:scale-[0.97] transition-transform"
              >
                Retry duel
              </button>
            </div>
          )}

          {phase === "result" && !isSuccessOutcome(outcome ?? "goal", roleMode) && (
            <div className="flex flex-col gap-2 animate-fade-in-up">
              <div className="text-center py-3 rounded-2xl font-bold text-sm"
                style={{ background: "hsl(var(--destructive) / 0.1)", color: "hsl(var(--destructive))" }}>
                {resultTitle} — {resultExplain}
              </div>
              <button
                type="button"
                onClick={onGoal}
                className="w-full py-3.5 rounded-2xl glass-card-strong text-foreground font-black text-sm active:scale-[0.97] transition-transform"
              >
                🗺️ Scout another player →
              </button>
              <button
                type="button"
                onClick={startRoleSelection}
                className="w-full py-3 rounded-2xl glass-card-strong text-foreground font-bold text-sm active:scale-[0.97] transition-transform"
              >
                Retry duel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const goalZoneLabel: Record<GoalZone, string> = {
  tl: "Top Left",
  tc: "Top Center",
  tr: "Top Right",
  bl: "Bottom Left",
  bc: "Bottom Center",
  br: "Bottom Right",
};

const ballTargetPos: Record<GoalZone, { left: string; top: string }> = {
  tl: { left: "16%", top: "19%" },
  tc: { left: "50%", top: "15%" },
  tr: { left: "84%", top: "19%" },
  bl: { left: "16%", top: "58%" },
  bc: { left: "50%", top: "54%" },
  br: { left: "84%", top: "58%" },
};

function zoneToDirection(zone: GoalZone): Direction {
  if (zone.endsWith("l")) return "left";
  if (zone.endsWith("r")) return "right";
  return "center";
}

function sameSide(a: GoalZone, b: GoalZone) {
  return zoneToDirection(a) === zoneToDirection(b);
}

function sameHeight(a: GoalZone, b: GoalZone) {
  return (a.startsWith("t") && b.startsWith("t")) || (a.startsWith("b") && b.startsWith("b"));
}

function powerBandLabel(p: number | null) {
  if (p === null) return "No Power";
  if (p < 34) return "Low Power";
  if (p <= 68) return "Mid Power";
  return "High Power";
}

function pickOpponentShotType(feintChance: number): ShotType {
  const r = Math.random();
  if (r < 0.36 + feintChance * 0.2) return "curve";
  if (r < 0.66) return "speed";
  return "high";
}

function pickShotZoneForType(type: ShotType): GoalZone {
  const top: GoalZone[] = ["tl", "tc", "tr"];
  const bottom: GoalZone[] = ["bl", "bc", "br"];
  const all: GoalZone[] = [...top, ...bottom];
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]!;
  if (type === "high") return Math.random() < 0.74 ? pick(top) : pick(all);
  if (type === "speed") return Math.random() < 0.68 ? pick(bottom) : pick(all);
  return pick(all);
}

function resolveKickResult(input: {
  targetZone: GoalZone;
  powerPct: number;
  overall: number;
  confidence: number;
  form: number;
  keeperGuess: GoalZone;
}): { outcome: DuelOutcome; title: string; explain: string } {
  const { targetZone, powerPct, overall, confidence, form, keeperGuess } = input;
  const isTop = targetZone.startsWith("t");
  const midPower = powerPct >= 34 && powerPct <= 68;
  const highPower = powerPct > 68;
  const skillBoost = ((overall - 70) * 0.0035) + ((confidence - 50) * 0.001) + ((form - 50) * 0.001);
  let goalChance = 0.58 + skillBoost;
  if (midPower) goalChance += 0.1;
  if (highPower) goalChance += 0.02;
  if (!midPower && !highPower) goalChance -= 0.08;
  if (keeperGuess === targetZone) goalChance -= 0.33;
  else if (sameSide(keeperGuess, targetZone)) goalChance -= 0.12;

  let missChance = 0.04;
  if (highPower) missChance += isTop ? 0.18 : 0.1;
  if (!midPower && !highPower) missChance += 0.01;
  if (powerPct > 88 && isTop) missChance += 0.08;

  const woodworkChance = highPower ? 0.1 : 0.04;
  const r = Math.random();

  if (r < missChance) {
    if (Math.random() < woodworkChance) {
      return { outcome: "woodwork", title: "Woodwork", explain: "Too much power. It clipped the bar." };
    }
    return { outcome: "missed", title: "Missed", explain: "The strike drifted wide under pressure." };
  }
  if (r < 1 - goalChance) {
    return { outcome: "save", title: "Saved", explain: "Keeper guessed right and got a glove on it." };
  }
  return {
    outcome: "goal",
    title: "Goal",
    explain: midPower ? "Perfect corner with balanced power." : highPower ? "Power beat the keeper." : "Placed finish into the corner.",
  };
}

function resolveDefendResult(input: {
  defendedZone: GoalZone;
  actualZone: GoalZone;
  guessedType: ShotType;
  actualType: ShotType;
  gloveTimingBonus: number;
  diveForgiveness: boolean;
  focusPoints: number;
  overall: number;
}): { outcome: DuelOutcome; title: string; explain: string } {
  const { defendedZone, actualZone, guessedType, actualType, gloveTimingBonus, diveForgiveness, focusPoints, overall } = input;
  const exact = defendedZone === actualZone;
  const sideMatch = sameSide(defendedZone, actualZone);
  const heightMatch = sameHeight(defendedZone, actualZone);
  let saveChance = exact ? 0.7 : sideMatch ? 0.44 : heightMatch ? 0.32 : 0.14;
  if (guessedType === actualType) saveChance += 0.12;
  else saveChance -= 0.08;
  if (actualType === "curve" && guessedType !== "curve") saveChance -= 0.06;
  if (actualType === "speed") saveChance += exact ? 0.06 : -0.07;
  if (actualType === "high" && actualZone.startsWith("t") && defendedZone.startsWith("t")) saveChance += 0.06;
  saveChance += Math.min(0.1, gloveTimingBonus / 3000);
  saveChance += Math.min(0.08, focusPoints * 0.004);
  saveChance += Math.max(-0.03, Math.min(0.08, (overall - 70) * 0.002));
  if (diveForgiveness && (sideMatch || heightMatch)) saveChance += 0.05;
  saveChance = Math.max(0.05, Math.min(0.9, saveChance));

  const r = Math.random();
  if (r < saveChance) {
    if (actualType === "speed" || !exact) {
      return { outcome: "deflected", title: "Deflected", explain: "You got a touch and pushed it away." };
    }
    return { outcome: "save", title: "Save", explain: "Perfect read. You covered the right zone." };
  }
  if (sideMatch || heightMatch) {
    return { outcome: "close-miss", title: "Close Miss", explain: "You read part of it, but not enough to stop the shot." };
  }
  return { outcome: "goal", title: "Goal", explain: guessedType === actualType ? "Right shot type, wrong zone." : "Wrong read. The finish beat you." };
}

function isSuccessOutcome(outcome: DuelOutcome, mode: RoleMode | null): boolean {
  if (!mode) return false;
  if (mode === "kick") return outcome === "goal";
  return outcome === "save" || outcome === "deflected";
}

function SixZoneGoalSelector({
  selectedZone,
  onSelect,
}: {
  selectedZone: GoalZone | null;
  onSelect: (z: GoalZone) => void;
}) {
  const zones: GoalZone[] = ["tl", "tc", "tr", "bl", "bc", "br"];
  return (
    <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-px p-1.5">
      {zones.map((z) => {
        const selected = selectedZone === z;
        return (
          <button
            key={z}
            type="button"
            onClick={() => onSelect(z)}
            className={`rounded-md border text-[8px] font-black transition-all ${
              selected
                ? "border-primary bg-primary/25 text-primary shadow-[0_0_14px_rgba(99,102,241,0.45)]"
                : "border-border/25 bg-background/20 text-foreground/65"
            }`}
          >
            {z === "tl" ? "TL" : z === "tc" ? "TC" : z === "tr" ? "TR" : z === "bl" ? "BL" : z === "bc" ? "BC" : "BR"}
          </button>
        );
      })}
    </div>
  );
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
