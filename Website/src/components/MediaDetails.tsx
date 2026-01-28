import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { embyApi } from '../services/embyApi';
import { LoadingScreen } from './LoadingScreen';
import { useTVNavigation } from '../hooks/useTVNavigation';
import type { EmbyItem } from '../types/emby.types';

// Episode Card with image loading animation
function EpisodeCard({ 
  episode, 
  thumbUrl, 
  progress, 
  isWatched, 
  onEpisodeClick,
  onToggleWatched,
  formatRuntime 
}: { 
  episode: EmbyItem; 
  thumbUrl: string;
  progress: number;
  isWatched: boolean;
  onEpisodeClick: (episode: EmbyItem) => void;
  onToggleWatched: (episode: EmbyItem, currentlyWatched: boolean) => void;
  formatRuntime: (ticks: number) => string;
}) {
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const handleToggleWatched = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isToggling) return;
    setIsToggling(true);
    try {
      await onToggleWatched(episode, isWatched);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div
      onClick={() => onEpisodeClick(episode)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEpisodeClick(episode);
        }
      }}
      tabIndex={0}
      role="button"
      className="group bg-white/5 hover:bg-white/10 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 focusable-card text-left"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gray-800">
        {thumbUrl ? (
          <>
            {/* Loading placeholder with pulse animation */}
            {!isImageLoaded && (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-gray-700 to-gray-800" />
            )}
            <img
              src={thumbUrl}
              alt={episode.Name}
              loading="lazy"
              onLoad={() => setIsImageLoaded(true)}
              className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${
                isImageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                animation: isImageLoaded ? 'fadeInPulse 0.6s ease-out' : 'none'
              }}
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600 bg-gradient-to-br from-gray-800 to-gray-900">
            <svg className="w-10 h-10 opacity-30" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
            </svg>
          </div>
        )}

        {/* Episode number badge */}
        <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/70 backdrop-blur-sm rounded text-xs font-medium text-white">
          E{episode.IndexNumber}
        </div>

        {/* Duration badge */}
        {episode.RunTimeTicks && (
          <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/70 backdrop-blur-sm rounded text-xs text-gray-300">
            {formatRuntime(episode.RunTimeTicks)}
          </div>
        )}

        {/* Watched indicator / Toggle button */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleToggleWatched}
          disabled={isToggling}
          tabIndex={-1}
          className={`absolute bottom-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 z-20 ${
            isWatched 
              ? 'bg-green-500 hover:bg-green-600' 
              : 'bg-gray-700/80 hover:bg-gray-600'
          } ${!isWatched && !isToggling ? 'opacity-0 group-hover:opacity-100 focus:opacity-100' : ''} ${isToggling ? 'animate-pulse opacity-100' : ''}`}
          title={isWatched ? 'Mark as unwatched' : 'Mark as watched'}
        >
          {isToggling ? (
            <svg className="w-3 h-3 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
          )}
        </button>

        {/* Play overlay on hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg pl-1">
            <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </div>

        {/* Progress bar */}
        {progress > 0 && !isWatched && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="text-white font-medium text-sm line-clamp-1 group-hover:text-blue-400 transition-colors">
          {episode.Name}
        </h3>
        {episode.Overview && (
          <p className="text-gray-500 text-xs line-clamp-2 mt-1">{episode.Overview}</p>
        )}
      </div>
    </div>
  );
}

export function MediaDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  useTVNavigation();
  
  const [item, setItem] = useState<EmbyItem | null>(null);
  const [seasons, setSeasons] = useState<EmbyItem[]>([]);
  const [episodes, setEpisodes] = useState<EmbyItem[]>([]);
  const [allEpisodes, setAllEpisodes] = useState<EmbyItem[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showContent, setShowContent] = useState(false);
  const [continueWatchingEpisode, setContinueWatchingEpisode] = useState<EmbyItem | null>(null);
  const [similarItems, setSimilarItems] = useState<EmbyItem[]>([]);
  const playButtonRef = useRef<HTMLButtonElement>(null);
  const similarScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollSimilarLeft, setCanScrollSimilarLeft] = useState(false);
  const [canScrollSimilarRight, setCanScrollSimilarRight] = useState(true);
  const hasAutoSelectedSeasonRef = useRef(false);

  useEffect(() => {
    if (id) {
      // Reset the auto-select flag when loading a new item
      hasAutoSelectedSeasonRef.current = false;
      loadItemDetails();
    }
  }, [id]);

  useEffect(() => {
    if (selectedSeason) {
      loadEpisodes(selectedSeason);
    }
  }, [selectedSeason]);

  // Find continue watching episode when all episodes are loaded
  useEffect(() => {
    if (allEpisodes.length > 0) {
      // Sort all episodes by season and episode number (ascending)
      const sortedEpisodes = [...allEpisodes].sort((a, b) => {
        const seasonA = a.ParentIndexNumber || 0;
        const seasonB = b.ParentIndexNumber || 0;
        if (seasonA !== seasonB) return seasonA - seasonB;
        const epA = a.IndexNumber || 0;
        const epB = b.IndexNumber || 0;
        return epA - epB;
      });

      // Helper to compare episode order
      const isAfter = (epA: EmbyItem, epB: EmbyItem) => {
        const seasonA = epA.ParentIndexNumber || 0;
        const seasonB = epB.ParentIndexNumber || 0;
        if (seasonA !== seasonB) return seasonA > seasonB;
        return (epA.IndexNumber || 0) > (epB.IndexNumber || 0);
      };

      // Find the latest episode that's partially watched (has progress but not completed)
      const inProgressEpisodes = sortedEpisodes.filter(
        ep => ep.UserData?.PlaybackPositionTicks && ep.UserData.PlaybackPositionTicks > 0 && !ep.UserData?.Played
      );
      
      let latestInProgress: EmbyItem | null = null;
      if (inProgressEpisodes.length > 0) {
        // Get the furthest in-progress episode
        latestInProgress = inProgressEpisodes.reduce((latest, ep) => 
          isAfter(ep, latest) ? ep : latest
        , inProgressEpisodes[0]);
      }

      // Find the last completed episode
      const completedEpisodes = sortedEpisodes.filter(ep => ep.UserData?.Played);
      let lastCompleted: EmbyItem | null = null;
      if (completedEpisodes.length > 0) {
        lastCompleted = completedEpisodes.reduce((latest, ep) => 
          isAfter(ep, latest) ? ep : latest
        , completedEpisodes[0]);
      }

      let nextUpEpisode: EmbyItem | null = null;

      // If there's an in-progress episode
      if (latestInProgress) {
        // Check if there's a completed episode AFTER the in-progress one
        if (lastCompleted && isAfter(lastCompleted, latestInProgress)) {
          // There's a completed episode after our in-progress one
          // So find the first unwatched episode after the last completed one
          nextUpEpisode = sortedEpisodes.find(ep => 
            !ep.UserData?.Played && isAfter(ep, lastCompleted!)
          ) || null;
        } else {
          // No completed episode after in-progress, use the in-progress episode
          nextUpEpisode = latestInProgress;
        }
      } else if (lastCompleted) {
        // No in-progress episodes, find first unwatched after last completed
        nextUpEpisode = sortedEpisodes.find(ep => 
          !ep.UserData?.Played && isAfter(ep, lastCompleted!)
        ) || null;
      } else {
        // Nothing watched at all, start from the first episode
        nextUpEpisode = sortedEpisodes.find(ep => !ep.UserData?.Played) || sortedEpisodes[0];
      }
      
      if (nextUpEpisode) {
        // Only update if the continue watching episode actually changed
        setContinueWatchingEpisode(prev => {
          if (prev?.Id === nextUpEpisode.Id) return prev;
          return nextUpEpisode;
        });
        
        // Auto-select the season containing the continue watching episode
        // Only do this on initial load, not when user has manually navigated
        if (!hasAutoSelectedSeasonRef.current && seasons.length > 0 && nextUpEpisode.ParentIndexNumber !== undefined) {
          // Find season by index number
          const seasonForEpisode = seasons.find(s => s.IndexNumber === nextUpEpisode.ParentIndexNumber);
          if (seasonForEpisode) {
            setSelectedSeason(seasonForEpisode.Id);
            hasAutoSelectedSeasonRef.current = true;
          }
        }
      }
    }
  }, [allEpisodes, seasons]);

  // Focus the play button when loading completes
  useEffect(() => {
    if (!isLoading && item) {
      // Trigger content fade in after a short delay
      const showTimer = setTimeout(() => {
        setShowContent(true);
      }, 50);
      
      // Focus play button
      const focusTimer = setTimeout(() => {
        playButtonRef.current?.focus();
      }, 100);
      
      return () => {
        clearTimeout(showTimer);
        clearTimeout(focusTimer);
      };
    }
  }, [isLoading, item]);

  const loadItemDetails = async () => {
    try {
      setIsLoading(true);
      
      // Get item details
      const itemData = await embyApi.getItem(id!);
      setItem(itemData);

      // Load similar items (works for both movies and series)
      const similar = await embyApi.getSimilarItems(id!, 12);
      setSimilarItems(similar);

      // If it's a series, load seasons and find continue watching episode
      if (itemData.Type === 'Series') {
        const seasonsResponse = await embyApi.getItems({
          parentId: id,
          sortBy: 'SortName',
          sortOrder: 'Ascending',
        });
        setSeasons(seasonsResponse.Items);
        
        // Auto-select first season
        if (seasonsResponse.Items.length > 0) {
          setSelectedSeason(seasonsResponse.Items[0].Id);
        }

        // Load ALL episodes to find continue watching
        const allEpisodesResponse = await embyApi.getItems({
          parentId: id,
          recursive: true,
          includeItemTypes: 'Episode',
          sortBy: 'SortName',
          sortOrder: 'Ascending',
        });
        setAllEpisodes(allEpisodesResponse.Items);
      }
    } catch (error) {
      console.error('Failed to load item details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadEpisodes = async (seasonId: string) => {
    try {
      const episodesResponse = await embyApi.getItems({
        parentId: seasonId,
        sortBy: 'IndexNumber',
        sortOrder: 'Ascending',
      });
      setEpisodes(episodesResponse.Items);
    } catch (error) {
      console.error('Failed to load episodes:', error);
    }
  };

  const handlePlay = async (itemToPlay?: EmbyItem) => {
    const playItem = itemToPlay || item;
    if (!playItem) return;

    // For series, play first unwatched episode or first episode
    if (playItem.Type === 'Series') {
      const firstEpisode = allEpisodes.find(ep => !ep.UserData?.Played) || allEpisodes[0] || episodes[0];
      if (firstEpisode) {
        navigate(`/player/${firstEpisode.Id}`);
      }
      return;
    }

    // For movies/episodes, play directly
    navigate(`/player/${playItem.Id}`);
  };

  const handleContinueWatching = () => {
    if (continueWatchingEpisode) {
      navigate(`/player/${continueWatchingEpisode.Id}`);
    }
  };

  const handleEpisodeClick = (episode: EmbyItem) => {
    navigate(`/player/${episode.Id}`);
  };

  const handleToggleWatched = async (episode: EmbyItem, currentlyWatched: boolean) => {
    try {
      if (currentlyWatched) {
        await embyApi.markUnplayed(episode.Id);
      } else {
        await embyApi.markPlayed(episode.Id);
      }
      
      // Only update the displayed episodes, not allEpisodes
      // This prevents the continue watching effect from running and causing scroll
      setEpisodes(eps => 
        eps.map(ep => 
          ep.Id === episode.Id 
            ? { ...ep, UserData: { ...ep.UserData, Played: !currentlyWatched, PlaybackPositionTicks: 0 } } as EmbyItem
            : ep
        )
      );
    } catch (error) {
      console.error('Failed to toggle watched status:', error);
    }
  };

  const formatRuntime = (ticks?: number) => {
    if (!ticks) return '';
    const minutes = Math.floor(ticks / 600000000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (isLoading || !item) {
    return <LoadingScreen isVisible={true} />;
  }

  const backdropUrl = item.BackdropImageTags?.[0]
    ? embyApi.getImageUrl(item.Id, 'Backdrop', { maxWidth: 1920, tag: item.BackdropImageTags[0] })
    : '';

  const posterUrl = item.ImageTags?.Primary
    ? embyApi.getImageUrl(item.Id, 'Primary', { maxWidth: 400, tag: item.ImageTags.Primary })
    : '';

  const logoUrl = item.ImageTags?.Logo
    ? embyApi.getImageUrl(item.Id, 'Logo', { maxWidth: 500, tag: item.ImageTags.Logo })
    : '';

  return (
    <div className={`min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 transition-opacity duration-500 ${showContent ? 'opacity-100' : 'opacity-0'}`}>
      {/* Fixed Background */}
      <div className="fixed inset-0 z-0">
        {backdropUrl && (
          <img
            src={backdropUrl}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/90 to-gray-950/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-gray-950/30" />
      </div>

      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="fixed top-6 left-6 z-50 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm flex items-center justify-center text-white transition-all"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Hero Section */}
      <div className="relative min-h-[70vh] z-10">
        {/* Content */}
        <div className="relative max-w-7xl mx-auto px-6 pt-24 pb-6 flex gap-10">
          {/* Poster */}
          <div className="hidden md:block flex-shrink-0 w-72">
            <div className="aspect-[2/3] rounded-xl overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-white/10">
              {posterUrl ? (
                <img
                  src={posterUrl}
                  alt={item.Name}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                  <svg className="w-20 h-20 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 flex flex-col justify-center">
            {/* Logo or Title */}
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={item.Name}
                loading="lazy"
                className="max-w-md max-h-32 object-contain mb-6"
              />
            ) : (
              <h1 className="text-5xl font-bold text-white mb-4">{item.Name}</h1>
            )}

            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-4 mb-6 text-gray-300">
              {item.ProductionYear && (
                <span className="text-lg">{item.ProductionYear}</span>
              )}
              {item.OfficialRating && (
                <span className="px-2 py-1 bg-white/10 rounded border border-white/20 text-sm font-medium">
                  {item.OfficialRating}
                </span>
              )}
              {item.CommunityRating && (
                <span className="flex items-center gap-1">
                  <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                  </svg>
                  {item.CommunityRating.toFixed(1)}
                </span>
              )}
              {item.RunTimeTicks && (
                <span>{formatRuntime(item.RunTimeTicks)}</span>
              )}
              {item.Type === 'Series' && seasons.length > 0 && (
                <span>{seasons.length} Season{seasons.length !== 1 ? 's' : ''}</span>
              )}
            </div>

            {/* Genres */}
            {item.Genres && item.Genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {item.Genres.map((genre) => (
                  <button
                    key={genre}
                    onClick={() => navigate(`/browse?type=${item.Type === 'Series' ? 'Series' : 'Movie'}&genre=${encodeURIComponent(genre)}`)}
                    className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm border border-blue-500/30 hover:bg-blue-500/30 hover:border-blue-400/50 transition-colors cursor-pointer"
                  >
                    {genre}
                  </button>
                ))}
              </div>
            )}

            {/* Overview */}
            {item.Overview && (
              <p className="text-gray-300 text-lg leading-relaxed mb-8 max-w-3xl line-clamp-4">
                {item.Overview}
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4">
              {/* Continue Watching button for series with in-progress episode */}
              {continueWatchingEpisode && item.Type === 'Series' && (
                <button
                  ref={playButtonRef}
                  onClick={handleContinueWatching}
                  className="px-8 py-4 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-all duration-200 flex items-center gap-3 shadow-xl shadow-white/10 text-lg primary-action"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                  <div className="text-left">
                    <div>Continue Watching</div>
                    <div className="text-xs font-normal text-gray-600">
                      S{continueWatchingEpisode.ParentIndexNumber || 1} E{continueWatchingEpisode.IndexNumber || 1} - {continueWatchingEpisode.Name}
                    </div>
                  </div>
                </button>
              )}
              
              {/* Regular Play button */}
              {(!continueWatchingEpisode || item.Type !== 'Series') && (
                <button
                  ref={playButtonRef}
                  onClick={() => handlePlay()}
                  className="px-8 py-4 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-all duration-200 flex items-center gap-3 shadow-xl shadow-white/10 text-lg primary-action"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                  {item.UserData?.PlaybackPositionTicks ? 'Resume' : 'Play'}
                </button>
              )}
              
              {/* Play from Beginning for movies with progress */}
              {!!item.UserData?.PlaybackPositionTicks && item.Type !== 'Series' && (
                <button
                  onClick={() => handlePlay()}
                  className="px-6 py-4 bg-white/10 text-white font-medium rounded-lg hover:bg-white/20 transition-all duration-200 backdrop-blur-sm border border-white/10"
                >
                  Play from Beginning
                </button>
              )}

              {/* Play from Beginning for series with continue watching */}
              {continueWatchingEpisode && item.Type === 'Series' && (
                <button
                  onClick={() => handlePlay()}
                  className="px-6 py-4 bg-white/10 text-white font-medium rounded-lg hover:bg-white/20 transition-all duration-200 backdrop-blur-sm border border-white/10"
                >
                  Play from Beginning
                </button>
              )}
            </div>

            {/* Additional Info */}
            <div className="mt-6 grid grid-cols-2 gap-3 text-sm max-w-xl">
              {item.Studios && item.Studios.length > 0 && (
                <div>
                  <span className="text-gray-500">Studio</span>
                  <p className="text-white">{item.Studios.map(s => s.Name).join(', ')}</p>
                </div>
              )}
              {item.PremiereDate && (
                <div>
                  <span className="text-gray-500">Release Date</span>
                  <p className="text-white">{new Date(item.PremiereDate).toLocaleDateString()}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Seasons & Episodes for Series */}
      {item.Type === 'Series' && seasons.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 -mt-30 relative z-10">
          {/* Season Selector - Dropdown style for many seasons, tabs for few */}
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-xl font-bold text-white">Episodes</h2>
            {seasons.length <= 5 ? (
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {seasons.map((season) => (
                  <button
                    key={season.Id}
                    onClick={() => setSelectedSeason(season.Id)}
                    className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all duration-200 text-sm focusable-tab ${
                      selectedSeason === season.Id
                        ? 'bg-white text-black'
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                  >
                    {season.Name}
                  </button>
                ))}
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedSeason || ''}
                  onChange={(e) => setSelectedSeason(e.target.value)}
                  className="appearance-none px-4 py-2 pr-10 bg-white/10 text-white rounded-lg border border-white/10 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {seasons.map((season) => (
                    <option key={season.Id} value={season.Id} className="bg-gray-900">
                      {season.Name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            )}
            <span className="text-gray-500 text-sm">{episodes.length} episodes</span>
          </div>

          {/* Episodes - Compact Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {episodes.map((episode) => {
              const thumbUrl = episode.ImageTags?.Primary
                ? embyApi.getImageUrl(episode.Id, 'Primary', { maxWidth: 400, tag: episode.ImageTags.Primary })
                : '';
              const progress = episode.UserData?.PlaybackPositionTicks && episode.RunTimeTicks
                ? (episode.UserData.PlaybackPositionTicks / episode.RunTimeTicks) * 100
                : 0;
              const isWatched = episode.UserData?.Played || false;

              return (
                <EpisodeCard
                  key={episode.Id}
                  episode={episode}
                  thumbUrl={thumbUrl}
                  progress={progress}
                  isWatched={isWatched}
                  onEpisodeClick={handleEpisodeClick}
                  onToggleWatched={handleToggleWatched}
                  formatRuntime={formatRuntime}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* More Like This Section */}
      {similarItems.length > 0 && (
        <div className="relative z-10 px-6 lg:px-12 py-8">
          <h2 className="text-xl font-bold text-white mb-4">More Like This</h2>
          <div className="relative group/similar">
            {/* Left scroll button */}
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                if (similarScrollRef.current) {
                  similarScrollRef.current.scrollBy({ left: -similarScrollRef.current.clientWidth * 0.8, behavior: 'smooth' });
                }
              }}
              className={`absolute left-0 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-black/90 hover:bg-black hover:scale-110 text-white flex items-center justify-center shadow-xl transition-opacity duration-200 opacity-0 group-hover/similar:opacity-100 ${!canScrollSimilarLeft ? 'invisible' : ''}`}
              aria-label="Scroll left"
              tabIndex={-1}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Right scroll button */}
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                if (similarScrollRef.current) {
                  similarScrollRef.current.scrollBy({ left: similarScrollRef.current.clientWidth * 0.8, behavior: 'smooth' });
                }
              }}
              className={`absolute right-0 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-black/90 hover:bg-black hover:scale-110 text-white flex items-center justify-center shadow-xl transition-opacity duration-200 opacity-0 group-hover/similar:opacity-100 ${!canScrollSimilarRight ? 'invisible' : ''}`}
              aria-label="Scroll right"
              tabIndex={-1}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Fade edges */}
            <div className={`absolute left-0 top-0 bottom-4 w-12 bg-gradient-to-r from-gray-950 to-transparent pointer-events-none z-10 transition-opacity duration-200 ${canScrollSimilarLeft ? 'opacity-100' : 'opacity-0'}`} />
            <div className={`absolute right-0 top-0 bottom-4 w-12 bg-gradient-to-l from-gray-950 to-transparent pointer-events-none z-10 transition-opacity duration-200 ${canScrollSimilarRight ? 'opacity-100' : 'opacity-0'}`} />

            <div
              ref={similarScrollRef}
              onScroll={() => {
                if (similarScrollRef.current) {
                  const { scrollLeft, scrollWidth, clientWidth } = similarScrollRef.current;
                  setCanScrollSimilarLeft(scrollLeft > 0);
                  setCanScrollSimilarRight(scrollLeft < scrollWidth - clientWidth - 10);
                }
              }}
              className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide"
            >
            {similarItems.map((similarItem) => {
              const imageUrl = similarItem.ImageTags?.Primary
                ? embyApi.getImageUrl(similarItem.Id, 'Primary', { maxWidth: 300, tag: similarItem.ImageTags.Primary })
                : '';
              
              return (
                <button
                  key={similarItem.Id}
                  onClick={() => navigate(`/details/${similarItem.Id}`)}
                  className="flex-shrink-0 w-36 lg:w-44 group text-left focusable-card"
                >
                  <div className="relative aspect-[2/3] bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl overflow-hidden mb-3 shadow-lg ring-1 ring-white/5">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={similarItem.Name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600">
                        <svg className="w-12 h-12 opacity-30" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
                        </svg>
                      </div>
                    )}
                    {/* Rating badge */}
                    {similarItem.CommunityRating && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/70 backdrop-blur-sm rounded text-xs font-medium text-yellow-400">
                        ★ {similarItem.CommunityRating.toFixed(1)}
                      </div>
                    )}
                  </div>
                  <h3 className="text-white font-medium text-sm line-clamp-1 group-hover:text-blue-400 transition-colors">
                    {similarItem.Name}
                  </h3>
                  <p className="text-gray-500 text-xs mt-1">
                    {similarItem.ProductionYear}
                    {similarItem.Type === 'Series' && ' • Series'}
                  </p>
                </button>
              );
            })}
            </div>
          </div>
        </div>
      )}

      {/* Footer Spacing */}
      <div className="h-12" />

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
