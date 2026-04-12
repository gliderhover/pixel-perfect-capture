import { mockLiveEvents } from "@/data/mockData";
import { Zap, Trophy, Gift, Clock } from "lucide-react";

const eventIcons: Record<string, typeof Zap> = {
  boost: Zap,
  match: Trophy,
  reward: Gift,
  limited: Clock,
};

const eventGlows: Record<string, string> = {
  boost: "bg-primary/15 text-primary border-primary/20",
  match: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  reward: "bg-accent/15 text-accent border-accent/20",
  limited: "bg-purple-500/15 text-purple-400 border-purple-500/20",
};

const LiveScreen = () => {
  return (
    <div className="min-h-screen pb-28 pt-6 px-4">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-black text-foreground">Live</h1>
        <p className="text-xs text-muted-foreground mt-1">Real-time football updates</p>
      </div>

      {/* Live Match Banner */}
      <div className="glass-card-strong p-5 mb-5 relative overflow-hidden card-shimmer">
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-primary/8 rounded-full blur-xl" />
        <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-accent/8 rounded-full blur-xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            <p className="text-[10px] text-destructive font-black uppercase tracking-widest">Live Now</p>
          </div>
          <h2 className="text-xl font-black text-foreground mb-1">World Cup Qualifier</h2>
          <p className="text-sm text-muted-foreground mb-4">France vs Germany • 67'</p>
          <button className="px-5 py-3 rounded-xl bg-gradient-to-r from-primary to-emerald-400 text-primary-foreground text-xs font-black floating-button glow-primary">
            Watch for Bonuses ⚡
          </button>
        </div>
      </div>

      {/* Events Feed */}
      <h2 className="text-xs font-black text-foreground uppercase tracking-wider mb-3">Recent Events</h2>
      <div className="space-y-2.5">
        {mockLiveEvents.map((event, i) => {
          const Icon = eventIcons[event.type];
          return (
            <div key={event.id} className="glass-card p-4 flex items-start gap-3 animate-fade-in-up" style={{ animationDelay: `${i * 0.06}s` }}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${eventGlows[event.type]}`}>
                <Icon className="w-5 h-5" />
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
