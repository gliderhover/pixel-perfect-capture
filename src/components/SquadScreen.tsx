import { useState } from "react";
import { mockPlayers } from "@/data/mockData";
import type { Player } from "@/data/mockData";
import { useGameProgress } from "@/context/GameProgressContext";
import AnimatedPortrait from "./AnimatedPortrait";
import { type AppTab } from "@/components/FoldableSidebar";

const rarityBorder: Record<string, string> = {
  common: "border-zinc-500/20",
  rare: "border-blue-500/20",
  epic: "border-purple-500/20",
  legendary: "border-amber-400/20",
};

const evoLabel = ["Rookie", "Developing", "Rising", "Elite"] as const;

interface SquadScreenProps {
  onNavigate?: (tab: AppTab) => void;
}

const SquadScreen = ({ onNavigate }: SquadScreenProps) => {
  const {
    activePlayer,
    setActivePlayerId,
    playersById,
    ownedPlayersById,
    tryEvolutionUpgrade,
    playersLoading,
    playersError,
    usingMockPlayers,
  } = useGameProgress();
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const ownedIds = Object.keys(ownedPlayersById);
  const roster = ownedIds
    .map((id) => playersById[id] ?? mockPlayers.find((m) => m.id === id))
    .filter((player): player is Player => Boolean(player));

  const filters = ["all", "legendary", "epic", "rare"];
  const filtered = filter === "all" ? roster : roster.filter((p) => p.rarity === filter);

  const detail = selectedPlayer ? playersById[selectedPlayer.id] ?? selectedPlayer : null;

  return (
    <div className="min-h-screen safe-page-bottom with-sidebar-pad pt-6 pr-4">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-black text-foreground">My Squad</h1>
        <p className="text-xs text-muted-foreground mt-1">{roster.length} players collected</p>
        {playersLoading && <p className="text-[10px] text-muted-foreground mt-1">Loading players...</p>}
        {playersError && <p className="text-[10px] text-destructive mt-1">Player API unavailable, using fallback</p>}
        {!playersLoading && !playersError && roster.length === 0 && (
          <p className="text-[10px] text-muted-foreground mt-1">
            No recruits yet. Explore and win penalty duels to add players.
          </p>
        )}
        {!playersLoading && !playersError && !usingMockPlayers && (
          <p className="text-[10px] text-primary mt-1">Live player feed</p>
        )}
      </div>

      {/* Active Player Hero */}
      <div className="glass-card-strong p-4 mb-5 flex items-center gap-4 card-shimmer">
        <AnimatedPortrait player={activePlayer} size="md" showMood />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-primary font-black uppercase tracking-widest">Active Player</p>
          <p className="text-lg font-black text-foreground mt-0.5 leading-tight">{activePlayer.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
            {activePlayer.position} · {activePlayer.nationalTeam}
          </p>
            <p className="text-[10px] text-primary font-bold mt-1">
              Lv {activePlayer.level} · {evoLabel[activePlayer.evolutionStage]} · OVR {activePlayer.stats.overall}
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
      {roster.length === 0 && !playersLoading && (
        <div className="col-span-2 glass-card-strong p-6 rounded-2xl text-center mt-2">
          <div className="text-4xl mb-3">🗺️</div>
          <p className="text-sm font-black text-foreground mb-1">No players yet</p>
          <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
            Head to the map, challenge a player to a penalty duel, and save the shot to recruit them.
          </p>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate("explore")}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-emerald-400 text-primary-foreground font-black text-xs floating-button glow-primary"
            >
              Go to Explore Map →
            </button>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {filtered.map((player, i) => (
          <button
            key={player.id}
            onClick={() => setSelectedPlayer(player)}
            className={`glass-card p-4 text-left transition-all duration-300 active:scale-[0.96] border ${rarityBorder[player.rarity]} card-shimmer animate-fade-in-up group`}
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <AnimatedPortrait player={player} size="sm" />
            <p className="text-sm font-black text-foreground leading-tight line-clamp-2 mt-3">{player.name}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{player.position}</p>
            <p className="text-[9px] text-muted-foreground/90 mt-0.5">{player.nationalTeam}</p>
            <p className="text-[9px] font-bold text-primary/90 mt-1">Lv {player.level} · OVR {player.stats.overall}</p>
          </button>
        ))}
      </div>

      {/* Player Detail Sheet */}
      {detail && (
        <div className="fixed inset-0 z-[1350] bg-background/60 backdrop-blur-md" onClick={() => setSelectedPlayer(null)}>
          <div className="bottom-sheet p-6 pb-8 animate-slide-up max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-5" />

            <div className="flex flex-col items-center mb-4 animate-encounter-reveal">
              <AnimatedPortrait player={detail} size="xl" showMood />
              <h3 className="text-2xl font-black text-foreground mt-4 text-center px-2">{detail.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Age {detail.age} · {detail.position}
              </p>
              <p className="text-xs text-primary font-semibold mt-1 text-center px-4">
                {detail.nationalTeam}
              </p>
              <div className="mt-3 w-full max-w-xs space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
                  <span>
                    Level {detail.level} · {evoLabel[detail.evolutionStage]}
                  </span>
                  <span>{detail.currentXp} / {detail.xpToNext} XP</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400"
                    style={{ width: `${Math.min(100, (detail.currentXp / detail.xpToNext) * 100)}%` }}
                  />
                </div>
                <p className="text-center text-[10px] text-muted-foreground">
                  Shards {detail.shardsCollected}/10 to evolve
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 text-center max-w-xs leading-snug">
                {detail.traits[0]}
              </p>
            </div>

            {/* Core stats — compact */}
            <div className="grid grid-cols-3 gap-2 mb-5 text-center">
              {(
                [
                  ["PAC", detail.stats.pace],
                  ["SHO", detail.stats.shooting],
                  ["PAS", detail.stats.passing],
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
              {Object.entries(detail.attributes).map(([key, value]) => (
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

            {detail.shardsCollected >= 10 && detail.evolutionStage < 3 && (
              <button
                type="button"
                onClick={() => {
                  tryEvolutionUpgrade(detail.id);
                }}
                className="mb-3 w-full py-3 rounded-2xl border border-accent/40 bg-accent/10 text-accent font-black text-xs floating-button"
              >
                Evolve (uses 10 shards)
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setActivePlayerId(detail.id);
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
