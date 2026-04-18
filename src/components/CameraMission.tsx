import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useGameProgress } from "@/context/GameProgressContext";
import type { Player } from "@/data/mockData";
import AnimatedPortrait from "./AnimatedPortrait";

interface CameraMissionProps {
  onClose: () => void;
  nearestPlayer?: Player | null;
  onChallenge?: (player: Player) => void;
}

type Phase = "scanning" | "locking" | "found" | "missed" | "empty";

const RARITY_COLOR: Record<string, string> = {
  legendary: "#f59e0b",
  epic: "#a855f7",
  rare: "#3b82f6",
  common: "#94a3b8",
};

const CameraMission = ({ onClose, nearestPlayer, onChallenge }: CameraMissionProps) => {
  const [phase, setPhase] = useState<Phase>("scanning");
  const [cameraError, setCameraError] = useState(false);
  const [scanPct, setScanPct] = useState(0);
  // Capture the player at lock-on time so prop changes can't wipe it mid-flow
  const [lockedPlayer, setLockedPlayer] = useState<Player | null>(null);
  const [lockCountdown, setLockCountdown] = useState(8);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { addFocusPoints } = useGameProgress();

  // Start rear camera
  useEffect(() => {
    let alive = true;
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (alive) setCameraError(true);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        if (alive) setCameraError(true);
      }
    };
    void start();
    return () => {
      alive = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Scan progress
  useEffect(() => {
    if (phase !== "scanning") return;
    const interval = setInterval(() => {
      setScanPct((prev) => {
        const next = Math.min(prev + 0.8, 100);
        if (next >= 100) clearInterval(interval);
        return next;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [phase]);

  // Transition after scan completes — capture player into local state immediately
  useEffect(() => {
    if (scanPct < 100) return;
    const t = setTimeout(() => {
      if (nearestPlayer) {
        setLockedPlayer(nearestPlayer);
        setLockCountdown(8);
        setPhase("locking");
      } else {
        setPhase("empty");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [scanPct, nearestPlayer]);

  // Countdown during locking phase — expire to "missed"
  useEffect(() => {
    if (phase !== "locking") return;
    if (lockCountdown <= 0) {
      setPhase("missed");
      return;
    }
    const t = setTimeout(() => setLockCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, lockCountdown]);

  const doChallenge = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (lockedPlayer) {
      addFocusPoints(1);
      onChallenge?.(lockedPlayer);
    }
    onClose();
  };

  const doClose = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onClose();
  };

  const rarityColor = lockedPlayer ? (RARITY_COLOR[lockedPlayer.rarity] ?? RARITY_COLOR.common) : "#22c55e";
  const scanY = `${25 + scanPct * 0.5}%`;

  return (
    <div className="fixed inset-0 z-[1400] overflow-hidden" style={{ background: "#000" }}>
      {/* Camera feed (hidden when error but kept for stream lifecycle) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover ${cameraError ? "opacity-0" : ""}`}
      />

      {/* Fallback atmosphere when no camera */}
      {cameraError && (
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 70%, hsl(153 40% 8% / 0.6), transparent 70%), linear-gradient(175deg, hsl(225 35% 4%), hsl(153 25% 6%))",
          }}
        >
          {/* Field lines */}
          <div
            className="absolute inset-x-[15%] bottom-[20%] h-[35%] rounded-t-full opacity-[0.06]"
            style={{ border: "2px solid #fff" }}
          />
          <div
            className="absolute left-1/2 top-[35%] bottom-[20%] w-px opacity-[0.04]"
            style={{ background: "#fff" }}
          />
        </div>
      )}

      {/* Dark overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            phase === "found"
              ? "linear-gradient(to top, rgba(0,0,0,0.85) 35%, rgba(0,0,0,0.2) 70%)"
              : "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.1) 30%, rgba(0,0,0,0.6) 100%)",
        }}
      />

      {/* Top bar */}
      <div
        className="absolute left-0 right-0 z-10 flex items-center justify-between px-4"
        style={{ top: "max(3rem, env(safe-area-inset-top, 3rem))" }}
      >
        <p
          className="text-[10px] font-black tracking-[0.25em] uppercase"
          style={{ color: "#22c55e", textShadow: "0 0 12px rgba(34,197,94,0.7)" }}
        >
          {cameraError ? "Scout Mode" : "AR Scout"}
        </p>
        <button
          onClick={doClose}
          className="w-11 h-11 rounded-full flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.15)" }}
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* SCANNING PHASE */}
      {phase === "scanning" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {/* Corner brackets */}
          {(["tl", "tr", "bl", "br"] as const).map((pos) => (
            <div
              key={pos}
              className="absolute w-14 h-14"
              style={{
                top: pos[0] === "t" ? "22%" : undefined,
                bottom: pos[0] === "b" ? "22%" : undefined,
                left: pos[1] === "l" ? "12%" : undefined,
                right: pos[1] === "r" ? "12%" : undefined,
                borderTop: pos[0] === "t" ? "3px solid #22c55e" : undefined,
                borderBottom: pos[0] === "b" ? "3px solid #22c55e" : undefined,
                borderLeft: pos[1] === "l" ? "3px solid #22c55e" : undefined,
                borderRight: pos[1] === "r" ? "3px solid #22c55e" : undefined,
                borderTopLeftRadius: pos === "tl" ? "10px" : undefined,
                borderTopRightRadius: pos === "tr" ? "10px" : undefined,
                borderBottomLeftRadius: pos === "bl" ? "10px" : undefined,
                borderBottomRightRadius: pos === "br" ? "10px" : undefined,
                boxShadow: "0 0 8px rgba(34,197,94,0.4)",
              }}
            />
          ))}

          {/* Sweep line */}
          <div
            className="absolute left-[12%] right-[12%]"
            style={{
              top: scanY,
              height: "2px",
              background: "linear-gradient(90deg, transparent, #22c55e 20%, #22c55e 80%, transparent)",
              boxShadow: "0 0 10px rgba(34,197,94,0.8), 0 0 20px rgba(34,197,94,0.3)",
              transition: "top 0.08s linear",
            }}
          />

          {/* Status */}
          <div className="mt-[56%] text-center px-8">
            <p
              className="text-white font-black text-base tracking-widest uppercase mb-3"
              style={{ textShadow: "0 0 16px rgba(34,197,94,0.6)" }}
            >
              {nearestPlayer ? "Player Detected" : "Scanning Area"}
            </p>
            <div className="h-1 w-36 rounded-full mx-auto overflow-hidden" style={{ background: "rgba(255,255,255,0.15)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${scanPct}%`,
                  background: "linear-gradient(90deg, #22c55e, #86efac)",
                  transition: "width 0.08s linear",
                  boxShadow: "0 0 8px rgba(34,197,94,0.6)",
                }}
              />
            </div>
            <p className="text-white/40 text-xs mt-2">
              {nearestPlayer
                ? `${nearestPlayer.name} · ${nearestPlayer.representedCountry}`
                : "Exploring nearby territory…"}
            </p>
            <p className="text-white/25 text-[10px] mt-3 text-center px-8">
              {nearestPlayer ? `${nearestPlayer.name} detected nearby` : "Walk around to discover nearby players"}
            </p>
          </div>
        </div>
      )}

      {/* LOCKING PHASE */}
      {phase === "locking" && lockedPlayer && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {/* Countdown ring */}
          <div className="relative mb-2" style={{ width: 140, height: 140 }}>
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r="64" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
              <circle
                cx="70" cy="70" r="64" fill="none"
                stroke={lockCountdown <= 3 ? "#ef4444" : rarityColor}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 64}`}
                strokeDashoffset={`${2 * Math.PI * 64 * (1 - lockCountdown / 8)}`}
                style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.3s" }}
              />
            </svg>
            <div className="absolute inset-0 rounded-full animate-ping" style={{ background: `${rarityColor}15`, animationDuration: "1.2s" }} />
            <div className="absolute inset-3 rounded-full" style={{ border: `2px solid ${rarityColor}`, boxShadow: `0 0 20px ${rarityColor}60` }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <AnimatedPortrait player={lockedPlayer} size="md" />
            </div>
            {/* Corner brackets */}
            {(["tl","tr","bl","br"] as const).map((pos) => (
              <div key={pos} className="absolute w-5 h-5" style={{
                top: pos[0]==="t" ? 8 : undefined, bottom: pos[0]==="b" ? 8 : undefined,
                left: pos[1]==="l" ? 8 : undefined, right: pos[1]==="r" ? 8 : undefined,
                borderTop: pos[0]==="t" ? `2px solid ${rarityColor}` : undefined,
                borderBottom: pos[0]==="b" ? `2px solid ${rarityColor}` : undefined,
                borderLeft: pos[1]==="l" ? `2px solid ${rarityColor}` : undefined,
                borderRight: pos[1]==="r" ? `2px solid ${rarityColor}` : undefined,
              }} />
            ))}
            {/* Countdown number */}
            <div
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center font-black text-sm"
              style={{ background: lockCountdown <= 3 ? "#ef4444" : rarityColor, color: "#000", boxShadow: `0 0 10px ${lockCountdown <= 3 ? "#ef444460" : rarityColor + "60"}` }}
            >
              {lockCountdown}
            </div>
          </div>
          <p className="text-white font-black text-sm tracking-widest uppercase mb-0.5 mt-4" style={{ textShadow: `0 0 16px ${rarityColor}80` }}>
            {lockedPlayer.name}
          </p>
          <p className="text-white/50 text-xs mb-1">{lockedPlayer.rarity} · {lockedPlayer.position}</p>
          <p className="text-white/30 text-[10px] mb-6">
            {lockCountdown <= 3 ? "⚠️ Escaping fast — tap now!" : "Tap fast before they slip away"}
          </p>
          <button
            type="button"
            onClick={() => setPhase("found")}
            className="px-8 py-3 rounded-2xl font-black text-sm active:scale-95 transition-transform"
            style={{ background: `${rarityColor}25`, border: `1px solid ${rarityColor}60`, color: rarityColor, boxShadow: `0 0 20px ${rarityColor}30` }}
          >
            ⚡ Lock On
          </button>
        </div>
      )}

      {/* MISSED PHASE */}
      {phase === "missed" && (
        <div
          className="absolute inset-x-0 bottom-0 px-4 animate-slide-up"
          style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom, 2rem))" }}
        >
          <div
            className="rounded-3xl p-5 text-center"
            style={{ background: "rgba(0,0,0,0.85)", border: "1px solid rgba(239,68,68,0.3)", backdropFilter: "blur(20px)" }}
          >
            <p className="text-4xl mb-3">💨</p>
            <p className="text-white font-black text-base mb-1">
              {lockedPlayer ? `${lockedPlayer.name.split(" ")[0]} got away!` : "Player escaped!"}
            </p>
            <p className="text-white/50 text-sm mb-1">
              You were too slow to lock on. Players only stay in range for a few seconds.
            </p>
            <p className="text-white/30 text-xs mb-5">
              Next time tap ⚡ Lock On as soon as the target appears.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setScanPct(0); setLockCountdown(8); setLockedPlayer(null); setPhase("scanning"); }}
                className="flex-1 py-3 rounded-2xl font-bold text-sm"
                style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={doClose}
                className="flex-1 py-3 rounded-2xl font-bold text-sm"
                style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                Back to Map
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOUND PHASE */}
      {phase === "found" && lockedPlayer && (
        <div
          className="absolute inset-x-0 bottom-0 px-4 animate-slide-up"
          style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom, 2rem))" }}
        >
          <div className="flex justify-center mb-3">
            <div
              className="px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase"
              style={{
                background: `${rarityColor}20`,
                border: `1px solid ${rarityColor}50`,
                color: rarityColor,
                textShadow: `0 0 10px ${rarityColor}60`,
              }}
            >
              ⚡ {lockedPlayer.rarity.toUpperCase()} PLAYER FOUND
            </div>
          </div>

          <div
            className="rounded-3xl p-5"
            style={{
              background: "rgba(0,0,0,0.75)",
              border: `1px solid ${rarityColor}35`,
              backdropFilter: "blur(20px)",
            }}
          >
            <div className="flex items-center gap-4 mb-4">
              <AnimatedPortrait player={lockedPlayer} size="lg" />
              <div className="flex-1 min-w-0">
                <p
                  className="text-[10px] font-black uppercase tracking-widest mb-0.5"
                  style={{ color: rarityColor }}
                >
                  {lockedPlayer.rarity}
                </p>
                <h2 className="text-xl font-black text-white leading-tight truncate">{lockedPlayer.name}</h2>
                <p className="text-sm mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.55)" }}>
                  {lockedPlayer.position} · {lockedPlayer.representedCountry}
                </p>
                <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.35)" }}>
                  {lockedPlayer.clubTeam}
                </p>
              </div>
              <div className="text-center shrink-0">
                <p className="text-2xl font-black text-white">{lockedPlayer.stats.overall}</p>
                <p className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>
                  OVR
                </p>
              </div>
            </div>

            {(lockedPlayer as Player & { catchphrases?: string[] }).catchphrases?.[0] && (
              <p
                className="text-xs italic text-center mb-4 px-2 leading-relaxed"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                "{(lockedPlayer as Player & { catchphrases?: string[] }).catchphrases![0]}"
              </p>
            )}

            <button
              type="button"
              onClick={doChallenge}
              className="w-full py-4 rounded-2xl font-black text-base active:scale-[0.97] transition-transform"
              style={{
                background: `linear-gradient(135deg, ${rarityColor}, ${rarityColor}99)`,
                color: rarityColor === RARITY_COLOR.legendary || rarityColor === RARITY_COLOR.common ? "#000" : "#fff",
                boxShadow: `0 0 28px ${rarityColor}40, 0 4px 16px rgba(0,0,0,0.4)`,
              }}
            >
              ⚡ Challenge — Penalty Duel
            </button>
          </div>
        </div>
      )}

      {/* EMPTY PHASE */}
      {phase === "empty" && (
        <div
          className="absolute inset-x-0 bottom-0 px-4 animate-slide-up"
          style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom, 2rem))" }}
        >
          <div
            className="rounded-3xl p-5 text-center"
            style={{ background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(20px)" }}
          >
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-white font-black text-base mb-1">No players in range</p>
            <p className="text-white/40 text-sm mb-4">No players nearby right now. Move to a new spot — players appear as you explore different areas.</p>
            <button
              type="button"
              onClick={doClose}
              className="w-full py-3 rounded-2xl font-bold text-sm"
              style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}
            >
              Back to Map
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraMission;
