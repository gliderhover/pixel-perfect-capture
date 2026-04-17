import { useState } from "react";
import { mockPlayers } from "@/data/mockData";
import AnimatedPortrait from "./AnimatedPortrait";

const ONBOARD_KEY = "ppc-onboarded";

// Pick a small fixed set of players for visuals
const featuredPlayers = mockPlayers.filter((p) => p.rarity === "legendary").slice(0, 3);
const epicPlayers = mockPlayers.filter((p) => p.rarity === "epic").slice(0, 4);
const commonPlayer = mockPlayers.find((p) => p.rarity === "common") ?? mockPlayers[0];

const SlideExplore = () => (
  <div className="relative w-full h-44 mb-6 flex items-center justify-center">
    {/* Dark map-like backdrop */}
    <div className="absolute inset-0 rounded-2xl overflow-hidden"
      style={{ background: "linear-gradient(135deg, hsl(225 30% 6%), hsl(225 30% 10%))" }}>
      {/* Grid lines suggesting a map */}
      <div className="absolute inset-0 opacity-[0.06]" style={{
        backgroundImage: `repeating-linear-gradient(0deg, hsl(var(--foreground)) 0px, transparent 1px, transparent 32px),
                          repeating-linear-gradient(90deg, hsl(var(--foreground)) 0px, transparent 1px, transparent 32px)`,
      }} />
      {/* Subtle glow patches */}
      <div className="absolute top-4 left-8 w-16 h-16 rounded-full blur-xl opacity-20"
        style={{ background: "hsl(42 95% 55%)" }} />
      <div className="absolute bottom-6 right-10 w-12 h-12 rounded-full blur-xl opacity-15"
        style={{ background: "hsl(270 60% 55%)" }} />
      <div className="absolute top-10 right-6 w-10 h-10 rounded-full blur-lg opacity-15"
        style={{ background: "hsl(210 80% 55%)" }} />
    </div>

    {/* Scattered player markers */}
    <div className="absolute top-5 left-10 animate-float-slow">
      <div className="flex flex-col items-center gap-1">
        <AnimatedPortrait player={featuredPlayers[0] ?? mockPlayers[0]} size="sm" />
        <span className="text-[8px] font-black text-amber-400 bg-background/80 px-1.5 rounded-full">LEGENDARY</span>
      </div>
    </div>
    <div className="absolute bottom-6 left-6 animate-float-slow" style={{ animationDelay: "1.2s" }}>
      <div className="flex flex-col items-center gap-1">
        <AnimatedPortrait player={epicPlayers[0] ?? mockPlayers[1]} size="xs" />
        <span className="text-[7px] font-black text-purple-400 bg-background/80 px-1 rounded-full">EPIC</span>
      </div>
    </div>
    <div className="absolute top-6 right-8 animate-float-slow" style={{ animationDelay: "0.6s" }}>
      <div className="flex flex-col items-center gap-1">
        <AnimatedPortrait player={featuredPlayers[1] ?? mockPlayers[2]} size="sm" />
        <span className="text-[8px] font-black text-amber-400 bg-background/80 px-1.5 rounded-full">LEGENDARY</span>
      </div>
    </div>
    <div className="absolute bottom-4 right-5 animate-float-slow" style={{ animationDelay: "1.8s" }}>
      <AnimatedPortrait player={epicPlayers[1] ?? mockPlayers[3]} size="xs" />
    </div>

    {/* Scan button hint */}
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 glass-card px-3 py-1.5 rounded-xl">
      <span className="text-xs">📍</span>
      <span className="text-[9px] font-bold text-primary">Tap a marker to challenge</span>
    </div>
  </div>
);

const SlideDuel = () => (
  <div className="relative w-full h-44 mb-6 flex items-center justify-center">
    <div className="absolute inset-0 rounded-2xl overflow-hidden"
      style={{ background: "linear-gradient(160deg, hsl(225 35% 4%), hsl(225 30% 8%))" }}>
      {/* Stadium light cones */}
      <div className="absolute top-0 left-[20%] w-20 h-32 opacity-[0.07]"
        style={{ background: "linear-gradient(180deg, hsl(45 80% 90%), transparent)", transform: "rotate(-8deg)" }} />
      <div className="absolute top-0 right-[20%] w-20 h-32 opacity-[0.07]"
        style={{ background: "linear-gradient(180deg, hsl(45 80% 90%), transparent)", transform: "rotate(8deg)" }} />
      {/* Pitch glow */}
      <div className="absolute bottom-0 inset-x-0 h-16 opacity-20"
        style={{ background: "linear-gradient(to top, hsl(153 40% 15%), transparent)" }} />
    </div>

    {/* Shooter portrait */}
    <div className="absolute top-4 left-1/2 -translate-x-1/2">
      <AnimatedPortrait player={featuredPlayers[2] ?? mockPlayers[4]} size="sm" />
    </div>

    {/* Mini goal frame */}
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-48 h-24"
      style={{
        border: "2.5px solid hsl(var(--foreground) / 0.2)",
        borderBottom: "none",
        borderRadius: "8px 8px 0 0",
        background: "linear-gradient(175deg, hsl(var(--foreground) / 0.03), transparent)",
      }}>
      {/* Net */}
      <div className="absolute inset-0 rounded-t-lg opacity-[0.05]" style={{
        backgroundImage: `repeating-linear-gradient(90deg, hsl(var(--foreground)) 0px, transparent 1px, transparent 12px),
                          repeating-linear-gradient(0deg, hsl(var(--foreground)) 0px, transparent 1px, transparent 12px)`,
      }} />
      {/* Zone dividers */}
      <div className="absolute top-0 bottom-0 left-[33.3%] w-px bg-foreground/8" />
      <div className="absolute top-0 bottom-0 left-[66.6%] w-px bg-foreground/8" />
      {/* Ball in top-right corner */}
      <div className="absolute text-lg" style={{ right: "10%", top: "20%" }}>⚽</div>
      {/* Keeper diving left */}
      <div className="absolute bottom-1 text-2xl" style={{ left: "5%" }}>🧤</div>
      {/* Goal flash */}
      <div className="absolute inset-0 rounded-t-lg"
        style={{ background: "hsl(var(--destructive) / 0.08)" }} />
    </div>

    {/* Dive buttons hint */}
    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
      {(["←", "↑", "→"] as const).map((arrow, i) => (
        <div key={i} className="glass-card w-8 h-8 flex items-center justify-center rounded-lg">
          <span className="text-xs font-black text-primary">{arrow}</span>
        </div>
      ))}
    </div>
  </div>
);

const SlideTrain = () => {
  const chatPlayer = commonPlayer;
  return (
    <div className="relative w-full h-44 mb-6 flex flex-col justify-center gap-2 px-2">
      <div className="absolute inset-0 rounded-2xl overflow-hidden"
        style={{ background: "linear-gradient(135deg, hsl(225 30% 6%), hsl(225 30% 10%))" }} />

      {/* Player message */}
      <div className="relative flex items-end gap-2">
        <AnimatedPortrait player={chatPlayer} size="xs" />
        <div className="glass-card px-3 py-2 rounded-2xl rounded-bl-sm max-w-[70%]">
          <p className="text-[10px] font-bold text-foreground/90 leading-snug">
            "I need to work on my shooting today."
          </p>
        </div>
      </div>

      {/* User message (right-aligned) */}
      <div className="relative flex justify-end">
        <div className="px-3 py-2 rounded-2xl rounded-br-sm max-w-[70%]"
          style={{ background: "hsl(var(--primary) / 0.2)", border: "1px solid hsl(var(--primary) / 0.3)" }}>
          <p className="text-[10px] font-bold text-primary leading-snug">
            "Focus on composure and placement."
          </p>
        </div>
      </div>

      {/* Stat boost chips */}
      <div className="relative flex gap-1.5 mt-1 flex-wrap">
        {["Confidence +3", "Form +2", "Morale +1"].map((stat) => (
          <span key={stat} className="text-[8px] px-2 py-0.5 rounded-full font-black"
            style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))", border: "1px solid hsl(var(--primary) / 0.2)" }}>
            {stat}
          </span>
        ))}
      </div>

      {/* Active players row */}
      <div className="relative flex items-center gap-2 mt-1">
        <div className="flex -space-x-2">
          {epicPlayers.slice(0, 4).map((p) => (
            <div key={p.id} className="w-6 h-6 rounded-full overflow-hidden ring-1 ring-background">
              <AnimatedPortrait player={p} size="xs" />
            </div>
          ))}
        </div>
        <p className="text-[8px] text-muted-foreground font-medium">Train your whole squad</p>
      </div>
    </div>
  );
};

const slides = [
  {
    title: "Find Your Player",
    body: "Explore the map across North America. Tap any player marker to challenge them to a penalty duel.",
    visual: <SlideExplore />,
  },
  {
    title: "Win the Penalty Duel",
    body: "Watch the ball fly and swipe left, right, or tap center to dive. Save the shot and recruit them.",
    visual: <SlideDuel />,
  },
  {
    title: "Train Daily",
    body: "Chat with your players every day. Your words shape their Confidence, Form, Morale, and Fan Bond.",
    visual: <SlideTrain />,
  },
];

interface OnboardingSheetProps {
  onDone: () => void;
}

const OnboardingSheet = ({ onDone }: OnboardingSheetProps) => {
  const [slide, setSlide] = useState(0);
  const isLast = slide === slides.length - 1;

  const advance = () => {
    if (isLast) {
      localStorage.setItem(ONBOARD_KEY, "1");
      onDone();
    } else {
      setSlide((s) => s + 1);
    }
  };

  const skip = () => {
    localStorage.setItem(ONBOARD_KEY, "1");
    onDone();
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-background/80 backdrop-blur-sm flex items-end">
      <div className="w-full bg-card border-t border-border/30 rounded-t-3xl px-5 pt-5 pb-10 animate-slide-up">
        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mb-5">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === slide ? "w-6 bg-primary" : "w-1.5 bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Slide visual */}
        {slides[slide].visual}

        {/* Text */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-black text-foreground mb-2">{slides[slide].title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
            {slides[slide].body}
          </p>
        </div>

        <button
          type="button"
          onClick={advance}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary to-emerald-400 text-primary-foreground font-black text-sm floating-button glow-primary"
        >
          {isLast ? "Let's Go ⚡" : "Next →"}
        </button>
        {!isLast && (
          <button
            type="button"
            onClick={skip}
            className="w-full py-3 text-xs text-muted-foreground mt-1"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
};

export const shouldShowOnboarding = (): boolean =>
  !localStorage.getItem(ONBOARD_KEY);

export default OnboardingSheet;
