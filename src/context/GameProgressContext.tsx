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
import { fetchPlayers, fetchUserPlayers, type ApiUserPlayer } from "@/lib/apiService";

type MatchPhase = "idle" | "prematch" | "live" | "halftime" | "postwin" | "postloss";
type LivePulse = "goal" | "injury" | "neutral";

function normalizePlayer(p: Player): Player {
  const overall = computeOverallFromStats(p.stats);
  return { ...p, stats: { ...p.stats, overall } };
}

function cloneInitialRoster(): Record<string, Player> {
  return Object.fromEntries(mockPlayers.map((p) => [p.id, normalizePlayer({ ...p })]));
}

function xpToNextAtLevel(level: number) {
  return 80 + level * 40;
}

function toOwnedByPlayerId(rows: ApiUserPlayer[]): Record<string, ApiUserPlayer> {
  return Object.fromEntries(rows.map((row) => [row.playerId, row]));
}

function applyOwnedProgress(seed: Player, owned?: ApiUserPlayer): Player {
  if (!owned) return normalizePlayer(seed);
  const level = owned.level ?? seed.level;
  const xpToNext = xpToNextAtLevel(level);
  return normalizePlayer({
    ...seed,
    level,
    currentXp: Math.max(0, Math.min(owned.xp ?? seed.currentXp, xpToNext)),
    xpToNext,
    evolutionStage: Math.max(0, Math.min(owned.evolutionStage ?? seed.evolutionStage, 3)) as 0 | 1 | 2 | 3,
    shardsCollected: owned.shards ?? seed.shardsCollected,
    attributes: {
      confidence: owned.stats.confidence,
      form: owned.stats.form,
      morale: owned.stats.morale,
      fanBond: owned.stats.fanBond,
    },
  });
}

type GameProgressContextValue = {
  userId: string;
  activePlayer: Player;
  setActivePlayerId: (id: string) => void;
  playersById: Record<string, Player>;
  ownedPlayersById: Record<string, ApiUserPlayer>;
  refreshOwnedPlayers: () => Promise<void>;
  isPlayerOwned: (id: string) => boolean;
  updatePlayer: (id: string, patch: Partial<Player>) => void;
  /** Exploration zone last opened on map — drives chat flavor. */
  explorationZoneType: MapZone["type"] | null;
  setExplorationZoneType: (z: MapZone["type"] | null) => void;
  matchPhase: MatchPhase;
  setMatchPhase: (m: MatchPhase) => void;
  livePulse: LivePulse;
  setLivePulse: (p: LivePulse) => void;
  competitiveStreak: number;
  focusPoints: number;
  spendFocusPoints: (n: number) => boolean;
  addFocusPoints: (n: number) => void;
  addXp: (playerId: string, amount: number) => void;
  addBond: (playerId: string, delta: number) => void;
  addShards: (playerId: string, n: number) => void;
  applyAttributeDelta: (playerId: string, delta: Partial<Player["attributes"]>) => void;
  tryEvolutionUpgrade: (playerId: string) => boolean;
  bumpStats: (playerId: string, bump: Partial<PlayerStats>) => void;
  playersLoading: boolean;
  playersError: string | null;
  usingMockPlayers: boolean;
  coachName: string;
  setCoachName: (name: string) => void;
};

const GameProgressContext = createContext<GameProgressContextValue | null>(null);

export function GameProgressProvider({ children }: { children: ReactNode }) {
  const [catalogPlayersById, setCatalogPlayersById] = useState<Record<string, Player>>(() => cloneInitialRoster());
  const [ownedPlayersById, setOwnedPlayersById] = useState<Record<string, ApiUserPlayer>>({});
  // Start with null; snapped to first owned player once ownedPlayersById loads
  const [activePlayerId, setActivePlayerIdState] = useState<string | null>(null);
  const [explorationZoneType, setExplorationZoneType] = useState<MapZone["type"] | null>(null);
  const [matchPhase, setMatchPhase] = useState<MatchPhase>("prematch");
  const [livePulse, setLivePulse] = useState<LivePulse>("neutral");
  const [competitiveStreak] = useState(3);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [usingMockPlayers, setUsingMockPlayers] = useState(true);
  // Generate a stable unique ID per device so each new user starts with a clean
  // squad instead of sharing the seeded demo-user data.
  const userId = useMemo(() => {
    const envId = import.meta.env.VITE_DEMO_USER_ID?.trim();
    if (envId) return envId; // override kept for dev/testing
    try {
      const stored = localStorage.getItem("ppl-user-id");
      if (stored) return stored;
      const id = `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem("ppl-user-id", id);
      return id;
    } catch {
      return "demo-user";
    }
  }, []);
  const [focusPoints, setFocusPoints] = useState(() => {
    try { const v = localStorage.getItem("ppc-focus-points"); return v ? Number(v) : 10; } catch { return 10; }
  });

  useEffect(() => { localStorage.setItem("ppc-focus-points", String(focusPoints)); }, [focusPoints]);

  const [coachName, setCoachNameState] = useState<string>(() => {
    try { return localStorage.getItem("ppl-coach-name") ?? ""; } catch { return ""; }
  });
  const setCoachName = useCallback((name: string) => {
    setCoachNameState(name.trim());
    try { localStorage.setItem("ppl-coach-name", name.trim()); } catch {}
  }, []);

  const spendFocusPoints = useCallback((n: number) => {
    if (focusPoints < n) return false;
    setFocusPoints((p) => p - n);
    return true;
  }, [focusPoints]);

  const addFocusPoints = useCallback((n: number) => {
    setFocusPoints((p) => p + n);
  }, []);

  // Auto-select the first owned player whenever the owned list changes and
  // no valid active player is set yet (or the current one is no longer owned).
  useEffect(() => {
    const ownedIds = Object.keys(ownedPlayersById);
    if (ownedIds.length === 0) return;
    setActivePlayerIdState((prev) => {
      if (prev && ownedPlayersById[prev]) return prev; // keep current if still owned
      return ownedIds[0] ?? prev;
    });
  }, [ownedPlayersById]);

  const refreshOwnedPlayers = useCallback(async () => {
    const result = await fetchUserPlayers(userId);
    setOwnedPlayersById(toOwnedByPlayerId(result.data));
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    const hydratePlayers = async () => {
      setPlayersLoading(true);
      setPlayersError(null);
      try {
        const result = await fetchPlayers();
        const byId = Object.fromEntries(mockPlayers.map((p) => [p.id, p]));
        const mergedCatalog = cloneInitialRoster();
        for (const apiPlayer of result.data) {
          const seed = byId[apiPlayer.externalId];
          if (!seed) continue;
          const level = apiPlayer.level ?? seed.level;
          const xpToNext = xpToNextAtLevel(level);
          mergedCatalog[seed.id] = normalizePlayer({
            ...seed,
            name: apiPlayer.name,
            portrait: apiPlayer.portrait,
            age: apiPlayer.age,
            position: apiPlayer.position,
            clubTeam: apiPlayer.clubTeam,
            nationalTeam: apiPlayer.nationalTeam,
            representedCountry: apiPlayer.representedCountry,
            rarity: apiPlayer.rarity,
            traits: apiPlayer.traits,
            level,
            currentXp: Math.max(0, Math.min(apiPlayer.xp ?? seed.currentXp, xpToNext)),
            xpToNext,
            evolutionStage: (Math.max(0, Math.min(apiPlayer.evolutionStage ?? 0, 3)) as 0 | 1 | 2 | 3),
            attributes: {
              confidence: apiPlayer.stats.confidence,
              form: apiPlayer.stats.form,
              morale: apiPlayer.stats.morale,
              fanBond: apiPlayer.stats.fanBond,
            },
          });
        }
        const ownedResult = await fetchUserPlayers(userId);
        if (!cancelled) {
          setCatalogPlayersById(mergedCatalog);
          setOwnedPlayersById(toOwnedByPlayerId(ownedResult.data));
          setUsingMockPlayers(false);
        }
      } catch (error) {
        if (!cancelled) {
          const msg = error instanceof Error ? error.message : "Failed to load players";
          setPlayersError(msg);
          setUsingMockPlayers(true);
        }
      } finally {
        if (!cancelled) setPlayersLoading(false);
      }
    };
    hydratePlayers();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const playersById = useMemo(() => {
    const merged: Record<string, Player> = {};
    for (const [id, player] of Object.entries(catalogPlayersById)) {
      merged[id] = applyOwnedProgress(player, ownedPlayersById[id]);
    }
    return merged;
  }, [catalogPlayersById, ownedPlayersById]);

  const activePlayer = useMemo(() => {
    // Prefer the explicitly selected player; fall back to first owned; never show
    // an unowned placeholder — callers must handle the null/empty-squad case.
    if (activePlayerId && playersById[activePlayerId]) {
      return normalizePlayer(playersById[activePlayerId]!);
    }
    const firstOwnedId = Object.keys(ownedPlayersById)[0];
    if (firstOwnedId && playersById[firstOwnedId]) {
      return normalizePlayer(playersById[firstOwnedId]!);
    }
    // No owned players yet — return a sentinel with empty name so UI can detect it
    return normalizePlayer({ ...mockPlayers[0], name: "" });
  }, [playersById, activePlayerId, ownedPlayersById]);

  const setActivePlayerId = useCallback((id: string) => {
    if (getPlayerById(id)) setActivePlayerIdState(id);
  }, []);

  const isPlayerOwned = useCallback((id: string) => Boolean(ownedPlayersById[id]), [ownedPlayersById]);

  const updatePlayer = useCallback((id: string, patch: Partial<Player>) => {
    setCatalogPlayersById((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      const next = normalizePlayer({ ...cur, ...patch, stats: { ...cur.stats, ...patch.stats } });
      return { ...prev, [id]: next };
    });
  }, []);

  const addXp = useCallback((playerId: string, amount: number) => {
    setCatalogPlayersById((prev) => {
      const cur = prev[playerId];
      if (!cur) return prev;
      if (ownedPlayersById[playerId]) return prev;
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
  }, [ownedPlayersById]);

  const addBond = useCallback((playerId: string, delta: number) => {
    setCatalogPlayersById((prev) => {
      const cur = prev[playerId];
      if (!cur) return prev;
      const bondTrust = Math.min(100, Math.max(0, cur.bondTrust + delta));
      return { ...prev, [playerId]: { ...cur, bondTrust } };
    });
  }, []);

  const addShards = useCallback((playerId: string, n: number) => {
    setCatalogPlayersById((prev) => {
      const cur = prev[playerId];
      if (!cur) return prev;
      if (ownedPlayersById[playerId]) return prev;
      return { ...prev, [playerId]: { ...cur, shardsCollected: cur.shardsCollected + n } };
    });
  }, [ownedPlayersById]);

  const applyAttributeDelta = useCallback((playerId: string, delta: Partial<Player["attributes"]>) => {
    setCatalogPlayersById((prev) => {
      const cur = prev[playerId];
      if (!cur) return prev;
      if (ownedPlayersById[playerId]) return prev;
      const attributes = { ...cur.attributes };
      (Object.keys(delta) as (keyof Player["attributes"])[]).forEach((k) => {
        const d = delta[k];
        if (d === undefined) return;
        attributes[k] = Math.min(99, Math.max(0, attributes[k] + d));
      });
      return { ...prev, [playerId]: normalizePlayer({ ...cur, attributes }) };
    });
  }, [ownedPlayersById]);

  const bumpStats = useCallback((playerId: string, bump: Partial<PlayerStats>) => {
    setCatalogPlayersById((prev) => {
      const cur = prev[playerId];
      if (!cur) return prev;
      if (ownedPlayersById[playerId]) return prev;
      const stats = { ...cur.stats };
      (Object.keys(bump) as (keyof PlayerStats)[]).forEach((k) => {
        const d = bump[k];
        if (d === undefined || k === "overall") return;
        stats[k] = Math.min(99, Math.max(1, stats[k] + (d as number)));
      });
      return { ...prev, [playerId]: normalizePlayer({ ...cur, stats }) };
    });
  }, [ownedPlayersById]);

  const tryEvolutionUpgrade = useCallback((playerId: string) => {
    if (ownedPlayersById[playerId]) return false;
    let ok = false;
    setCatalogPlayersById((prev) => {
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
  }, [ownedPlayersById]);

  const value = useMemo(
    () => ({
      userId,
      activePlayer,
      setActivePlayerId,
      playersById,
      ownedPlayersById,
      refreshOwnedPlayers,
      isPlayerOwned,
      updatePlayer,
      explorationZoneType,
      setExplorationZoneType,
      matchPhase,
      setMatchPhase,
      livePulse,
      setLivePulse,
      competitiveStreak,
      focusPoints,
      spendFocusPoints,
      addFocusPoints,
      coachName,
      setCoachName,
      addXp,
      addBond,
      addShards,
      applyAttributeDelta,
      tryEvolutionUpgrade,
      bumpStats,
      playersLoading,
      playersError,
      usingMockPlayers,
    }),
    [
      userId,
      activePlayer,
      setActivePlayerId,
      playersById,
      ownedPlayersById,
      refreshOwnedPlayers,
      isPlayerOwned,
      updatePlayer,
      explorationZoneType,
      matchPhase,
      livePulse,
      competitiveStreak,
      focusPoints,
      spendFocusPoints,
      addFocusPoints,
      coachName,
      setCoachName,
      addXp,
      addBond,
      addShards,
      applyAttributeDelta,
      tryEvolutionUpgrade,
      bumpStats,
      playersLoading,
      playersError,
      usingMockPlayers,
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
