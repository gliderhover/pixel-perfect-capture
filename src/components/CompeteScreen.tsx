import { useState } from "react";
import { mockRivals, mockPlayers } from "@/data/mockData";
import { Swords, Trophy, ChevronRight, Shield } from "lucide-react";
import AnimatedPortrait from "./AnimatedPortrait";

const CompeteScreen = () => {
  const [challengeTarget, setChallengeTarget] = useState<number | null>(null);
  const activePlayer = mockPlayers[0];

  return (
    <div className="min-h-screen safe-pb-nav pt-6 px-4">
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
          <div className="h-full rounded-full bg-gradient-to-r from-primary via-primary to-primary w-[65%] transition-all duration-700" />
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 font-medium">350 / 500 points to Gold I</p>
      </div>

      {/* Stats row */}
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

      {/* Rivals */}
      <h2 className="text-xs font-black text-foreground uppercase tracking-wider mb-3">Nearby Rivals</h2>
      <div className="space-y-2.5">
        {mockRivals.map((rival, i) => {
          const rivalPlayer = mockPlayers[Math.min(i + 1, mockPlayers.length - 1)];
          return (
            <div
              key={rival.id}
              className="glass-card p-4 animate-fade-in-up"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              {/* Matchup header */}
              <div className="flex items-center gap-3 mb-3">
                <AnimatedPortrait player={activePlayer} size="sm" />
                <div className="flex-1 flex flex-col items-center">
                  <Swords className="w-5 h-5 text-muted-foreground mb-1" />
                  <span className="text-[9px] text-muted-foreground font-bold uppercase">VS</span>
                </div>
                <AnimatedPortrait player={rivalPlayer} size="sm" />
              </div>

              {/* Strength comparison */}
              <div className="flex items-center justify-between mb-3 px-2">
                <div className="text-center">
                  <p className="text-lg font-black text-foreground">{activePlayer.overall}</p>
                  <p className="text-[9px] text-muted-foreground">You</p>
                </div>
                <div className="flex-1 mx-4">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-primary rounded-l-full"
                      style={{ width: `${(activePlayer.overall / (activePlayer.overall + rival.overall)) * 100}%` }}
                    />
                    <div
                      className="h-full bg-destructive/60 rounded-r-full"
                      style={{ width: `${(rival.overall / (activePlayer.overall + rival.overall)) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-lg font-black text-foreground">{rival.overall}</p>
                  <p className="text-[9px] text-muted-foreground">{rival.name}</p>
                </div>
              </div>

              {/* Reward preview */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="w-3.5 h-3.5 text-accent" />
                  <span className="text-[10px] text-accent font-bold">+30 XP • Rare Pack</span>
                </div>
                <button
                  onClick={() => setChallengeTarget(i)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary text-primary-foreground text-xs font-black floating-button flex items-center gap-1.5"
                >
                  Challenge <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Challenge confirmation overlay */}
      {challengeTarget !== null && (
        <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-xl flex items-center justify-center p-6" onClick={() => setChallengeTarget(null)}>
          <div className="glass-card-strong p-6 w-full max-w-sm animate-encounter-reveal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center gap-6 mb-6">
              <div className="text-center">
                <AnimatedPortrait player={activePlayer} size="lg" showMood />
                <p className="text-xs font-black text-foreground mt-2">You</p>
              </div>
              <div className="flex flex-col items-center">
                <Swords className="w-8 h-8 text-primary mb-1" />
                <span className="text-xs font-black text-primary">VS</span>
              </div>
              <div className="text-center">
                <AnimatedPortrait player={mockPlayers[Math.min(challengeTarget + 1, mockPlayers.length - 1)]} size="lg" showMood />
                <p className="text-xs font-black text-foreground mt-2">{mockRivals[challengeTarget].name}</p>
              </div>
            </div>

            <div className="glass-card p-3 mb-5 flex items-center justify-center gap-2">
              <Trophy className="w-4 h-4 text-accent" />
              <span className="text-sm font-bold text-accent">Win: +30 XP • Rare Pack</span>
            </div>

            <button
              onClick={() => setChallengeTarget(null)}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary to-primary text-primary-foreground font-black text-sm floating-button glow-primary flex items-center justify-center gap-2"
            >
              <Swords className="w-4 h-4" /> Start Challenge
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompeteScreen;
