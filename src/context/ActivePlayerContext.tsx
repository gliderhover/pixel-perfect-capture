import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { getPlayerById, mockPlayers, type Player } from "@/data/mockData";

type ActivePlayerContextValue = {
  activePlayer: Player;
  setActivePlayerId: (id: string) => void;
};

const ActivePlayerContext = createContext<ActivePlayerContextValue | null>(null);

export function ActivePlayerProvider({ children }: { children: ReactNode }) {
  const [activePlayerId, setActivePlayerIdState] = useState(mockPlayers[0]?.id ?? "1");

  const activePlayer = useMemo(
    () => getPlayerById(activePlayerId) ?? mockPlayers[0],
    [activePlayerId]
  );

  const setActivePlayerId = useCallback((id: string) => {
    if (getPlayerById(id)) setActivePlayerIdState(id);
  }, []);

  const value = useMemo(
    () => ({ activePlayer, setActivePlayerId }),
    [activePlayer, setActivePlayerId]
  );

  return <ActivePlayerContext.Provider value={value}>{children}</ActivePlayerContext.Provider>;
}

export function useActivePlayer(): ActivePlayerContextValue {
  const ctx = useContext(ActivePlayerContext);
  if (!ctx) {
    throw new Error("useActivePlayer must be used within ActivePlayerProvider");
  }
  return ctx;
}
