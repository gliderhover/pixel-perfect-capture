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

type Phase = "scanning" | "found" | "empty";

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
        const next = Math.min(prev + 2.5, 100);
        if (next >= 100) clearInterval(interval);
        return next;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [phase]);

  // Transition after scan completes
  useEffect(() => {
    if (scanPct < 100) return;
    const t = setTimeout(() => setPhase(nearestPlayer ? "found" : "empty"), 400);
    return () => clearTimeout(t);
  }, [scanPct, nearestPlayer]);

  const doChallenge = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (nearestPlayer) {
      addFocusPoints(1);
      onChallenge?.(nearestPlayer);
    }
    onClose();
  };

  const doClose = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onClose();
  };

  const rarityColor = nearestPlayer ? (RARITY_COLOR[nearestPlayer.rarity] ?? RARITY_COLOR.common) : "#22c55e";
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
          </div>
        </div>
      )}

      {/* FOUND PHASE */}
      {phase === "found" && nearestPlayer && (
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
              ⚡ {nearestPlayer.rarity.toUpperCase()} PLAYER FOUND
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
              <AnimatedPortrait player={nearestPlayer} size="lg" />
              <div className="flex-1 min-w-0">
                <p
                  className="text-[10px] font-black uppercase tracking-widest mb-0.5"
                  style={{ color: rarityColor }}
                >
                  {nearestPlayer.rarity}
                </p>
                <h2 className="text-xl font-black text-white leading-tight truncate">{nearestPlayer.name}</h2>
                <p className="text-sm mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.55)" }}>
                  {nearestPlayer.position} · {nearestPlayer.representedCountry}
                </p>
                <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.35)" }}>
                  {nearestPlayer.clubTeam}
                </p>
              </div>
              <div className="text-center shrink-0">
                <p className="text-2xl font-black text-white">{nearestPlayer.stats.overall}</p>
                <p className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>
                  OVR
                </p>
              </div>
            </div>

            {(nearestPlayer as Player & { catchphrases?: string[] }).catchphrases?.[0] && (
              <p
                className="text-xs italic text-center mb-4 px-2 leading-relaxed"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                "{(nearestPlayer as Player & { catchphrases?: string[] }).catchphrases![0]}"
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
            <p className="text-white/40 text-sm mb-4">Explore the map and tap a player marker to challenge them directly.</p>
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
