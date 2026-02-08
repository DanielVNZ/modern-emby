import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type PlayerUiContextValue = {
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
  lastNonPlayerPath: string;
  setLastNonPlayerPath: (path: string) => void;
};

const PlayerUiContext = createContext<PlayerUiContextValue | null>(null);

export function PlayerUiProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [lastNonPlayerPath, setLastNonPlayerPath] = useState('/home');

  const value = useMemo(
    () => ({
      activeId,
      setActiveId,
      isCollapsed,
      setIsCollapsed,
      lastNonPlayerPath,
      setLastNonPlayerPath,
    }),
    [activeId, isCollapsed, lastNonPlayerPath],
  );

  return <PlayerUiContext.Provider value={value}>{children}</PlayerUiContext.Provider>;
}

export function usePlayerUi() {
  const context = useContext(PlayerUiContext);
  if (!context) {
    throw new Error('usePlayerUi must be used within a PlayerUiProvider');
  }
  return context;
}
