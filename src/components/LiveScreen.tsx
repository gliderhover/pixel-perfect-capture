import { mockLiveEvents } from "@/data/mockData";
import { Zap, Trophy, Gift, Clock } from "lucide-react";

const eventIcons: Record<string, typeof Zap> = {
  boost: Zap,
  match: Trophy,
  reward: Gift,
  limited: Clock,
};

const eventColors: Record<string, string> = {
  boost: "bg-primary/20 text-primary",
  match: "bg-blue-500/20 text-blue-400",
  reward: "bg-accent/20 text-accent",
  limited: "bg-purple-500/20 text-purple-400",
};

const LiveScreen = () => {
  return (
    <div className="min-h-screen pb-24 pt-6 px-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-foreground">Live</h1>
        <p className="text-sm text-muted-foreground mt-1">Real-time football updates</p>
      </div>

      {/* Event Banner */}
      <div className="glass-card p-5 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-1">⚡ Live Now</p>
        <h2 className="text-lg font-bold text-foreground mb-1">World Cup Qualifier</h2>
        <p className="text-sm text-muted-foreground mb-3">France vs Germany • 67'</p>
        <button className="px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-emerald-400 text-primary-foreground text-xs font-bold floating-button">
          Watch for Bonuses
        </button>
      </div>

      {/* Live Feed */}
      <h2 className="text-sm font-bold text-foreground mb-3">Recent Events</h2>
      <div className="space-y-3">
        {mockLiveEvents.map((event) => {
          const Icon = eventIcons[event.type];
          return (
            <div key={event.id} className="glass-card p-4 flex items-start gap-3 animate-fade-in">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${eventColors[event.type]}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">{event.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">{event.timeAgo}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LiveScreen;
