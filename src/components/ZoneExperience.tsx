import { useState, useEffect } from "react";
import { X, Dumbbell, Heart, Users, Swords, Flame, Trophy, ChevronRight, Check, Zap } from "lucide-react";
import type { MapZone } from "@/data/mockData";
import { useGameProgress } from "@/context/GameProgressContext";
import AnimatedPortrait from "./AnimatedPortrait";

interface ZoneExperienceProps {
  zone: MapZone;
  onClose: () => void;
}

type ZoneStep = "intro" | "activity" | "reward";

const zoneConfig: Record<MapZone["type"], {
  icon: typeof Dumbbell;
  emoji: string;
  purpose: string;
  activity: string;
  cta: string;
  rewardLabel: string;
  attribute: "form" | "morale" | "fanBond" | "confidence";
  xp: number;
  attrGain: number;
  fpGain: number;
  color: string;
}> = {
  training: {
    icon: Dumbbell,
    emoji: "⚽",
    purpose: "Sharpen form through training drills",
    activity: "Complete a quick training drill to boost your player's form and earn XP.",
    cta: "Start Drill",
    rewardLabel: "+Form",
    attribute: "form",
    xp: 20,
    attrGain: 3,
    fpGain: 1,
    color: "hsl(var(--primary))",
  },
  recovery: {
    icon: Heart,
    emoji: "💆",
    purpose: "Restore morale and recover from setbacks",
    activity: "Rest and recover to restore your player's morale and mental strength.",
    cta: "Begin Recovery",
    rewardLabel: "+Morale",
    attribute: "morale",
    xp: 15,
    attrGain: 4,
    fpGain: 2,
    color: "hsl(153 50% 50%)",
  },
  "fan-arena": {
    icon: Users,
    emoji: "📣",
    purpose: "Connect with fans and build your bond",
    activity: "Engage with fans through a hype event to boost your fan bond and social standing.",
    cta: "Hype the Crowd",
    rewardLabel: "+Fan Bond",
    attribute: "fanBond",
    xp: 15,
    attrGain: 4,
    fpGain: 1,
    color: "hsl(var(--accent))",
  },
  rival: {
    icon: Swords,
    emoji: "⚔️",
    purpose: "Challenge nearby rivals",
    activity: "Face off against a rival in a quick matchup to prove your skills.",
    cta: "Enter Arena",
    rewardLabel: "+Confidence",
    attribute: "confidence",
    xp: 25,
    attrGain: 3,
    fpGain: 1,
    color: "hsl(var(--destructive))",
  },
  pressure: {
    icon: Flame,
    emoji: "🔥",
    purpose: "Build confidence through high-pressure moments",
    activity: "Handle a clutch moment under pressure to sharpen your player's confidence.",
    cta: "Face the Pressure",
    rewardLabel: "+Confidence",
    attribute: "confidence",
    xp: 30,
    attrGain: 5,
    fpGain: 2,
    color: "hsl(30 90% 55%)",
  },
  stadium: {
    icon: Trophy,
    emoji: "🏟️",
    purpose: "Tap into live event energy for special bonuses",
    activity: "Channel the stadium energy for boosted encounters and limited-time rewards.",
    cta: "Activate Surge",
    rewardLabel: "+All Stats",
    attribute: "morale",
    xp: 35,
    attrGain: 2,
    fpGain: 3,
    color: "hsl(var(--primary))",
  },
  mission: {
    icon: Zap,
    emoji: "📸",
    purpose: "Complete camera scouting missions",
    activity: "Scout this area with your camera for bonus XP and encounter hints.",
    cta: "Start Scouting",
    rewardLabel: "+XP",
    attribute: "form",
    xp: 25,
    attrGain: 1,
    fpGain: 2,
    color: "hsl(var(--primary))",
  },
};

const drillNames: Record<string, string[]> = {
  training: ["Sprint Intervals", "Passing Accuracy", "Dribble Through Cones", "Shooting Practice"],
  recovery: ["Ice Bath Session", "Stretching Routine", "Mindfulness Focus", "Light Jog Recovery"],
  "fan-arena": ["Autograph Session", "Fan Q&A", "Rally Chant", "Social Media Shoutout"],
  rival: ["1v1 Skill Test", "Pressing Drill", "Counter-Attack Run", "Tactical Read"],
  pressure: ["Penalty Under Pressure", "Last-Minute Free Kick", "Crowd Noise Challenge", "Overtime Sprint"],
  stadium: ["Crowd Energy Boost", "Stadium Wave", "Anthem Sing-Along", "Halftime Show"],
  mission: ["Area Scout", "Pitch Analysis", "Environment Scan", "Landmark Capture"],
};

const ZoneExperience = ({ zone, onClose }: ZoneExperienceProps) => {
  const [step, setStep] = useState<ZoneStep>("intro");
  const [progress, setProgress] = useState(0);
  const [drill] = useState(() => {
    const drills = drillNames[zone.type] ?? drillNames.training;
    return drills[Math.floor(Math.random() * drills.length)];
  });
  const { activePlayer, addXp, applyAttributeDelta, addFocusPoints } = useGameProgress();
  const config = zoneConfig[zone.type];
  const Icon = config.icon;

  // Simulate activity progress
  useEffect(() => {
    if (step !== "activity") return;
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          return 100;
        }
        return p + Math.random() * 15 + 5;
      });
    }, 400);
    return () => clearInterval(interval);
  }, [step]);

  // Auto-advance to reward
  useEffect(() => {
    if (step === "activity" && progress >= 100) {
      const t = setTimeout(() => {
        // Apply rewards
        addXp(activePlayer.id, config.xp);
        applyAttributeDelta(activePlayer.id, { [config.attribute]: config.attrGain });
        if (config.fpGain > 0) addFocusPoints(config.fpGain);
        setStep("reward");
      }, 600);
      return () => clearTimeout(t);
    }
  }, [step, progress, activePlayer.id, config, addXp, applyAttributeDelta, addFocusPoints]);

  return (
    <div className="fixed inset-0 z-[1350] flex items-end justify-center bg-background/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg animate-slide-up rounded-t-3xl bg-background/95 backdrop-blur-xl border-t border-border/20 overflow-hidden"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))", maxHeight: "85dvh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
              style={{ background: `${config.color} / 0.12` }}>
              {config.emoji}
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-black text-foreground truncate">{zone.name}</h3>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: config.color }}>
                {config.rewardLabel}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/60 shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 pb-4">
          {step === "intro" && (
            <div className="animate-fade-in">
              <div className="glass-card p-4 rounded-2xl mb-4">
                <div className="flex items-start gap-3">
                  <Icon className="w-5 h-5 shrink-0 mt-0.5" style={{ color: config.color }} />
                  <div>
                    <p className="text-xs font-bold text-foreground">{config.purpose}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{config.activity}</p>
                  </div>
                </div>
              </div>

              <div className="glass-card p-3 rounded-2xl mb-4 flex items-center gap-3">
                <AnimatedPortrait player={activePlayer} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-foreground truncate">{activePlayer.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {activePlayer.position} · Level {activePlayer.level}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[9px] text-muted-foreground uppercase">Current</p>
                  <p className="text-sm font-black text-foreground">
                    {activePlayer.attributes[config.attribute]}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mb-4">
                {[
                  { label: `+${config.attrGain} ${config.attribute.charAt(0).toUpperCase() + config.attribute.slice(1)}`, icon: "📈" },
                  { label: `+${config.xp} XP`, icon: "⭐" },
                  { label: `+${config.fpGain} FP`, icon: "🎯" },
                ].map((r) => (
                  <div key={r.label} className="flex-1 glass-card px-2 py-2 rounded-xl text-center">
                    <span className="text-sm">{r.icon}</span>
                    <p className="text-[10px] font-bold text-foreground mt-0.5">{r.label}</p>
                  </div>
                ))}
              </div>

              <div className="glass-card px-3 py-2 rounded-xl mb-4 flex items-center gap-2">
                <span className="text-sm">🏋️</span>
                <p className="text-[11px] text-muted-foreground">
                  Drill: <span className="text-foreground font-bold">{drill}</span>
                </p>
              </div>

              <button type="button" onClick={() => setStep("activity")}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-primary text-primary-foreground font-black text-sm flex items-center justify-center gap-2 glow-primary active:scale-[0.97] transition-transform">
                {config.cta} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === "activity" && (
            <div className="animate-fade-in text-center py-6">
              <div className="relative w-20 h-20 mx-auto mb-5">
                <div className="absolute inset-0 rounded-full border-4 border-muted" />
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="36" fill="none" strokeWidth="4"
                    stroke={config.color} strokeLinecap="round"
                    strokeDasharray={`${Math.min(progress, 100) * 2.26} 226`}
                    className="transition-all duration-300" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl">{progress >= 100 ? "✅" : config.emoji}</span>
                </div>
              </div>
              <p className="text-lg font-black text-foreground mb-1">{drill}</p>
              <p className="text-xs text-muted-foreground">
                {progress >= 100 ? "Complete!" : "In progress…"}
              </p>
              <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden max-w-[200px] mx-auto">
                <div className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(progress, 100)}%`, background: config.color }} />
              </div>
            </div>
          )}

          {step === "reward" && (
            <div className="animate-fade-in text-center py-4">
              <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ background: `${config.color} / 0.15` }}>
                <Check className="w-8 h-8" style={{ color: config.color }} />
              </div>
              <h3 className="text-xl font-black text-foreground mb-1">Zone Complete!</h3>
              <p className="text-xs text-muted-foreground mb-4">{zone.name}</p>

              <div className="flex gap-2 justify-center mb-5">
                {[
                  { label: `+${config.attrGain} ${config.attribute.charAt(0).toUpperCase() + config.attribute.slice(1)}`, icon: "📈" },
                  { label: `+${config.xp} XP`, icon: "⭐" },
                  { label: `+${config.fpGain} FP`, icon: "🎯" },
                ].map((r) => (
                  <div key={r.label} className="glass-card px-3 py-2 rounded-xl">
                    <span className="text-sm">{r.icon}</span>
                    <p className="text-[10px] font-bold text-foreground mt-0.5">{r.label}</p>
                  </div>
                ))}
              </div>

              <button type="button" onClick={onClose}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-primary text-primary-foreground font-black text-sm glow-primary active:scale-[0.97] transition-transform">
                Continue Exploring
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ZoneExperience;
