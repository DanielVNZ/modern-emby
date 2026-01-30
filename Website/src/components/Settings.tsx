import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTVNavigation } from '../hooks/useTVNavigation';
import { embyApi } from '../services/embyApi';
import { useAuth } from '../hooks/useAuth';

export function Settings() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const backButtonRef = useRef<HTMLButtonElement>(null);
  
  useTVNavigation({
    onBack: () => {
      navigate('/home');
      return true;
    }
  });

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
  const [availableGenres, setAvailableGenres] = useState<string[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  // Focus back button on mount
  useEffect(() => {
    setTimeout(() => {
      backButtonRef.current?.focus();
    }, 100);
  }, []);

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gray-950/90 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            ref={backButtonRef}
            onClick={() => navigate('/home')}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors focusable-tab"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Home Screen Section */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white">Home Screen</h2>
          </div>

          <div className="bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden">
            {/* Featured Section Toggle */}
            <div className="p-5 flex items-center justify-between">
              <div className="flex-1 pr-4">
                <p className="text-white font-medium">Featured Section</p>
                <p className="text-sm text-gray-500 mt-1">Show the hero banner at the top of the home screen</p>
              </div>
              <button
                onClick={() => {
                  const newValue = !showFeatured;
                  setShowFeatured(newValue);
                  localStorage.setItem('emby_showFeatured', JSON.stringify(newValue));
                }}
                tabIndex={0}
                role="switch"
                aria-checked={showFeatured}
                className={`relative w-16 h-9 rounded-full transition-colors focusable-tab flex-shrink-0 ${
                  showFeatured ? 'bg-blue-600' : 'bg-gray-700'
                }`}
              >
                <div className={`absolute top-1.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  showFeatured ? 'translate-x-8' : 'translate-x-1.5'
                }`} />
              </button>
            </div>

            {/* Featured Filters */}
            {showFeatured && (
              <>
                <div className="border-t border-gray-800" />
                <div className="p-5">
                  <p className="text-white font-medium mb-1">Featured Content Filters</p>
                  <p className="text-sm text-gray-500 mb-5">Curate what appears in the featured section</p>

                  {/* Content Type */}
                  <div className="mb-5">
                    <label className="block text-sm text-gray-400 mb-3">Content Type</label>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => {
                          const newValue = { ...featuredMediaType, movies: !featuredMediaType.movies };
                          if (!newValue.movies && !newValue.tvShows) newValue.tvShows = true;
                          setFeaturedMediaType(newValue);
                          localStorage.setItem('emby_featuredMediaType', JSON.stringify(newValue));
                        }}
                        className={`flex items-center gap-3 px-5 py-3 rounded-xl transition-all focusable-tab ${
                          featuredMediaType.movies 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
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
                        className={`flex items-center gap-3 px-5 py-3 rounded-xl transition-all focusable-tab ${
                          featuredMediaType.tvShows 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
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

                  {/* Genre & Year in Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Genre</label>
                      <select
                        value={featuredGenre}
                        onChange={(e) => {
                          setFeaturedGenre(e.target.value);
                          localStorage.setItem('emby_featuredGenre', e.target.value);
                        }}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500 focusable-tab appearance-none cursor-pointer"
                      >
                        <option value="">Any Genre</option>
                        {availableGenres.map((genre) => (
                          <option key={genre} value={genre}>{genre}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Year</label>
                      <select
                        value={featuredYear}
                        onChange={(e) => {
                          setFeaturedYear(e.target.value);
                          localStorage.setItem('emby_featuredYear', e.target.value);
                        }}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500 focusable-tab appearance-none cursor-pointer"
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
        </section>

        {/* Playback Section */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white">Playback</h2>
          </div>

          <div className="bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden">
            {/* Video Quality */}
            <div className="p-5">
              <label className="block text-white font-medium mb-1">Video Quality</label>
              <p className="text-sm text-gray-500 mb-4">Choose your preferred video quality</p>
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
                    className={`p-4 rounded-xl text-left transition-all focusable-tab ${
                      playbackQuality === option.value
                        ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <p className="font-medium">{option.label}</p>
                    <p className={`text-xs mt-1 ${playbackQuality === option.value ? 'text-purple-200' : 'text-gray-500'}`}>
                      {option.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-800" />

            {/* Audio Language */}
            <div className="p-5">
              <label className="block text-white font-medium mb-1">Default Audio Language</label>
              <p className="text-sm text-gray-500 mb-4">Automatically select this language when available</p>
              <select
                value={preferredAudioLang}
                onChange={(e) => {
                  setPreferredAudioLang(e.target.value);
                  localStorage.setItem('emby_preferredAudioLang', e.target.value);
                }}
                className="w-full sm:w-auto min-w-[200px] px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500 focusable-tab appearance-none cursor-pointer"
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
        </section>

        {/* Account Section */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white">Account</h2>
          </div>

          <div className="bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden">
            <div className="p-5">
              <button
                onClick={handleLogout}
                className="w-full sm:w-auto px-6 py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 font-medium rounded-xl transition-colors focusable-tab flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        </section>

        {/* Save Button */}
        <div className="sticky bottom-6 flex justify-center">
          <button
            onClick={handleSave}
            className="px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl shadow-lg shadow-blue-600/30 transition-all focusable-tab flex items-center gap-3"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Save & Return Home
          </button>
        </div>

        {/* Bottom spacing for TV */}
        <div className="h-20" />
      </div>
    </div>
  );
}
