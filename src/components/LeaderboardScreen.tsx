import { useMemo, useState } from "react";
import {
  mockLeaderboardGlobal,
  mockLeaderboardRegion,
  portraitForEntry,
  type LeaderboardPeriod,
  type LeaderboardScope,
} from "@/data/leaderboardData";
import { useActivePlayer } from "@/context/GameProgressContext";
import { cn } from "@/lib/utils";
import { Flame, Globe, MapPinned } from "lucide-react";

function computeDisplayPower(overall: number, level: number, evo: number): number {
  return Math.round(overall * 64 + level * 18 + evo * 220);
}

const LeaderboardScreen = () => {
  const { activePlayer } = useActivePlayer();
  const [scope, setScope] = useState<LeaderboardScope>("global");
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");

  const list = scope === "global" ? mockLeaderboardGlobal : mockLeaderboardRegion;

  const yourPower = useMemo(
    () => computeDisplayPower(activePlayer.stats.overall, activePlayer.level, activePlayer.evolutionStage),
    [activePlayer.stats.overall, activePlayer.level, activePlayer.evolutionStage]
  );

  const yourRank = scope === "global" ? 42 : 5;

  return (
    <div className="min-h-[100dvh] safe-page-bottom with-sidebar-pad pr-4 pt-[max(12px,env(safe-area-inset-top))]">
      <div className="mb-4">
        <h1 className="text-2xl font-black text-foreground">Leaderboard</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Climb the ranks — stay sharp</p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="glass-card flex rounded-xl p-0.5">
          <button
            type="button"
            onClick={() => setScope("global")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
              scope === "global" ? "bg-primary/20 text-primary" : "text-muted-foreground"
            )}
          >
            <Globe className="h-3.5 w-3.5" /> Global
          </button>
          <button
            type="button"
            onClick={() => setScope("region")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
              scope === "region" ? "bg-primary/20 text-primary" : "text-muted-foreground"
            )}
          >
            <MapPinned className="h-3.5 w-3.5" /> Region
          </button>
        </div>
        <div className="glass-card flex rounded-xl p-0.5">
          <button
            type="button"
            onClick={() => setPeriod("weekly")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wide",
              period === "weekly" ? "bg-accent/15 text-accent" : "text-muted-foreground"
            )}
          >
            Weekly
          </button>
          <button
            type="button"
            onClick={() => setPeriod("all")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wide",
              period === "all" ? "bg-accent/15 text-accent" : "text-muted-foreground"
            )}
          >
            All time
          </button>
        </div>
      </div>

      <div className="glass-card-strong mb-4 flex items-center gap-3 rounded-2xl p-3 card-shimmer">
        <img
          src={activePlayer.portrait}
          alt=""
          className="h-12 w-12 shrink-0 rounded-xl border border-primary/30 object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary">Your rank</p>
          <p className="text-lg font-black text-foreground">#{yourRank}</p>
          <p className="truncate text-[10px] text-muted-foreground">
            Power {yourPower.toLocaleString()} · {activePlayer.name}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-bold text-muted-foreground">Coach Lv</p>
          <p className="text-sm font-black text-accent">{activePlayer.level}</p>
        </div>
      </div>

      <div className="space-y-2">
        {list.map((e) => {
          const top = e.rank <= 3;
          const portrait = portraitForEntry(e.playerId);
          return (
            <div
              key={`${e.rank}-${e.userName}`}
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors",
                top ? "border-accent/35 bg-accent/5" : "glass-card border-border/30",
                e.isYou && "ring-1 ring-primary/40"
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black",
                  e.rank === 1 && "bg-amber-500/20 text-amber-400",
                  e.rank === 2 && "bg-zinc-400/20 text-zinc-300",
                  e.rank === 3 && "bg-orange-700/25 text-orange-300",
                  e.rank > 3 && "bg-muted/40 text-muted-foreground"
                )}
              >
                {e.rank}
              </div>
              <img src={portrait} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-border/40 object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-black text-foreground">{e.userName}</p>
                <p className="truncate text-[10px] text-muted-foreground">{e.region}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-foreground">{e.teamPower.toLocaleString()}</p>
                <div className="flex items-center justify-end gap-1 text-[9px] font-bold text-primary">
                  <Flame className="h-3 w-3" /> {e.streak}
                </div>
                <p className="text-[9px] text-muted-foreground">Lv {e.coachLevel}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LeaderboardScreen;
