import { useMemo } from "react";
import type { Player } from "@/data/mockData";

interface AnimatedPortraitProps {
  player: Player;
  size?: "sm" | "md" | "lg" | "xl";
  showMood?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "w-12 h-12",
  md: "w-16 h-16",
  lg: "w-24 h-24",
  xl: "w-32 h-32",
};

const fontSizes = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-3xl",
  xl: "text-4xl",
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

const AnimatedPortrait = ({ player, size = "md", showMood = false, className = "" }: AnimatedPortraitProps) => {
  const mood = useMemo(() => moodEmoji(player.attributes), [player.attributes]);
  const avgMorale = (player.attributes.confidence + player.attributes.morale) / 2;

  return (
    <div className={`relative ${className}`}>
      {/* Pulsing aura ring */}
      <div className={`absolute inset-0 ${sizeClasses[size]} rounded-2xl bg-gradient-to-br ${rarityGradients[player.rarity]} opacity-20 blur-md portrait-breathe`} />

      {/* Main portrait container */}
      <div
        className={`relative ${sizeClasses[size]} rounded-2xl bg-gradient-to-br ${rarityGradients[player.rarity]} 
        flex items-center justify-center overflow-hidden card-shimmer portrait-breathe ${rarityGlow[player.rarity]}`}
      >
        {/* Overall rating */}
        <span className={`${fontSizes[size]} font-black text-background/90 relative z-10 drop-shadow-lg`}>
          {player.overall}
        </span>

        {/* Ambient light overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-white/10" />

        {/* Low morale darkening */}
        {avgMorale < 60 && (
          <div className="absolute inset-0 bg-background/40 z-20" />
        )}
      </div>

      {/* Mood indicator */}
      {showMood && (
        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-card border-2 border-border flex items-center justify-center text-xs z-30">
          {mood}
        </div>
      )}

      {/* Rarity dot */}
      <div className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-gradient-to-br ${rarityGradients[player.rarity]} border border-background z-30`} />
    </div>
  );
};

export default AnimatedPortrait;
