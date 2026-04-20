import { useState } from "react";
import { getPlayerById, mockRivals } from "@/data/mockData";
import { useGameProgress } from "@/context/GameProgressContext";
import { Swords, Trophy, ChevronRight } from "lucide-react";
import AnimatedPortrait from "./AnimatedPortrait";
import ChallengeFlow from "./ChallengeFlow";

const CompeteScreen = () => {
  const [challengeTarget, setChallengeTarget] = useState<number | null>(null);
  const { activePlayer, playersById } = useGameProgress();

  const challengeRival = challengeTarget !== null ? mockRivals[challengeTarget] : null;
  const challengeRivalPlayer = challengeRival
    ? playersById[challengeRival.signaturePlayerId] ?? getPlayerById(challengeRival.signaturePlayerId)
    : undefined;

  return (
    <div className="min-h-screen safe-page-bottom with-sidebar-pad pt-6 pr-4">
      <div className="mb-5">
        <h1 className="text-2xl font-black text-foreground">Compete</h1>
        <p className="text-xs text-muted-foreground mt-1">Challenge nearby rivals</p>
      </div>

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
          <div className="h-full rounded-full bg-gradient-to-r from-primary via-primary to-primary w-[65%] transition-all duration-700" />
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 font-medium">350 / 500 points to Gold I</p>
      </div>

      <div className="grid grid-cols-3 gap-2.5 mb-5">
        {[
          { label: "Wins", value: "7", icon: "🏆" },
          { label: "Losses", value: "3", icon: "💔" },
          { label: "Streak", value: "3🔥", icon: "⚡" },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-3 text-center">
            <p className="text-2xl font-black text-foreground">{stat.value}</p>
            <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      <h2 className="text-xs font-black text-foreground uppercase tracking-wider mb-3">Nearby Rivals</h2>
      <div className="space-y-2.5">
        {mockRivals.map((rival, i) => {
          const rivalPlayer =
            playersById[rival.signaturePlayerId] ?? getPlayerById(rival.signaturePlayerId);
          if (!rivalPlayer) return null;
          const youOvr = activePlayer.stats.overall;
          const themOvr = rivalPlayer.stats.overall;
          const sum = youOvr + themOvr;
          return (
            <div
              key={rival.id}
              className="glass-card p-4 animate-fade-in-up"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="flex items-start gap-2 mb-3">
                <div className="flex flex-1 min-w-0 flex-col items-center gap-1">
                  <AnimatedPortrait player={activePlayer} size="sm" />
                  <p className="text-[10px] font-black text-foreground break-words leading-tight w-full text-center">{activePlayer.name}</p>
                  <p className="text-[9px] text-muted-foreground w-full text-center">
                    {activePlayer.position} · {activePlayer.representedCountry}
                  </p>
                </div>
                <div className="flex flex-col items-center justify-center pt-2 shrink-0 px-1">
                  <Swords className="w-4 h-4 text-muted-foreground mb-0.5" />
                  <span className="text-[8px] text-muted-foreground font-bold uppercase">VS</span>
                </div>
                <div className="flex flex-1 min-w-0 flex-col items-center gap-1">
                  <AnimatedPortrait player={rivalPlayer} size="sm" />
                  <p className="text-[10px] font-black text-foreground break-words leading-tight w-full text-center">{rivalPlayer.name}</p>
                  <p className="text-[9px] text-muted-foreground w-full text-center">
                    {rivalPlayer.position} · {rivalPlayer.representedCountry}
                  </p>
                </div>
              </div>

              <p className="text-[9px] text-center text-muted-foreground mb-2 px-1">
                @{rival.name} · Lvl {rival.level}
              </p>

              <div className="flex items-center justify-between mb-3 px-1">
                <div className="text-center min-w-[2.5rem]">
                  <p className="text-lg font-black text-foreground">{youOvr}</p>
                  <p className="text-[9px] text-muted-foreground">You</p>
                </div>
                <div className="flex-1 mx-3">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-primary rounded-l-full"
                      style={{ width: `${(youOvr / sum) * 100}%` }}
                    />
                    <div
                      className="h-full bg-destructive/60 rounded-r-full"
                      style={{ width: `${(themOvr / sum) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-center min-w-[2.5rem]">
                  <p className="text-lg font-black text-foreground">{themOvr}</p>
                  <p className="text-[9px] text-muted-foreground break-words leading-tight text-center">{rivalPlayer.name}</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Trophy className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span className="text-[10px] text-accent font-bold truncate">+30 XP • +2 FP</span>
                </div>
                <button
                  type="button"
                  onClick={() => setChallengeTarget(i)}
                  className="shrink-0 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary text-primary-foreground text-xs font-black floating-button flex items-center gap-1.5"
                >
                  Challenge <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {challengeRival && challengeRivalPlayer && (
        <ChallengeFlow
          rival={challengeRival}
          rivalPlayer={challengeRivalPlayer}
          onClose={() => setChallengeTarget(null)}
        />
      )}
    </div>
  );
};

export default CompeteScreen;
