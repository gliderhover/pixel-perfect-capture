import { useState } from "react";
import { mockPlayers, rarityColors } from "@/data/mockData";
import type { Player } from "@/data/mockData";

const rarityBorder: Record<string, string> = {
  common: "border-zinc-500/40",
  rare: "border-blue-500/40",
  epic: "border-purple-500/40",
  legendary: "border-amber-400/40",
};

const SquadScreen = () => {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const filters = ["all", "legendary", "epic", "rare"];
  const filtered = filter === "all" ? mockPlayers : mockPlayers.filter((p) => p.rarity === filter);

  return (
    <div className="min-h-screen pb-24 pt-6 px-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-foreground">My Squad</h1>
        <p className="text-sm text-muted-foreground mt-1">{mockPlayers.length} players collected</p>
      </div>

      {/* Active Player */}
      <div className="glass-card p-4 mb-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xl font-black text-background glow-accent">
          95
        </div>
        <div className="flex-1">
          <p className="text-xs text-primary font-semibold uppercase tracking-wider">Active Player</p>
          <p className="text-lg font-bold text-foreground">Kylian Mbappé</p>
          <p className="text-xs text-muted-foreground">🇫🇷 ST • Legendary</p>
        </div>
        <div className="text-2xl">⭐</div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5 overflow-x-auto scrollbar-hide">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-all ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-2 gap-3">
        {filtered.map((player) => (
          <button
            key={player.id}
            onClick={() => setSelectedPlayer(player)}
            className={`glass-card p-4 text-left transition-all duration-200 active:scale-[0.97] border ${rarityBorder[player.rarity]}`}
          >
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${rarityColors[player.rarity]} flex items-center justify-center text-lg font-black text-background mb-3`}>
              {player.overall}
            </div>
            <p className="text-sm font-bold text-foreground truncate">{player.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{player.country} {player.position}</p>
            <span className={`inline-block text-[9px] font-bold uppercase mt-2 px-2 py-0.5 rounded-full bg-gradient-to-r ${
              player.rarity === "legendary" ? "from-amber-400/20 to-orange-500/20 text-accent" :
              player.rarity === "epic" ? "from-purple-500/20 to-purple-600/20 text-purple-400" :
              player.rarity === "rare" ? "from-blue-500/20 to-blue-600/20 text-blue-400" :
              "from-zinc-500/20 to-zinc-600/20 text-zinc-400"
            }`}>
              {player.rarity}
            </span>
          </button>
        ))}
      </div>

      {/* Player Detail Bottom Sheet */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm" onClick={() => setSelectedPlayer(null)}>
          <div className="bottom-sheet p-6 pb-8 animate-slide-up max-h-[70vh]" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-5" />
            <div className="flex items-center gap-4 mb-6">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${rarityColors[selectedPlayer.rarity]} flex items-center justify-center text-2xl font-black text-background`}>
                {selectedPlayer.overall}
              </div>
              <div>
                <h3 className="text-xl font-black text-foreground">{selectedPlayer.name}</h3>
                <p className="text-sm text-muted-foreground">{selectedPlayer.country} {selectedPlayer.position} • {selectedPlayer.rarity}</p>
              </div>
            </div>

            {/* Attributes */}
            <div className="space-y-3 mb-6">
              {Object.entries(selectedPlayer.attributes).map(([key, value]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground capitalize w-20">{key === "fanBond" ? "Fan Bond" : key}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-500"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-foreground w-8 text-right">{value}</span>
                </div>
              ))}
            </div>

            <button className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-emerald-400 text-primary-foreground font-bold text-sm floating-button">
              Set as Active
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SquadScreen;
