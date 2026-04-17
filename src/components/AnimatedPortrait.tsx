import { useMemo, useState, useEffect } from "react";
import type { Player } from "@/data/mockData";

interface AnimatedPortraitProps {
  player: Player;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showMood?: boolean;
  className?: string;
}

const sizeClasses = {
  xs: "w-8 h-8 rounded-xl",
  sm: "w-12 h-12 rounded-2xl",
  md: "w-16 h-16 rounded-2xl",
  lg: "w-24 h-24 rounded-[1.35rem]",
  xl: "w-32 h-32 rounded-3xl",
};

const auraRounded = {
  xs: "rounded-xl",
  sm: "rounded-2xl",
  md: "rounded-2xl",
  lg: "rounded-[1.35rem]",
  xl: "rounded-3xl",
};

const framePad = {
  xs: "p-[2px]",
  sm: "p-[2px]",
  md: "p-[3px]",
  lg: "p-[3px]",
  xl: "p-[3px]",
};

const imgRounded = {
  xs: "rounded-[10px]",
  sm: "rounded-[14px]",
  md: "rounded-[13px]",
  lg: "rounded-[1.15rem]",
  xl: "rounded-[1.35rem]",
};

const ovrBadge = {
  xs: "text-[8px] px-1 py-0",
  sm: "text-[9px] px-1 py-0",
  md: "text-[10px] px-1 py-0.5",
  lg: "text-xs px-1.5 py-0.5",
  xl: "text-sm px-2 py-0.5",
};

const rarityGradients: Record<string, string> = {
  legendary: "from-amber-400 via-orange-500 to-amber-600",
  epic: "from-purple-400 via-purple-500 to-indigo-600",
  rare: "from-blue-400 via-blue-500 to-cyan-500",
  common: "from-zinc-400 via-zinc-500 to-zinc-600",
};

const rarityGlow: Record<string, string> = {
  legendary: "portrait-glow-legendary",
  epic: "portrait-glow-epic",
  rare: "portrait-glow-rare",
  common: "",
};

const moodEmoji = (attributes: Player["attributes"]) => {
  const avg = (attributes.confidence + attributes.morale) / 2;
  if (avg >= 90) return "🔥";
  if (avg >= 75) return "💪";
  if (avg >= 60) return "😤";
  return "😓";
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const AnimatedPortrait = ({ player, size = "md", showMood = false, className = "" }: AnimatedPortraitProps) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const mood = useMemo(() => moodEmoji(player.attributes), [player.attributes]);

  useEffect(() => {
    setImgFailed(false);
    setImgLoaded(false);
  }, [player.portrait]);
  const avgMorale = (player.attributes.confidence + player.attributes.morale) / 2;
  const ovr = player.stats.overall;

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      {/* Outer aura — rarity glow + float */}
      <div
        className={`pointer-events-none absolute -inset-1 ${auraRounded[size]} bg-gradient-to-br ${rarityGradients[player.rarity]} opacity-25 blur-md portrait-float-slow`}
        aria-hidden
      />

      {/* Rarity frame ring */}
      <div
        className={`relative ${framePad[size]} ${auraRounded[size]} bg-gradient-to-br ${rarityGradients[player.rarity]} portrait-float-layer ${rarityGlow[player.rarity]} evo-frame-${player.evolutionStage ?? 0}`}
      >
        <div
          className={`relative ${sizeClasses[size]} overflow-hidden bg-muted ${imgRounded[size]} shadow-inner`}
        >
          {!imgFailed ? (
            <>
              {!imgLoaded && (
                <div className={`absolute inset-0 bg-gradient-to-br from-muted/80 to-muted/40 animate-pulse ${imgRounded[size]}`} />
              )}
              <img
                src={player.portrait}
                alt=""
                className={`absolute inset-0 h-full w-full object-cover scale-[1.08] portrait-parallax-img ${imgRounded[size]} transition-opacity duration-300 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                loading="eager"
                decoding="async"
                referrerPolicy="no-referrer"
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgFailed(true)}
              />
            </>
          ) : (
            <div
              className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${rarityGradients[player.rarity]} font-black text-background/90 ${size === "xs" ? "text-xs" : size === "sm" ? "text-sm" : "text-lg"}`}
            >
              {initials(player.name)}
            </div>
          )}

          {/* Parallax / depth read layer */}
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/50 via-transparent to-white/[0.07] mix-blend-soft-light"
            aria-hidden
          />

          {avgMorale < 60 && <div className="absolute inset-0 bg-background/35 z-[1]" aria-hidden />}

          {/* OVR chip — does not cover the face */}
          <div
            className={`absolute bottom-0.5 right-0.5 z-[2] rounded-md bg-background/85 font-black tabular-nums text-foreground shadow-sm backdrop-blur-sm ${ovrBadge[size]}`}
          >
            {ovr}
          </div>
        </div>
      </div>

      {showMood && (
        <div className="absolute -bottom-0.5 -right-0.5 z-30 flex h-6 w-6 items-center justify-center rounded-full border-2 border-border bg-card text-xs">
          {mood}
        </div>
      )}

      <div
        className={`absolute -right-0.5 -top-0.5 z-30 h-3 w-3 rounded-full border border-background bg-gradient-to-br ${rarityGradients[player.rarity]}`}
        aria-hidden
      />
    </div>
  );
};

export default AnimatedPortrait;
