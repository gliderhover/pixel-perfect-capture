import { useState } from "react";
import { mockLiveEvents } from "@/data/mockData";
import { Zap, Trophy, Gift, Clock, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

const eventConfig: Record<string, {
  icon: typeof Zap;
  bg: string;
  border: string;
  text: string;
  glow: string;
  emoji: string;
}> = {
  boost: {
    icon: Zap,
    bg: "bg-primary/10",
    border: "border-primary/25",
    text: "text-primary",
    glow: "glow-primary",
    emoji: "⚡",
  },
  match: {
    icon: Trophy,
    bg: "bg-accent/10",
    border: "border-accent/25",
    text: "text-accent",
    glow: "glow-accent",
    emoji: "⚽",
  },
  reward: {
    icon: Gift,
    bg: "bg-primary/10",
    border: "border-primary/25",
    text: "text-primary",
    glow: "",
    emoji: "🎁",
  },
  limited: {
    icon: Clock,
    bg: "bg-glow-epic/10",
    border: "border-glow-epic/25",
    text: "text-glow-epic",
    glow: "glow-epic",
    emoji: "⏰",
  },
};

// Simulated match events with attribute deltas
const matchEvents = [
  { id: "me1", type: "goal", player: "Mbappé", minute: "67'", delta: "+5 Form", mood: "🔥", visual: "celebratory" },
  { id: "me2", type: "assist", player: "Bellingham", minute: "67'", delta: "+3 Confidence", mood: "💪", visual: "energetic" },
  { id: "me3", type: "injury", player: "Pedri", minute: "54'", delta: "-4 Form", mood: "😰", visual: "serious" },
  { id: "me4", type: "yellow", player: "Foden", minute: "41'", delta: "-2 Morale", mood: "😤", visual: "tense" },
  { id: "me5", type: "cleansheet", player: "Vinícius Jr", minute: "90'", delta: "+3 Morale", mood: "😎", visual: "stable" },
];

const eventTypeStyles: Record<string, { bg: string; border: string; icon: string; label: string }> = {
  goal: { bg: "bg-primary/15", border: "border-primary/30", icon: "⚽", label: "GOAL" },
  assist: { bg: "bg-accent/15", border: "border-accent/30", icon: "🎯", label: "ASSIST" },
  injury: { bg: "bg-destructive/15", border: "border-destructive/30", icon: "🏥", label: "INJURY" },
  yellow: { bg: "bg-accent/20", border: "border-accent/40", icon: "🟨", label: "YELLOW CARD" },
  cleansheet: { bg: "bg-primary/10", border: "border-primary/20", icon: "🛡️", label: "CLEAN SHEET" },
};

const LiveScreen = () => {
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  return (
    <div className="min-h-screen pb-28 pt-6 px-4">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-black text-foreground">Live</h1>
        <p className="text-xs text-muted-foreground mt-1">Real-time match impact</p>
      </div>

      {/* Live Match Banner */}
      <div className="glass-card-strong p-5 mb-5 relative overflow-hidden card-shimmer">
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-primary/8 rounded-full blur-xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            <p className="text-[10px] text-destructive font-black uppercase tracking-widest">Live Now</p>
          </div>
          <h2 className="text-xl font-black text-foreground mb-1">World Cup Qualifier</h2>
          <p className="text-sm text-muted-foreground mb-4">France vs Germany • 67'</p>
          <button className="px-5 py-3 rounded-xl bg-gradient-to-r from-primary to-primary text-primary-foreground text-xs font-black floating-button glow-primary">
            Watch for Bonuses ⚡
          </button>
        </div>
      </div>

      {/* Match Events - dramatic cards */}
      <h2 className="text-xs font-black text-foreground uppercase tracking-wider mb-3">Match Events</h2>
      <div className="space-y-2.5 mb-6">
        {matchEvents.map((event, i) => {
          const style = eventTypeStyles[event.type];
          const isPositive = !event.delta.startsWith("-");
          return (
            <div
              key={event.id}
              className={`glass-card p-4 border ${style.border} animate-fade-in-up relative overflow-hidden`}
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              {/* Subtle type-specific background glow */}
              <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full ${style.bg} blur-xl`} />
              
              <div className="relative flex items-center gap-3">
                {/* Event type icon */}
                <div className={`w-12 h-12 rounded-xl ${style.bg} flex items-center justify-center text-xl shrink-0`}>
                  {style.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${style.bg} ${
                      event.type === "goal" ? "text-primary" :
                      event.type === "assist" ? "text-accent" :
                      event.type === "injury" ? "text-destructive" :
                      event.type === "yellow" ? "text-accent" :
                      "text-primary"
                    }`}>
                      {style.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{event.minute}</span>
                  </div>
                  <p className="text-sm font-bold text-foreground">{event.player}</p>
                </div>

                {/* Attribute delta chip */}
                <div className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
                  isPositive ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
                }`}>
                  {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  <span className="text-xs font-black">{event.delta}</span>
                </div>

                {/* Mood */}
                <span className="text-lg shrink-0">{event.mood}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Feed */}
      <h2 className="text-xs font-black text-foreground uppercase tracking-wider mb-3">Recent Updates</h2>
      <div className="space-y-2.5">
        {mockLiveEvents.map((event, i) => {
          const config = eventConfig[event.type];
          const Icon = config.icon;
          return (
            <div key={event.id} className={`glass-card p-4 flex items-start gap-3 animate-fade-in-up border ${config.border}`} style={{ animationDelay: `${i * 0.06}s` }}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${config.bg}`}>
                <Icon className={`w-5 h-5 ${config.text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">{event.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{event.description}</p>
              </div>
              <span className="text-[9px] text-muted-foreground shrink-0 font-medium">{event.timeAgo}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LiveScreen;
