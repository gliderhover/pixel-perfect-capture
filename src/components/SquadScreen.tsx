import { useState } from "react";
import { mockPlayers } from "@/data/mockData";
import type { Player } from "@/data/mockData";
import { useActivePlayer } from "@/context/ActivePlayerContext";
import AnimatedPortrait from "./AnimatedPortrait";

const rarityBorder: Record<string, string> = {
  common: "border-zinc-500/20",
  rare: "border-blue-500/20",
  epic: "border-purple-500/20",
  legendary: "border-amber-400/20",
};

const SquadScreen = () => {
  const { activePlayer, setActivePlayerId } = useActivePlayer();
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const filters = ["all", "legendary", "epic", "rare"];
  const filtered = filter === "all" ? mockPlayers : mockPlayers.filter((p) => p.rarity === filter);

  return (
    <div className="min-h-screen safe-pb-nav pt-6 px-4">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-black text-foreground">My Squad</h1>
        <p className="text-xs text-muted-foreground mt-1">{mockPlayers.length} players collected</p>
      </div>

      {/* Active Player Hero */}
      <div className="glass-card-strong p-4 mb-5 flex items-center gap-4 card-shimmer">
        <AnimatedPortrait player={activePlayer} size="md" showMood />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-primary font-black uppercase tracking-widest">Active Player</p>
          <p className="text-lg font-black text-foreground mt-0.5 truncate">{activePlayer.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {activePlayer.position} · {activePlayer.clubTeam}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5 overflow-x-auto scrollbar-hide">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all ${
              filter === f
                ? "bg-primary/15 text-primary border border-primary/30"
                : "glass-card text-muted-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-2 gap-3">
        {filtered.map((player, i) => (
          <button
            key={player.id}
            onClick={() => setSelectedPlayer(player)}
            className={`glass-card p-4 text-left transition-all duration-300 active:scale-[0.96] border ${rarityBorder[player.rarity]} card-shimmer animate-fade-in-up group`}
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <AnimatedPortrait player={player} size="sm" />
            <p className="text-sm font-black text-foreground truncate mt-3">{player.name}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{player.position}</p>
            <p className="text-[9px] text-muted-foreground/90 mt-0.5 truncate">{player.clubTeam}</p>
          </button>
        ))}
      </div>

      {/* Player Detail Sheet */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-[1350] bg-background/60 backdrop-blur-md" onClick={() => setSelectedPlayer(null)}>
          <div className="bottom-sheet p-6 pb-8 animate-slide-up max-h-[75vh]" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-5" />

            <div className="flex flex-col items-center mb-5 animate-encounter-reveal">
              <AnimatedPortrait player={selectedPlayer} size="xl" showMood />
              <h3 className="text-2xl font-black text-foreground mt-4 text-center px-2">{selectedPlayer.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Age {selectedPlayer.age} · {selectedPlayer.position}
              </p>
              <p className="text-xs text-foreground/90 mt-1 text-center px-4">{selectedPlayer.clubTeam}</p>
              <p className="text-xs text-primary font-semibold mt-0.5">
                {selectedPlayer.representedCountry} · {selectedPlayer.nationalTeam}
              </p>
              <p className="text-[10px] text-muted-foreground mt-2 text-center max-w-xs leading-snug">
                {selectedPlayer.traits[0]}
              </p>
            </div>

            {/* Core stats — compact */}
            <div className="grid grid-cols-3 gap-2 mb-5 text-center">
              {(
                [
                  ["PAC", selectedPlayer.stats.pace],
                  ["SHO", selectedPlayer.stats.shooting],
                  ["PAS", selectedPlayer.stats.passing],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="glass-card py-2 rounded-xl">
                  <p className="text-lg font-black text-foreground">{v}</p>
                  <p className="text-[9px] text-muted-foreground font-bold">{k}</p>
                </div>
              ))}
            </div>

            {/* Attributes */}
            <div className="space-y-3 mb-6">
              {Object.entries(selectedPlayer.attributes).map(([key, value]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground capitalize w-20 font-medium">{key === "fanBond" ? "Fan Bond" : key}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-700"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                  <span className="text-xs font-black text-foreground w-8 text-right">{value}</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setActivePlayerId(selectedPlayer.id);
                setSelectedPlayer(null);
              }}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary via-emerald-400 to-primary text-primary-foreground font-black text-sm floating-button glow-primary"
            >
              Set as Active
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SquadScreen;
