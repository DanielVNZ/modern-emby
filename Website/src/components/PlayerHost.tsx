import { Suspense, lazy, useEffect } from 'react';
import { useLocation, useMatch } from 'react-router-dom';
import { authService } from '../services/auth';
import { usePlayerUi } from '../context/PlayerUiContext';

const Player = lazy(() => import('./Player').then(m => ({ default: m.Player })));

export function PlayerHost() {
  const location = useLocation();
  const match = useMatch('/player/:id');
  const {
    activeId,
    setActiveId,
    isCollapsed,
    setIsCollapsed,
    lastNonPlayerPath,
    setLastNonPlayerPath,
  } = usePlayerUi();

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      if (activeId) {
        setActiveId(null);
      }
      return;
    }

    const matchedId = match?.params?.id;
    if (matchedId) {
      if (activeId !== matchedId) {
        setActiveId(matchedId);
        setIsCollapsed(false);
      }
      return;
    }

    const path = `${location.pathname}${location.search}`;
    if (path !== lastNonPlayerPath) {
      setLastNonPlayerPath(path);
    }
    if (activeId && !isCollapsed) {
      setIsCollapsed(true);
    }
  }, [
    activeId,
    isCollapsed,
    lastNonPlayerPath,
    location.pathname,
    location.search,
    match?.params?.id,
    setActiveId,
    setIsCollapsed,
    setLastNonPlayerPath,
  ]);

  if (!authService.isAuthenticated() || !activeId) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <Player id={activeId} isCollapsed={isCollapsed} />
    </Suspense>
  );
}
