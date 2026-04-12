import { mockRivals } from "@/data/mockData";
import { Swords } from "lucide-react";

const CompeteScreen = () => {
  return (
    <div className="min-h-screen pb-28 pt-6 px-4">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-black text-foreground">Compete</h1>
        <p className="text-xs text-muted-foreground mt-1">Challenge nearby rivals</p>
      </div>

      {/* Division Card */}
      <div className="glass-card-strong p-5 mb-5 card-shimmer">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] text-primary font-black uppercase tracking-widest">Division</p>
            <p className="text-xl font-black text-foreground mt-0.5">Silver II</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Rank</p>
            <p className="text-xl font-black text-gradient-accent">#42</p>
          </div>
        </div>
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-primary via-emerald-400 to-primary w-[65%] transition-all duration-700" />
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 font-medium">350 / 500 points to Gold I</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        {[
          { label: "Wins", value: "7", color: "text-primary" },
          { label: "Losses", value: "3", color: "text-destructive" },
          { label: "Streak", value: "3🔥", color: "text-accent" },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-3 text-center">
            <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
            <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Rivals */}
      <h2 className="text-xs font-black text-foreground uppercase tracking-wider mb-3">Nearby Rivals</h2>
      <div className="space-y-2.5">
        {mockRivals.map((rival, i) => (
          <div key={rival.id} className="glass-card p-4 flex items-center gap-3.5 animate-fade-in-up" style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary to-muted flex items-center justify-center">
              <Swords className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-foreground">{rival.name}</p>
              <p className="text-[10px] text-muted-foreground">Lvl {rival.level} • {rival.player} ({rival.overall})</p>
            </div>
            <button className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-emerald-400 text-primary-foreground text-xs font-black floating-button">
              Challenge
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CompeteScreen;
