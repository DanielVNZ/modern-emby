import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { embyApi } from '../services/embyApi';
import type { EmbyItem } from '../types/emby.types';
import { LoadingScreen } from './LoadingScreen';
import { useTVNavigation } from '../hooks/useTVNavigation';

interface WatchStats {
  totalMovies: number;
  totalEpisodes: number;
  totalSeries: number;
  totalWatchTimeTicks: number;
  favoriteGenres: { name: string; count: number }[];
  favoriteStudios: { name: string; count: number }[];
  recentlyWatched: EmbyItem[];
  mostWatched: EmbyItem[];
  oldestWatched: EmbyItem | null;
  newestWatched: EmbyItem | null;
  averageRating: number;
  totalItems: number;
}

export function Stats() {
  const navigate = useNavigate();
  // Enable DPAD navigation for this screen
  useTVNavigation();
  const [stats, setStats] = useState<WatchStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setIsLoading(true);

      // Fetch all played movies
      const playedMovies = await embyApi.getItems({
        recursive: true,
        includeItemTypes: 'Movie',
        filters: 'IsPlayed',
        fields: 'Genres,Studios,CommunityRating,RunTimeTicks,ProductionYear,UserData',
      });

      // Fetch all played episodes
      const playedEpisodes = await embyApi.getItems({
        recursive: true,
        includeItemTypes: 'Episode',
        filters: 'IsPlayed',
        fields: 'Genres,Studios,RunTimeTicks,SeriesName,UserData',
      });

      // Fetch played series (unique)
      const playedSeries = await embyApi.getItems({
        recursive: true,
        includeItemTypes: 'Series',
        filters: 'IsPlayed',
      });

      // Calculate total watch time
      let totalWatchTimeTicks = 0;
      const genreCount: Record<string, number> = {};
      const studioCount: Record<string, number> = {};
      let totalRating = 0;
      let ratedCount = 0;

      // Process movies
      playedMovies.Items.forEach((movie) => {
        if (movie.RunTimeTicks) {
          totalWatchTimeTicks += movie.RunTimeTicks * (movie.UserData?.PlayCount || 1);
        }
        movie.Genres?.forEach((genre) => {
          genreCount[genre] = (genreCount[genre] || 0) + 1;
        });
        movie.Studios?.forEach((studio) => {
          studioCount[studio.Name] = (studioCount[studio.Name] || 0) + 1;
        });
        if (movie.CommunityRating) {
          totalRating += movie.CommunityRating;
          ratedCount++;
        }
      });

      // Process episodes
      playedEpisodes.Items.forEach((episode) => {
        if (episode.RunTimeTicks) {
          totalWatchTimeTicks += episode.RunTimeTicks * (episode.UserData?.PlayCount || 1);
        }
        episode.Genres?.forEach((genre) => {
          genreCount[genre] = (genreCount[genre] || 0) + 1;
        });
      });

      // Sort genres and studios
      const favoriteGenres = Object.entries(genreCount)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const favoriteStudios = Object.entries(studioCount)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Get most watched (by play count)
      const allItems = [...playedMovies.Items, ...playedEpisodes.Items];
      const mostWatched = allItems
        .filter((item) => (item.UserData?.PlayCount || 0) > 1)
        .sort((a, b) => (b.UserData?.PlayCount || 0) - (a.UserData?.PlayCount || 0))
        .slice(0, 10);

      // Find oldest and newest watched movies
      const moviesWithYear = playedMovies.Items.filter((m) => m.ProductionYear);
      const oldestWatched = moviesWithYear.length > 0
        ? moviesWithYear.reduce((a, b) => (a.ProductionYear! < b.ProductionYear! ? a : b))
        : null;
      const newestWatched = moviesWithYear.length > 0
        ? moviesWithYear.reduce((a, b) => (a.ProductionYear! > b.ProductionYear! ? a : b))
        : null;

      setStats({
        totalMovies: playedMovies.TotalRecordCount,
        totalEpisodes: playedEpisodes.TotalRecordCount,
        totalSeries: playedSeries.TotalRecordCount,
        totalWatchTimeTicks,
        favoriteGenres,
        favoriteStudios,
        recentlyWatched: [],
        mostWatched,
        oldestWatched,
        newestWatched,
        averageRating: ratedCount > 0 ? totalRating / ratedCount : 0,
        totalItems: playedMovies.TotalRecordCount + playedEpisodes.TotalRecordCount,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatWatchTime = (ticks: number) => {
    const totalMinutes = Math.floor(ticks / 600000000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    return parts.join(' ') || '0m';
  };

  const formatWatchTimeDetailed = (ticks: number) => {
    const totalMinutes = Math.floor(ticks / 600000000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    const parts = [];
    if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
    return parts.join(', ') || '0 minutes';
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Failed to load statistics</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/home')}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Watch Statistics</h1>
              <p className="text-sm text-gray-400">Your viewing history at a glance</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Main Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {/* Total Watch Time */}
          <div className="col-span-2 bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-2xl p-6 border border-blue-500/20">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Total Watch Time</p>
                <p className="text-3xl font-bold text-white">{formatWatchTime(stats.totalWatchTimeTicks)}</p>
              </div>
            </div>
            <p className="text-gray-500 text-sm">{formatWatchTimeDetailed(stats.totalWatchTimeTicks)}</p>
          </div>

          {/* Movies Watched */}
          <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
              </svg>
            </div>
            <p className="text-gray-400 text-sm">Movies Watched</p>
            <p className="text-2xl font-bold text-white">{stats.totalMovies}</p>
          </div>

          {/* Episodes Watched */}
          <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/>
              </svg>
            </div>
            <p className="text-gray-400 text-sm">Episodes Watched</p>
            <p className="text-2xl font-bold text-white">{stats.totalEpisodes}</p>
          </div>
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {/* Series Completed */}
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
            <p className="text-gray-400 text-xs mb-1">Series Watched</p>
            <p className="text-xl font-bold text-white">{stats.totalSeries}</p>
          </div>

          {/* Average Rating */}
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
            <p className="text-gray-400 text-xs mb-1">Avg Movie Rating</p>
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
              </svg>
              <p className="text-xl font-bold text-white">{stats.averageRating.toFixed(1)}</p>
            </div>
          </div>

          {/* Oldest Watched */}
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
            <p className="text-gray-400 text-xs mb-1">Oldest Movie</p>
            <p className="text-xl font-bold text-white">{stats.oldestWatched?.ProductionYear || '-'}</p>
            {stats.oldestWatched && (
              <p className="text-xs text-gray-500 truncate">{stats.oldestWatched.Name}</p>
            )}
          </div>

          {/* Newest Watched */}
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
            <p className="text-gray-400 text-xs mb-1">Newest Movie</p>
            <p className="text-xl font-bold text-white">{stats.newestWatched?.ProductionYear || '-'}</p>
            {stats.newestWatched && (
              <p className="text-xs text-gray-500 truncate">{stats.newestWatched.Name}</p>
            )}
          </div>
        </div>

        {/* Genres & Studios */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Favorite Genres */}
          <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Top Genres
            </h3>
            <div className="space-y-3">
              {stats.favoriteGenres.slice(0, 5).map((genre, index) => (
                <div key={genre.name} className="flex items-center gap-3">
                  <span className="text-gray-500 text-sm w-5">{index + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-white text-sm">{genre.name}</span>
                      <span className="text-gray-400 text-xs">{genre.count} items</span>
                    </div>
                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                        style={{ width: `${(genre.count / stats.favoriteGenres[0].count) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Favorite Studios */}
          <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Top Studios
            </h3>
            <div className="space-y-3">
              {stats.favoriteStudios.slice(0, 5).map((studio, index) => (
                <div key={studio.name} className="flex items-center gap-3">
                  <span className="text-gray-500 text-sm w-5">{index + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-white text-sm truncate">{studio.name}</span>
                      <span className="text-gray-400 text-xs">{studio.count} movies</span>
                    </div>
                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                        style={{ width: `${(studio.count / stats.favoriteStudios[0].count) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Most Rewatched */}
        {stats.mostWatched.length > 0 && (
          <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Most Rewatched
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {stats.mostWatched.slice(0, 5).map((item) => {
                const imageUrl = item.ImageTags?.Primary
                  ? embyApi.getImageUrl(item.Id, 'Primary', { maxWidth: 200, tag: item.ImageTags.Primary })
                  : '';
                return (
                  <button
                    key={item.Id}
                    onClick={() => navigate(`/details/${item.Id}`)}
                    className="cursor-pointer group text-left focusable-card"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/details/${item.Id}`);
                      }
                    }}
                  >
                    <div className="relative aspect-[2/3] bg-gray-700 rounded-lg overflow-hidden mb-2">
                      {imageUrl ? (
                        <img src={imageUrl} alt={item.Name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600">
                          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
                          </svg>
                        </div>
                      )}
                      <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">
                        {item.UserData?.PlayCount}x
                      </div>
                    </div>
                    <p className="text-white text-sm font-medium truncate group-hover:text-blue-400 transition-colors">
                      {item.Name}
                    </p>
                    {item.Type === 'Episode' && item.SeriesName && (
                      <p className="text-gray-500 text-xs truncate">{item.SeriesName}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
