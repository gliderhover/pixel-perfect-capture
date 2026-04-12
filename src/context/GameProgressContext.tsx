import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  computeOverallFromStats,
  getPlayerById,
  mockPlayers,
  type MapZone,
  type Player,
  type PlayerStats,
} from "@/data/mockData";

const STORAGE_KEY = "ppc-game-progress-v2";

type MatchPhase = "idle" | "prematch" | "live" | "halftime" | "postwin" | "postloss";
type LivePulse = "goal" | "injury" | "neutral";

function normalizePlayer(p: Player): Player {
  const overall = computeOverallFromStats(p.stats);
  return { ...p, stats: { ...p.stats, overall } };
}

function cloneInitialRoster(): Record<string, Player> {
  return Object.fromEntries(mockPlayers.map((p) => [p.id, normalizePlayer({ ...p })]));
}

function loadStored(): Record<string, Player> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, Player>;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

type GameProgressContextValue = {
  activePlayer: Player;
  setActivePlayerId: (id: string) => void;
  playersById: Record<string, Player>;
  updatePlayer: (id: string, patch: Partial<Player>) => void;
  /** Exploration zone last opened on map — drives chat flavor. */
  explorationZoneType: MapZone["type"] | null;
  setExplorationZoneType: (z: MapZone["type"] | null) => void;
  matchPhase: MatchPhase;
  setMatchPhase: (m: MatchPhase) => void;
  livePulse: LivePulse;
  setLivePulse: (p: LivePulse) => void;
  competitiveStreak: number;
  addXp: (playerId: string, amount: number) => void;
  addBond: (playerId: string, delta: number) => void;
  addShards: (playerId: string, n: number) => void;
  applyAttributeDelta: (playerId: string, delta: Partial<Player["attributes"]>) => void;
  tryEvolutionUpgrade: (playerId: string) => boolean;
  bumpStats: (playerId: string, bump: Partial<PlayerStats>) => void;
};

const GameProgressContext = createContext<GameProgressContextValue | null>(null);

export function GameProgressProvider({ children }: { children: ReactNode }) {
  const [playersById, setPlayersById] = useState<Record<string, Player>>(() => {
    const s = loadStored();
    const first = s && mockPlayers[0]?.id ? s[mockPlayers[0].id] : null;
    if (s && first && typeof first.level === "number" && typeof first.bondTrust === "number") return s;
    return cloneInitialRoster();
  });
  const [activePlayerId, setActivePlayerIdState] = useState(mockPlayers[0]?.id ?? "1");
  const [explorationZoneType, setExplorationZoneType] = useState<MapZone["type"] | null>(null);
  const [matchPhase, setMatchPhase] = useState<MatchPhase>("prematch");
  const [livePulse, setLivePulse] = useState<LivePulse>("neutral");
  const [competitiveStreak] = useState(3);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(playersById));
  }, [playersById]);

  const activePlayer = useMemo(() => {
    const p = playersById[activePlayerId] ?? playersById[mockPlayers[0].id];
    return p ? normalizePlayer(p) : normalizePlayer({ ...mockPlayers[0] });
  }, [playersById, activePlayerId]);

  const setActivePlayerId = useCallback((id: string) => {
    if (getPlayerById(id)) setActivePlayerIdState(id);
  }, []);

  const updatePlayer = useCallback((id: string, patch: Partial<Player>) => {
    setPlayersById((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      const next = normalizePlayer({ ...cur, ...patch, stats: { ...cur.stats, ...patch.stats } });
      return { ...prev, [id]: next };
    });
  }, []);

  const addXp = useCallback((playerId: string, amount: number) => {
    setPlayersById((prev) => {
      const cur = prev[playerId];
      if (!cur) return prev;
      let xp = cur.currentXp + amount;
      let level = cur.level;
      let xpToNext = cur.xpToNext;
      while (xp >= xpToNext && level < 99) {
        xp -= xpToNext;
        level += 1;
        xpToNext = 80 + level * 40;
      }
      const next = normalizePlayer({
        ...cur,
        level,
        currentXp: xp,
        xpToNext,
      });
      return { ...prev, [playerId]: next };
    });
  }, []);

  const addBond = useCallback((playerId: string, delta: number) => {
    setPlayersById((prev) => {
      const cur = prev[playerId];
      if (!cur) return prev;
      const bondTrust = Math.min(100, Math.max(0, cur.bondTrust + delta));
      return { ...prev, [playerId]: { ...cur, bondTrust } };
    });
  }, []);

  const addShards = useCallback((playerId: string, n: number) => {
    setPlayersById((prev) => {
      const cur = prev[playerId];
      if (!cur) return prev;
      return { ...prev, [playerId]: { ...cur, shardsCollected: cur.shardsCollected + n } };
    });
  }, []);

  const applyAttributeDelta = useCallback((playerId: string, delta: Partial<Player["attributes"]>) => {
    setPlayersById((prev) => {
      const cur = prev[playerId];
      if (!cur) return prev;
      const attributes = { ...cur.attributes };
      (Object.keys(delta) as (keyof Player["attributes"])[]).forEach((k) => {
        const d = delta[k];
        if (d === undefined) return;
        attributes[k] = Math.min(99, Math.max(0, attributes[k] + d));
      });
      return { ...prev, [playerId]: normalizePlayer({ ...cur, attributes }) };
    });
  }, []);

  const bumpStats = useCallback((playerId: string, bump: Partial<PlayerStats>) => {
    setPlayersById((prev) => {
      const cur = prev[playerId];
      if (!cur) return prev;
      const stats = { ...cur.stats };
      (Object.keys(bump) as (keyof PlayerStats)[]).forEach((k) => {
        const d = bump[k];
        if (d === undefined || k === "overall") return;
        stats[k] = Math.min(99, Math.max(1, stats[k] + (d as number)));
      });
      return { ...prev, [playerId]: normalizePlayer({ ...cur, stats }) };
    });
  }, []);

  const tryEvolutionUpgrade = useCallback((playerId: string) => {
    let ok = false;
    setPlayersById((prev) => {
      const cur = prev[playerId];
      if (!cur || cur.shardsCollected < 10 || cur.evolutionStage >= 3) return prev;
      ok = true;
      const evolutionStage = (cur.evolutionStage + 1) as 0 | 1 | 2 | 3;
      return {
        ...prev,
        [playerId]: {
          ...cur,
          evolutionStage,
          shardsCollected: cur.shardsCollected - 10,
        },
      };
    });
    return ok;
  }, []);

  const value = useMemo(
    () => ({
      activePlayer,
      setActivePlayerId,
      playersById,
      updatePlayer,
      explorationZoneType,
      setExplorationZoneType,
      matchPhase,
      setMatchPhase,
      livePulse,
      setLivePulse,
      competitiveStreak,
      addXp,
      addBond,
      addShards,
      applyAttributeDelta,
      tryEvolutionUpgrade,
      bumpStats,
    }),
    [
      activePlayer,
      setActivePlayerId,
      playersById,
      updatePlayer,
      explorationZoneType,
      matchPhase,
      livePulse,
      competitiveStreak,
      addXp,
      addBond,
      addShards,
      applyAttributeDelta,
      tryEvolutionUpgrade,
      bumpStats,
    ]
  );

  return <GameProgressContext.Provider value={value}>{children}</GameProgressContext.Provider>;
}

export function useGameProgress(): GameProgressContextValue {
  const ctx = useContext(GameProgressContext);
  if (!ctx) throw new Error("useGameProgress requires GameProgressProvider");
  return ctx;
}

/** Same as before — active player includes live progression. */
export function useActivePlayer() {
  const { activePlayer, setActivePlayerId } = useGameProgress();
  return { activePlayer, setActivePlayerId };
}
