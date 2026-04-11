import { mockRivals } from "@/data/mockData";

const CompeteScreen = () => {
  return (
    <div className="min-h-screen pb-24 pt-6 px-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-foreground">Compete</h1>
        <p className="text-sm text-muted-foreground mt-1">Challenge nearby rivals</p>
      </div>

      {/* Division Progress */}
      <div className="glass-card p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-primary font-semibold uppercase tracking-wider">Division</p>
            <p className="text-lg font-bold text-foreground">Silver II</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Weekly Rank</p>
            <p className="text-lg font-bold text-accent">#42</p>
          </div>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 w-[65%]" />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">350 / 500 points to Gold I</p>
      </div>

      {/* Rival Cards */}
      <h2 className="text-sm font-bold text-foreground mb-3">Nearby Rivals</h2>
      <div className="space-y-3">
        {mockRivals.map((rival) => (
          <div key={rival.id} className="glass-card p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-lg font-bold text-secondary-foreground">
              {rival.name.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">{rival.name}</p>
              <p className="text-xs text-muted-foreground">Lvl {rival.level} • {rival.player} ({rival.overall})</p>
            </div>
            <button className="px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-emerald-400 text-primary-foreground text-xs font-bold floating-button">
              Challenge
            </button>
          </div>
        ))}
      </div>

      {/* Weekly Summary */}
      <div className="glass-card p-4 mt-6">
        <h3 className="text-sm font-bold text-foreground mb-3">This Week</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Wins", value: "7", color: "text-primary" },
            { label: "Losses", value: "3", color: "text-destructive" },
            { label: "Streak", value: "3🔥", color: "text-accent" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CompeteScreen;
