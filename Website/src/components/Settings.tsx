import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { embyApi } from '../services/embyApi';
import { useAuth } from '../hooks/useAuth';
import { check, type DownloadEvent } from '@tauri-apps/plugin-updater';
import { isTauri } from '@tauri-apps/api/core';
import { relaunch } from '@tauri-apps/plugin-process';
import { getConsent, setConsent, type ConsentValue } from '../services/analytics';
import { Header } from './Header';
import { Footer } from './Footer';

type SettingsSection = 'home' | 'playback' | 'account' | 'updates';

const HOME_SECTIONS_KEY = 'home_customSections';
const DEFAULT_HOME_SECTIONS = [
  { id: 'continue_movies', label: 'Continue Watching Movies' },
  { id: 'continue_tv', label: 'Continue Watching TV' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'recommended_movies', label: 'Recommended Movies' },
  { id: 'recommended_series', label: 'Recommended Series' },
  { id: 'trending_movies', label: 'Trending Movies' },
  { id: 'popular_tv', label: 'Popular TV Shows' },
  { id: 'latest_movies', label: 'Latest Movies' },
  { id: 'latest_episodes', label: 'Latest Episodes' },
];

const SETTINGS_SECTIONS = [
  { id: 'home' as const, label: 'Home Screen', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'playback' as const, label: 'Playback', icon: 'M8 5v14l11-7z' },
  { id: 'updates' as const, label: 'Updates & Analytics', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
  { id: 'account' as const, label: 'Account & Backup', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
];

const normalizeHomeOrder = (order: string[], sections: { id: string }[]) => {
  const known = new Set(sections.map(section => section.id));
  const normalized = order.filter(id => known.has(id));
  const missing = sections.map(section => section.id).filter(id => !normalized.includes(id));
  return [...normalized, ...missing];
};

export function Settings() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [activeSection, setActiveSection] = useState<SettingsSection>('home');
  const [customHomeSections, setCustomHomeSections] = useState<{ id: string; label: string; }[]>([]);
  const allHomeSections = useMemo(
    () => [...DEFAULT_HOME_SECTIONS, ...customHomeSections],
    [customHomeSections]
  );

  // Settings state
  const [showFeatured, setShowFeatured] = useState(() => {
    const saved = localStorage.getItem('emby_showFeatured');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [featuredGenre, setFeaturedGenre] = useState<string>(() => {
    return localStorage.getItem('emby_featuredGenre') || '';
  });
  const [featuredYear, setFeaturedYear] = useState<string>(() => {
    return localStorage.getItem('emby_featuredYear') || '';
  });
  const [featuredMediaType, setFeaturedMediaType] = useState<{ movies: boolean; tvShows: boolean }>(() => {
    const saved = localStorage.getItem('emby_featuredMediaType');
    return saved ? JSON.parse(saved) : { movies: true, tvShows: true };
  });
  const [playbackQuality, setPlaybackQuality] = useState<string>(() => {
    return localStorage.getItem('emby_playbackQuality') || 'manual';
  });
  const [preferredAudioLang, setPreferredAudioLang] = useState<string>(() => {
    return localStorage.getItem('emby_preferredAudioLang') || '';
  });
  const [videoPlayer, setVideoPlayer] = useState<string>(() => {
    return localStorage.getItem('emby_videoPlayer') || 'hlsjs';
  });
  const [tmdbApiKey, setTmdbApiKey] = useState<string>(() => {
    return localStorage.getItem('tmdb_apiKey') || '';
  });
  const [showTmdbKey, setShowTmdbKey] = useState(false);
  const [subdlApiKey, setSubdlApiKey] = useState<string>(() => {
    return localStorage.getItem('subdl_apiKey') || '';
  });
  const [showSubdlKey, setShowSubdlKey] = useState(false);
  const [subdlLanguages, setSubdlLanguages] = useState<string>(() => {
    return localStorage.getItem('subdl_languages') || 'EN';
  });
  const [availableGenres, setAvailableGenres] = useState<string[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [homeSectionOrder, setHomeSectionOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('emby_homeSectionOrder');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return normalizeHomeOrder(
            parsed.filter((id: unknown) => typeof id === 'string') as string[],
            DEFAULT_HOME_SECTIONS
          );
        }
      } catch (error) {
        console.error('Failed to parse home section order:', error);
      }
    }
    return DEFAULT_HOME_SECTIONS.map(section => section.id);
  });

  // Load custom home sections (from Browse filter shortcuts)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HOME_SECTIONS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        const mapped = parsed
          .filter((s: any) => s && typeof s.id === 'string' && typeof s.name === 'string')
          .map((s: any) => ({ id: s.id, label: s.name }));
        setCustomHomeSections(mapped);
      }
    } catch (e) {
      console.error('Failed to load custom home sections:', e);
    }
  }, []);

  // Ensure custom sections are included in ordering
  useEffect(() => {
    const normalized = normalizeHomeOrder(homeSectionOrder, allHomeSections);
    if (JSON.stringify(normalized) !== JSON.stringify(homeSectionOrder)) {
      setHomeSectionOrder(normalized);
      localStorage.setItem('emby_homeSectionOrder', JSON.stringify(normalized));
    }
  }, [customHomeSections]);

  // Load genres and years
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [genresResponse, movies, shows] = await Promise.all([
          embyApi.getGenres({ includeItemTypes: 'Movie,Series' }),
          embyApi.getItems({ includeItemTypes: 'Movie', limit: 100, fields: 'ProductionYear', recursive: true }),
          embyApi.getItems({ includeItemTypes: 'Series', limit: 100, fields: 'ProductionYear', recursive: true })
        ]);
        
        setAvailableGenres(genresResponse.Items.map((g: { Name: string }) => g.Name).sort());
        
        const allYears = new Set<number>();
        [...movies.Items, ...shows.Items].forEach(item => {
          if (item.ProductionYear) {
            allYears.add(item.ProductionYear);
          }
        });
        setAvailableYears(Array.from(allYears).sort((a, b) => b - a));
      } catch (error) {
        console.error('Failed to load filter options:', error);
      }
    };
    
    loadFilterOptions();
  }, []);

  const handleLogout = () => {
    logout();
  };

  const handleSave = () => {
    navigate('/home');
  };

  const downloadSettingsBackup = () => {
    try {
      const excludedKeys = new Set(['emby_auth', 'emby_server_url', 'emby_username']);
      const snapshot: Record<string, string | null> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (excludedKeys.has(key)) continue;
        snapshot[key] = localStorage.getItem(key);
      }

      const payload = {
        version: 1,
        createdAt: new Date().toISOString(),
        app: 'Aether',
        data: snapshot,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aether-settings-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download settings backup:', error);
      alert('Failed to download backup.');
    }
  };

  const handleRestoreFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { version?: number; data?: Record<string, string | null> };
      if (!parsed || typeof parsed !== 'object' || !parsed.data || typeof parsed.data !== 'object') {
        alert('Invalid backup file.');
        return;
      }

      const excludedKeys = new Set(['emby_auth', 'emby_server_url', 'emby_username']);
      Object.entries(parsed.data).forEach(([key, value]) => {
        if (excludedKeys.has(key)) return;
        if (value === null || value === undefined) {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, value);
        }
      });

      alert('Backup restored. Please reload the app to apply all settings.');
    } catch (error) {
      console.error('Failed to restore settings backup:', error);
      alert('Failed to restore backup.');
    } finally {
      if (restoreInputRef.current) {
        restoreInputRef.current.value = '';
      }
    }
  };

  // Update checker state
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateVersion, setUpdateVersion] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [hasCheckedForUpdates, setHasCheckedForUpdates] = useState(false);
  const [currentVersion] = useState('3.0.12');
  const [analyticsConsent, setAnalyticsConsent] = useState<ConsentValue | 'unset'>(
    () => getConsent() ?? 'unset'
  );

  const safeCheckForUpdates = async () => {
    if (!isTauri()) {
      return { update: null as Awaited<ReturnType<typeof check>> | null, error: 'Updates are only available in the desktop app.' };
    }
    try {
      const update = await check();
      return { update, error: null as string | null };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes("reading 'available'")) {
        return {
          update: null,
          error: 'Updater returned no data. Verify updater permissions and endpoint.',
        };
      }
      return { update: null, error: errorMessage };
    }
  };

  const checkForUpdates = async () => {
    try {
      setIsCheckingUpdate(true);
      setUpdateError(null);
      setHasCheckedForUpdates(false);
      
      const { update, error } = await safeCheckForUpdates();
      
      if (error) {
        setUpdateAvailable(false);
        setUpdateVersion('');
        setUpdateError(`Failed to check for updates: ${error}`);
      } else if (update) {
        console.log(`Update available: ${update.version}, current: ${update.currentVersion}`);
        setUpdateAvailable(true);
        setUpdateVersion(update.version);
      } else {
        setUpdateAvailable(false);
        setUpdateVersion('');
      }
      setHasCheckedForUpdates(true);
    } catch (err) {
      console.error('Error checking for updates:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setUpdateError(`Failed to check for updates: ${errorMessage}`);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const downloadAndInstallUpdate = async () => {
    try {
      setIsDownloading(true);
      setUpdateError(null);
      
      const { update, error } = await safeCheckForUpdates();
      
      if (error) {
        setUpdateError(`Update failed: ${error}`);
        setIsDownloading(false);
        return;
      }

      if (!update) {
        setUpdateError('No update found. Please check for updates first.');
        setIsDownloading(false);
        return;
      }
      
      console.log('Starting download from:', update);
      
      let bytesDownloaded = 0;
      await update.downloadAndInstall((event: DownloadEvent) => {
        console.log('Update event:', event);
        switch (event.event) {
          case 'Started':
            bytesDownloaded = 0;
            setDownloadProgress(0);
            console.log('Download started');
            break;
          case 'Progress':
            bytesDownloaded += event.data?.chunkLength ?? 0;
            const animatedProgress = Math.min(90, (bytesDownloaded / (1024 * 1024 * 50)) * 100);
            setDownloadProgress(animatedProgress);
            console.log(`Downloaded: ${(bytesDownloaded / 1024 / 1024).toFixed(2)} MB`);
            break;
          case 'Finished':
            setDownloadProgress(100);
            console.log('Download complete');
            break;
        }
      });

      console.log('Installing update and relaunching...');
      await relaunch();
    } catch (err) {
      console.error('Error downloading update:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setUpdateError(`Update failed: ${errorMessage}`);
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen h-screen bg-black flex flex-col overflow-hidden">
      <Header />
      <div className="flex flex-1 pt-24 overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className="w-72 border-r border-gray-800/50 flex flex-col h-full overflow-hidden">

        <div className="p-4 border-b border-gray-800/50">
          <h1 className="text-2xl font-bold text-white px-2">Settings</h1>
          <p className="text-sm text-gray-400 mt-1 px-2">Customize your experience</p>
          <p className="text-xs text-gray-500 mt-1 px-2">Version {currentVersion}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {SETTINGS_SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                activeSection === section.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill={section.id === 'playback' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={section.id === 'playback' ? 0 : 2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={section.icon} />
              </svg>
              <span className="font-medium">{section.label}</span>
            </button>
          ))}
        </nav>

        <div className="px-4 pb-4">
          <a
            href="https://ko-fi.com/danielvnz"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 text-white font-semibold shadow-lg shadow-sky-500/30 transition-all duration-200 hover:scale-105"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 21s-6.716-4.245-9.236-7.236C1.212 12.212 1 10.975 1 10a6 6 0 0112 0h-2a4 4 0 00-8 0c0 .511.116 1.171 1.264 2.468C5.823 14.356 8.82 16.36 12 18.36c3.18-2 6.177-4.004 7.736-5.892C20.884 11.171 21 10.511 21 10a4 4 0 00-8 0h-2a6 6 0 0112 0c0 .975-.212 2.212-1.764 3.764C18.716 16.755 12 21 12 21z" />
              </svg>
            </span>
            Support Me on Ko-fi
          </a>
        </div>

        <div className="p-4 border-t border-gray-800/50">
          <button
            onClick={handleSave}
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all duration-200 hover:scale-105 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Save & Return Home
          </button>
        </div>
      </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto h-full">
        <div key={activeSection} className="max-w-6xl mx-auto p-6 settings-panel-enter">
          
          {/* Home Screen Section */}
          {activeSection === 'home' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-white">Home Screen</h2>
                <p className="text-gray-400 mt-2">Configure your home page layout and content</p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Featured Section Toggle */}
              <div className="bg-gray-900/50 rounded-xl border border-gray-800/70 overflow-hidden backdrop-blur-sm xl:col-span-2">
                <div className="p-6 flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-white font-semibold text-lg">Featured Billboard</p>
                    <p className="text-sm text-gray-400 mt-1">Display a rotating hero banner at the top of your home screen</p>
                  </div>
                  <button
                    onClick={() => {
                      const newValue = !showFeatured;
                      setShowFeatured(newValue);
                      localStorage.setItem('emby_showFeatured', JSON.stringify(newValue));
                    }}
                    role="switch"
                    aria-checked={showFeatured}
                    className={`relative w-16 h-9 rounded-full transition-all duration-300 flex-shrink-0 hover:scale-105 ml-6 ${
                      showFeatured ? 'bg-blue-600' : 'bg-gray-700'
                    }`}
                  >
                    <div className={`absolute top-1.5 w-6 h-6 bg-white rounded-full shadow-lg transition-transform duration-300 ${
                      showFeatured ? 'translate-x-8' : 'translate-x-1.5'
                    }`} />
                  </button>
                </div>

                {/* Featured Filters */}
                {showFeatured && (
                  <>
                    <div className="border-t border-gray-800/70" />
                    <div className="p-6">
                      <p className="text-white font-semibold text-lg mb-5">Content Filters</p>

                      {/* Content Type - Horizontal Row */}
                      <div className="mb-5">
                        <label className="block text-sm font-medium text-gray-300 mb-3">Media Types</label>
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              const newValue = { ...featuredMediaType, movies: !featuredMediaType.movies };
                              if (!newValue.movies && !newValue.tvShows) newValue.tvShows = true;
                              setFeaturedMediaType(newValue);
                              localStorage.setItem('emby_featuredMediaType', JSON.stringify(newValue));
                            }}
                            className={`flex-1 flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl transition-all duration-200 hover:scale-105 ${
                              featuredMediaType.movies 
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' 
                                : 'bg-gray-800/70 text-gray-300 hover:bg-gray-700'
                            }`}
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
                            </svg>
                            <span className="font-medium">Movies</span>
                            {featuredMediaType.movies && (
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              const newValue = { ...featuredMediaType, tvShows: !featuredMediaType.tvShows };
                              if (!newValue.movies && !newValue.tvShows) newValue.movies = true;
                              setFeaturedMediaType(newValue);
                              localStorage.setItem('emby_featuredMediaType', JSON.stringify(newValue));
                            }}
                            className={`flex-1 flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl transition-all duration-200 hover:scale-105 ${
                              featuredMediaType.tvShows 
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' 
                                : 'bg-gray-800/70 text-gray-300 hover:bg-gray-700'
                            }`}
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/>
                            </svg>
                            <span className="font-medium">TV Shows</span>
                            {featuredMediaType.tvShows && (
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Genre & Year Side by Side */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Genre</label>
                          <select
                            value={featuredGenre}
                            onChange={(e) => {
                              setFeaturedGenre(e.target.value);
                              localStorage.setItem('emby_featuredGenre', e.target.value);
                            }}
                            className="w-full px-4 py-3 bg-gray-800/70 border border-gray-700 rounded-xl text-white hover:bg-gray-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 appearance-none cursor-pointer transition-all"
                          >
                            <option value="">Any Genre</option>
                            {availableGenres.map((genre) => (
                              <option key={genre} value={genre}>{genre}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Year</label>
                          <select
                            value={featuredYear}
                            onChange={(e) => {
                              setFeaturedYear(e.target.value);
                              localStorage.setItem('emby_featuredYear', e.target.value);
                            }}
                            className="w-full px-4 py-3 bg-gray-800/70 border border-gray-700 rounded-xl text-white hover:bg-gray-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 appearance-none cursor-pointer transition-all"
                          >
                            <option value="">Any Year</option>
                            {availableYears.map((year) => (
                              <option key={year} value={year}>{year}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Section Order - Moved to Home Screen */}
              <div className="bg-gray-900/50 rounded-xl border border-gray-800/70 overflow-hidden backdrop-blur-sm">
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-white font-semibold text-lg mb-2">Content Sections Order</p>
                      <p className="text-sm text-gray-400 leading-relaxed">
                        Section ordering and visibility controls have been moved to the Home screen for easier access. 
                        Scroll to the bottom of the Home screen and click the <span className="text-white font-medium">Edit</span> button to customize your sections.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900/50 rounded-xl border border-gray-800/70 overflow-hidden backdrop-blur-sm xl:col-span-2">
                <div className="p-6">
                  <label className="block text-white font-semibold text-lg mb-2">Recommendations (TMDB)</label>
                  <p className="text-sm text-gray-400 mb-5">
                    Enable popular movie & TV show recommendations on your home screen. 
                    Get your free API key from{' '}
                    <a 
                      href="https://www.themoviedb.org/settings/api" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-green-400 hover:text-green-300 underline transition-colors"
                    >
                      themoviedb.org
                    </a>
                  </p>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <input
                        type={showTmdbKey ? 'text' : 'password'}
                        value={tmdbApiKey}
                        onChange={(e) => {
                          setTmdbApiKey(e.target.value);
                          localStorage.setItem('tmdb_apiKey', e.target.value);
                          if (!e.target.value || e.target.value.trim().length === 0) {
                            sessionStorage.removeItem('popular_movies_all');
                            sessionStorage.removeItem('popular_tv_all');
                          }
                        }}
                        placeholder="Paste your TMDB API key here"
                        className="w-full px-4 py-3 pr-12 bg-gray-800/70 border border-gray-700 rounded-xl text-white placeholder-gray-500 hover:bg-gray-800 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 font-mono text-sm transition-all"
                      />
                      <button
                        onClick={() => setShowTmdbKey(!showTmdbKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-all duration-200 hover:scale-110 p-1 rounded"
                        aria-label={showTmdbKey ? 'Hide API key' : 'Show API key'}
                      >
                        {showTmdbKey ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {tmdbApiKey && (
                      <button
                        onClick={() => {
                          setTmdbApiKey('');
                          localStorage.removeItem('tmdb_apiKey');
                          sessionStorage.removeItem('popular_movies_all');
                          sessionStorage.removeItem('popular_tv_all');
                        }}
                        className="px-5 py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 font-medium rounded-xl transition-all duration-200 hover:scale-105 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
              </div>
            </div>
          )}

          {/* Playback Section */}
          {activeSection === 'playback' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-white">Playback</h2>
                <p className="text-gray-400 mt-2">Customize video and audio playback settings</p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-gray-900/50 rounded-xl border border-gray-800/70 overflow-hidden backdrop-blur-sm">
                <div className="p-6">
                  <label className="block text-white font-semibold text-lg mb-2">Video Quality</label>
                  <p className="text-sm text-gray-400 mb-5">Choose your preferred default video quality</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'manual', label: 'Manual', desc: 'Choose each time' },
                      { value: '4k', label: '4K', desc: '2160p' },
                      { value: '1080p', label: '1080p', desc: 'Full HD' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setPlaybackQuality(option.value);
                          localStorage.setItem('emby_playbackQuality', option.value);
                        }}
                        className={`p-5 rounded-xl text-center transition-all duration-200 hover:scale-105 ${
                          playbackQuality === option.value
                            ? 'bg-purple-600 text-white ring-2 ring-purple-400 shadow-lg shadow-purple-600/30'
                            : 'bg-gray-800/70 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        <p className="font-semibold text-lg">{option.label}</p>
                        <p className={`text-xs mt-1 ${playbackQuality === option.value ? 'text-purple-200' : 'text-gray-500'}`}>
                          {option.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-gray-900/50 rounded-xl border border-gray-800/70 overflow-hidden backdrop-blur-sm">
                <div className="p-6">
                  <label className="block text-white font-semibold text-lg mb-2">Video Player</label>
                  <p className="text-sm text-gray-400 mb-5">Choose which player engine to use for video playback</p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {[
                      {
                        value: 'hlsjs',
                        title: 'HLS.js (Default) Windows Only',
                        desc: 'Best overall compatibility. Recommended. Not supported on Linux builds.',
                        note: 'Stable',
                      },
                      {
                        value: 'libmpv',
                        title: 'LibMPV (Windows or Linux)',
                        desc: 'Native playback for Linux builds (requires libmpv support).',
                        note: 'Experimental - will superceed hls.js when stable',
                      },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setVideoPlayer(option.value);
                          localStorage.setItem('emby_videoPlayer', option.value);
                        }}
                        className={`p-5 rounded-xl text-left transition-all duration-200 hover:scale-[1.02] border ${
                          videoPlayer === option.value
                            ? 'bg-purple-600/20 border-purple-400 text-white shadow-lg shadow-purple-600/20'
                            : 'bg-gray-800/60 border-gray-700/50 text-gray-200 hover:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-lg">{option.title}</p>
                          {videoPlayer === option.value && (
                            <span className="text-xs px-2 py-1 rounded-full bg-purple-500/30 text-purple-200">
                              Selected
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400 mt-2">{option.desc}</p>
                        <p className="text-xs text-gray-500 mt-2">{option.note}</p>
                        <p className="text-xs text-gray-500 mt-3">Requires closing and reopening Aether to take effect</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-gray-900/50 rounded-xl border border-gray-800/70 overflow-hidden backdrop-blur-sm">
                <div className="p-6">
                  <label className="block text-white font-semibold text-lg mb-2">Default Audio Language</label>
                  <p className="text-sm text-gray-400 mb-5">Automatically select this language when available</p>
                  <select
                    value={preferredAudioLang}
                    onChange={(e) => {
                      setPreferredAudioLang(e.target.value);
                      localStorage.setItem('emby_preferredAudioLang', e.target.value);
                    }}
                    className="w-full max-w-sm px-4 py-3 bg-gray-800/70 border border-gray-700 rounded-xl text-white hover:bg-gray-800 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 appearance-none cursor-pointer transition-all"
                  >
                    <option value="">Use default track</option>
                    <option value="eng">English</option>
                    <option value="jpn">Japanese</option>
                    <option value="spa">Spanish</option>
                    <option value="fre">French</option>
                    <option value="ger">German</option>
                    <option value="ita">Italian</option>
                    <option value="por">Portuguese</option>
                    <option value="rus">Russian</option>
                    <option value="chi">Chinese</option>
                    <option value="kor">Korean</option>
                    <option value="ara">Arabic</option>
                    <option value="hin">Hindi</option>
                    <option value="pol">Polish</option>
                    <option value="dut">Dutch</option>
                    <option value="swe">Swedish</option>
                    <option value="nor">Norwegian</option>
                    <option value="dan">Danish</option>
                    <option value="fin">Finnish</option>
                    <option value="tha">Thai</option>
                    <option value="vie">Vietnamese</option>
                  </select>
                </div>
              </div>

              <div className="bg-gray-900/50 rounded-xl border border-gray-800/70 overflow-hidden backdrop-blur-sm xl:col-span-2">
                <div className="p-6">
                  <label className="block text-white font-semibold text-lg mb-2">SubDL API Key</label>
                  <p className="text-sm text-gray-400 mb-5">
                    Used to search and download subtitles directly from SubDL.
                  </p>
                  <details className="mb-4 rounded-xl border border-gray-800/70 bg-gray-900/40">
                    <summary className="cursor-pointer select-none px-4 py-3 text-sm text-blue-300 hover:text-blue-200">
                      How to get a SubDL API key
                    </summary>
                    <div className="px-4 pb-4 text-sm text-gray-300 space-y-2">
                      <div>1. Sign up at `https://subdl.com/panel/register`</div>
                      <div>2. Open the API page at `https://subdl.com/panel/api`</div>
                      <div>3. Copy your API key and paste it below</div>
                    </div>
                  </details>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <input
                        type={showSubdlKey ? 'text' : 'password'}
                        value={subdlApiKey}
                        onChange={(e) => {
                          setSubdlApiKey(e.target.value);
                          localStorage.setItem('subdl_apiKey', e.target.value);
                        }}
                        placeholder="Paste your SubDL API key here"
                        className="w-full px-4 py-3 pr-12 bg-gray-800/70 border border-gray-700 rounded-xl text-white placeholder-gray-500 hover:bg-gray-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-mono text-sm transition-all"
                      />
                      <button
                        onClick={() => setShowSubdlKey(!showSubdlKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-all duration-200 hover:scale-110 p-1 rounded"
                        aria-label={showSubdlKey ? 'Hide API key' : 'Show API key'}
                      >
                        {showSubdlKey ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {subdlApiKey && (
                      <button
                        onClick={() => {
                          setSubdlApiKey('');
                          localStorage.removeItem('subdl_apiKey');
                        }}
                        className="px-5 py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 font-medium rounded-xl transition-all duration-200 hover:scale-105 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="mt-5">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Preferred Subtitle Languages</label>
                    <input
                      type="text"
                      value={subdlLanguages}
                      onChange={(e) => {
                        setSubdlLanguages(e.target.value);
                        localStorage.setItem('subdl_languages', e.target.value);
                      }}
                      placeholder="e.g. EN,ES"
                      className="w-full max-w-sm px-4 py-3 bg-gray-800/70 border border-gray-700 rounded-xl text-white placeholder-gray-500 hover:bg-gray-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-mono text-sm transition-all"
                    />
                    <p className="text-xs text-gray-500 mt-2">Comma-separated language codes supported by SubDL.</p>
                    <p className="text-xs text-gray-500 mt-2">
                      EN = English, ES = Spanish, FR = French, DE = German, IT = Italian, PT = Portuguese,
                      RU = Russian, JA = Japanese, KO = Korean, ZH = Chinese, AR = Arabic, HI = Hindi, TR = Turkish, NL = Dutch,
                      PL = Polish, SV = Swedish, NO = Norwegian, DA = Danish, FI = Finnish, TH = Thai
<br></br>
<br></br>
                     <b>For example you can enter "EN" for English or "EN,ES" for English and Spanish </b>
                     <br></br>
<br></br>
                     <b>Do not use spaces. </b>
                    </p>
                  </div>
                </div>
              </div>
              </div>
            </div>
          )}

          {/* Updates Section */}
          {activeSection === 'updates' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-white">Updates</h2>
                <p className="text-gray-400 mt-2">Check for and install app updates</p>
              </div>

              {/* Current Version */}
              <div className="bg-gray-900/50 rounded-xl border border-gray-800/70 overflow-hidden backdrop-blur-sm">
                <div className="p-6">
                  <p className="text-white font-semibold text-lg mb-2">Current Version</p>
                  <p className="text-3xl font-bold text-blue-400 mb-1">{currentVersion}</p>
                  <p className="text-sm text-gray-400">Aether Media Player</p>
                </div>
              </div>

              {/* Analytics Consent */}
              <div className="bg-gray-900/50 rounded-xl border border-gray-800/70 overflow-hidden backdrop-blur-sm">
                <div className="p-6 flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-white font-semibold text-lg">Analytics</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Allow anonymous usage tracking for user count only.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const next = analyticsConsent === 'granted' ? 'denied' : 'granted';
                      setAnalyticsConsent(next);
                      void setConsent(next);
                    }}
                    role="switch"
                    aria-checked={analyticsConsent === 'granted'}
                    className={`relative w-16 h-9 rounded-full transition-all duration-300 flex-shrink-0 hover:scale-105 ml-6 ${
                      analyticsConsent === 'granted' ? 'bg-blue-600' : 'bg-gray-700'
                    }`}
                  >
                    <div className={`absolute top-1.5 w-6 h-6 bg-white rounded-full shadow-lg transition-transform duration-300 ${
                      analyticsConsent === 'granted' ? 'translate-x-8' : 'translate-x-1.5'
                    }`} />
                  </button>
                </div>
                <div className="px-6 pb-5 text-xs text-gray-500">
                  You can change this anytime. Disabling stops future tracking immediately.
                </div>
              </div>

              {/* Check for Updates */}
              <div className="bg-gray-900/50 rounded-xl border border-gray-800/70 overflow-hidden backdrop-blur-sm">
                <div className="p-6">
                  <p className="text-white font-semibold text-lg mb-2">Check for Updates</p>
                  <p className="text-sm text-gray-400 mb-5">Manually check for new versions from GitHub</p>
                  
                  {updateError && (
                    <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <p className="text-red-400 text-sm">{updateError}</p>
                    </div>
                  )}

                  {updateAvailable && !isDownloading && (
                    <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <p className="text-blue-400 font-semibold mb-1">Update Available!</p>
                      <p className="text-blue-300 text-sm">Version {updateVersion} is ready to install</p>
                    </div>
                  )}

                  {!hasCheckedForUpdates && !isCheckingUpdate && !updateError && (
                    <div className="mb-4 p-4 bg-gray-800/50 border border-gray-700/50 rounded-lg">
                      <p className="text-gray-400 text-sm">Click the button below to check for updates</p>
                    </div>
                  )}

                  {hasCheckedForUpdates && !updateAvailable && !isCheckingUpdate && !updateError && (
                    <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <p className="text-green-400 text-sm">You're running the latest version</p>
                    </div>
                  )}

                  {isDownloading && (
                    <div className="mb-4">
                      <p className="text-white text-sm mb-2">Downloading update...</p>
                      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${downloadProgress}%` }}
                        />
                      </div>
                      <p className="text-gray-400 text-xs mt-1">{downloadProgress.toFixed(0)}%</p>
                    </div>
                  )}
                  
                  <div className="flex gap-3">
                    <button
                      onClick={checkForUpdates}
                      disabled={isCheckingUpdate || isDownloading}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white font-semibold rounded-xl transition-all duration-200 hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed flex items-center gap-3"
                    >
                      <svg className={`w-5 h-5 ${isCheckingUpdate ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {isCheckingUpdate ? 'Checking...' : 'Check for Updates'}
                    </button>

                    {updateAvailable && !isDownloading && (
                      <button
                        onClick={downloadAndInstallUpdate}
                        className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-all duration-200 hover:scale-105 flex items-center gap-3"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Install Update
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'account' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-white">Account</h2>
                <p className="text-gray-400 mt-2">Manage your account and session</p>
              </div>

              <div className="bg-gray-900/50 rounded-xl border border-gray-800/70 overflow-hidden backdrop-blur-sm">
                <div className="p-6">
                  <p className="text-white font-semibold text-lg mb-2">Backup & Restore</p>
                  <p className="text-sm text-gray-400 mb-5">
                    Download a backup of all local settings (including home layout, TMDB, SubDL keys) and restore later.
                    <br></br>
                    <br></br>
                    This allows you to apply your settings to other devices, change browsers without losing your configuration, or simply keep a backup in case you need to reset your settings in the future.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={downloadSettingsBackup}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all duration-200 hover:scale-105 flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download Backup
                    </button>

                    <button
                      onClick={() => restoreInputRef.current?.click()}
                      className="px-6 py-3 bg-gray-800/70 hover:bg-gray-700 text-white font-semibold rounded-xl transition-all duration-200 hover:scale-105 flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M12 16V4m0 0L8 8m4-4l4 4" />
                      </svg>
                      Restore Backup
                    </button>
                    <input
                      ref={restoreInputRef}
                      type="file"
                      accept="application/json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          void handleRestoreFile(file);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-gray-900/50 rounded-xl border border-gray-800/70 overflow-hidden backdrop-blur-sm">
                <div className="p-6">
                  <p className="text-white font-semibold text-lg mb-2">Session Management</p>
                  <p className="text-sm text-gray-400 mb-5">Sign out of your current session</p>
                  <button
                    onClick={handleLogout}
                    className="px-6 py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 font-semibold rounded-xl transition-all duration-200 hover:scale-105 flex items-center gap-3"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
      </div>
      <div className="shrink-0">
        <Footer />
      </div>
    </div>
  );
}
