import { type ReactNode, lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { authService } from './services/auth';
import { embyApi } from './services/embyApi';
import { AppFallbackSkeleton } from './components/AppFallbackSkeleton';
import { UpdateBanner } from './components/UpdateBanner';
import { ConsentBanner } from './components/ConsentBanner';
import { initAnalytics, trackAppOpen } from './services/analytics';
import { PlayerUiProvider } from './context/PlayerUiContext';
import { PlayerHost } from './components/PlayerHost';

// Lazy load all route components for better initial load
const Login = lazy(() => import('./components/Login').then(m => ({ default: m.Login })));
const ConnectServers = lazy(() => import('./components/ConnectServers').then(m => ({ default: m.ConnectServers })));
const Home = lazy(() => import('./components/Home').then(m => ({ default: m.Home })));
const Library = lazy(() => import('./components/Library').then(m => ({ default: m.Library })));
const MyList = lazy(() => import('./components/MyList').then(m => ({ default: m.MyList })));
const Browse = lazy(() => import('./components/Browse').then(m => ({ default: m.Browse })));
const PopularBrowse = lazy(() => import('./components/PopularBrowse').then(m => ({ default: m.PopularBrowse })));
const MediaDetails = lazy(() => import('./components/MediaDetails').then(m => ({ default: m.MediaDetails })));
const Stats = lazy(() => import('./components/Stats').then(m => ({ default: m.Stats })));
const Settings = lazy(() => import('./components/Settings').then(m => ({ default: m.Settings })));

function ProtectedRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = authService.isAuthenticated();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const location = useLocation();
  const backgroundLocation = (location.state as { backgroundLocation?: unknown } | undefined)?.backgroundLocation as typeof location | undefined;

  return (
    <>
      <UpdateBanner />
      <ConsentBanner />
      <Suspense fallback={<AppFallbackSkeleton />}>
        <Routes location={backgroundLocation ?? location}>
          <Route path="/login" element={<Login />} />
          <Route path="/connect" element={<ConnectServers />} />
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/library/:id"
            element={
              <ProtectedRoute>
                <Library />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mylist"
            element={
              <ProtectedRoute>
                <MyList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/browse"
            element={
              <ProtectedRoute>
                <Browse />
              </ProtectedRoute>
            }
          />
          <Route
            path="/details/:id"
            element={
              <ProtectedRoute>
                <MediaDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/player/:id"
            element={
              <ProtectedRoute>
                <div />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stats"
            element={
              <ProtectedRoute>
                <Stats />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/popular/:type"
            element={
              <ProtectedRoute>
                <PopularBrowse />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/home" replace />} />
        </Routes>
      </Suspense>
      <PlayerHost />
    </>
  );
}

function App() {
  // Initialize API credentials from localStorage on app startup
  useEffect(() => {
    const storedAuth = authService.getAuth();
    if (storedAuth) {
      embyApi.setCredentials(storedAuth);
    }
    void initAnalytics().then(() => trackAppOpen());
  }, []);

  return (
    <BrowserRouter>
      <PlayerUiProvider>
        <AppRoutes />
      </PlayerUiProvider>
    </BrowserRouter>
  );
}

export default App;
