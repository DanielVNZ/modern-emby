import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { embyApi } from '../services/embyApi';
import { deduplicateItems } from '../services/deduplication';
import { useAuth } from '../hooks/useAuth';
import { useTVNavigation } from '../hooks/useTVNavigation';
import type { EmbyItem } from '../types/emby.types';
import { LoadingScreen } from './LoadingScreen';

// MediaCard component - defined outside Home to prevent recreation on re-renders
const MediaCard = memo(({ item, size = 'normal', onItemClick }: { item: EmbyItem; size?: 'normal' | 'large'; onItemClick: (item: EmbyItem) => void }) => {
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  
  // For episodes, use the series cover art if available
  let imageUrl = '';
  if (item.Type === 'Episode' && item.SeriesId && item.SeriesPrimaryImageTag) {
    imageUrl = embyApi.getImageUrl(item.SeriesId, 'Primary', { maxWidth: size === 'large' ? 360 : 260, tag: item.SeriesPrimaryImageTag });
  } else if (item.ImageTags?.Primary) {
    imageUrl = embyApi.getImageUrl(item.Id, 'Primary', { maxWidth: size === 'large' ? 360 : 260, tag: item.ImageTags.Primary });
  }

  // Responsive card widths - smaller on wider screens to fit more items
  const cardWidth = size === 'large' 
    ? 'w-52 xl:w-44 2xl:w-40' 
    : 'w-40 lg:w-36 xl:w-32 2xl:w-36';

  return (
    <button
      onClick={() => onItemClick(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onItemClick(item);
        }
      }}
      tabIndex={0}
      className={`flex-shrink-0 ${cardWidth} cursor-pointer group/card focusable-card text-left`}
    >
      <div className="relative aspect-[2/3] bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl overflow-hidden mb-4 shadow-xl shadow-black/40 ring-1 ring-white/5">
        {imageUrl ? (
          <>
            {/* Loading placeholder with pulse animation */}
            {!isImageLoaded && (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-gray-700 to-gray-800" />
            )}
            <img
              src={imageUrl}
              alt={item.Name}
              loading="lazy"
              onLoad={() => setIsImageLoaded(true)}
              className={`w-full h-full object-cover group-hover/card:scale-110 transition-all duration-500 ease-out ${
                isImageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                animation: isImageLoaded ? 'fadeInPulse 0.6s ease-out' : 'none'
              }}
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <svg className="w-16 h-16 opacity-30" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
            </svg>
          </div>
        )}
        
        {/* Progress bar */}
        {item.UserData?.PlaybackPositionTicks && item.RunTimeTicks && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
              style={{
                width: `${(item.UserData.PlaybackPositionTicks / item.RunTimeTicks) * 100}%`,
              }}
            />
          </div>
        )}
      </div>
      <div className="h-14 flex flex-col justify-start">
        <h3 className="text-white font-semibold text-sm line-clamp-1 group-hover/card:text-blue-400 transition-colors">
          {item.Type === 'Episode' ? item.SeriesName || item.Name : item.Name}
        </h3>
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
          {item.ProductionYear && <span>{item.ProductionYear}</span>}
          {item.OfficialRating && (
            <span className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-gray-300 text-[11px] font-medium">
              {item.OfficialRating}
            </span>
          )}
          {/* Episode details for Continue Watching */}
          {item.Type === 'Episode' && (
            <span className="text-blue-400 font-semibold text-xs">
              S{item.ParentIndexNumber || 1}E{item.IndexNumber || 1}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}, (prevProps, nextProps) => {
  // Only re-render if the item ID or size changes
  return prevProps.item.Id === nextProps.item.Id && prevProps.size === nextProps.size;
});

// MediaRow component - defined outside Home
const MediaRow = memo(({ title, items, icon, browseLink, onItemClick, onBrowseClick }: { 
  title: string; 
  items: EmbyItem[]; 
  icon?: React.ReactNode; 
  browseLink?: string;
  onItemClick: (item: EmbyItem) => void;
  onBrowseClick?: (link: string) => void;
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScrollButtons = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScrollButtons();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollButtons);
      return () => container.removeEventListener('scroll', checkScrollButtons);
    }
  }, [items]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = scrollContainerRef.current.clientWidth * 0.8;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="mb-16">
      <div className="flex items-center gap-4 mb-6">
        {icon && <div className="text-blue-500">{icon}</div>}
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        <div className="flex-1 h-px bg-gradient-to-r from-gray-800 to-transparent ml-6" />
        {browseLink && onBrowseClick && (
          <button
            onClick={() => onBrowseClick(browseLink)}
            tabIndex={0}
            className="focusable-item flex items-center gap-3 px-6 py-3.5 text-base font-medium text-gray-200 hover:text-white bg-white/5 hover:bg-white/15 rounded-2xl transition-all border border-white/10 hover:border-white/20"
          >
            See All
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
      <div className="relative -mx-8 group/row">
        {/* Left scroll button - mouse only, not focusable */}
        <button
          onMouseDown={(e) => { e.preventDefault(); scroll('left'); }}
          className={`absolute left-4 top-1/2 -translate-y-1/2 z-30 w-14 h-14 rounded-full bg-black/90 hover:bg-black hover:scale-110 text-white flex items-center justify-center shadow-xl transition-opacity duration-200 opacity-0 group-hover/row:opacity-100 active:opacity-100 ${!canScrollLeft ? 'invisible' : ''}`}
          aria-label="Scroll left"
          tabIndex={-1}
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        {/* Right scroll button - mouse only, not focusable */}
        <button
          onMouseDown={(e) => { e.preventDefault(); scroll('right'); }}
          className={`absolute right-4 top-1/2 -translate-y-1/2 z-30 w-14 h-14 rounded-full bg-black/90 hover:bg-black hover:scale-110 text-white flex items-center justify-center shadow-xl transition-opacity duration-200 opacity-0 group-hover/row:opacity-100 active:opacity-100 ${!canScrollRight ? 'invisible' : ''}`}
          aria-label="Scroll right"
          tabIndex={-1}
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        
        {/* Fade edge on the left */}
        <div className={`absolute left-0 top-0 bottom-6 w-16 bg-gradient-to-r from-gray-950 to-transparent pointer-events-none z-10 transition-opacity duration-200 ${canScrollLeft ? 'opacity-100' : 'opacity-0'}`} />
        {/* Fade edge on the right */}
        <div className={`absolute right-0 top-0 bottom-6 w-16 bg-gradient-to-l from-gray-950 to-transparent pointer-events-none z-10 transition-opacity duration-200 ${canScrollRight ? 'opacity-100' : 'opacity-0'}`} />

        <div 
          ref={scrollContainerRef}
          className="flex gap-5 pb-6 px-8" 
          style={{ 
            scrollbarWidth: 'none', 
            msOverflowStyle: 'none',
            overflowX: 'auto',
            overflowY: 'hidden',
            WebkitOverflowScrolling: 'touch'
          }}
          role="list"
          aria-label={title}
        >
          {items.map((item) => (
            <MediaCard key={item.Id} item={item} onItemClick={onItemClick} />
          ))}
          {/* Spacer to ensure last item isn't cut off */}
          <div className="flex-shrink-0 w-1" />
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if items array reference changes or other props change
  return prevProps.items === nextProps.items && 
         prevProps.title === nextProps.title &&
         prevProps.browseLink === nextProps.browseLink;
});

export function Home() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  useTVNavigation();
  const [latestMovies, setLatestMovies] = useState<EmbyItem[]>([]);
  const [latestEpisodes, setLatestEpisodes] = useState<EmbyItem[]>([]);
  const [resumeMovies, setResumeMovies] = useState<EmbyItem[]>([]);
  const [resumeSeries, setResumeSeries] = useState<EmbyItem[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true); // Track if this is first load
  const [showContent, setShowContent] = useState(false); // Track content fade in
  const [featuredItems, setFeaturedItems] = useState<EmbyItem[]>([]);
  const [featuredItem, setFeaturedItem] = useState<EmbyItem | null>(null);
  const [isImageFading, setIsImageFading] = useState(false);
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [showFeatured] = useState(() => {
    const saved = localStorage.getItem('emby_showFeatured');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [featuredGenre] = useState<string>(() => {
    return localStorage.getItem('emby_featuredGenre') || '';
  });
  const [featuredYear] = useState<string>(() => {
    return localStorage.getItem('emby_featuredYear') || '';
  });
  const [featuredMediaType] = useState<{ movies: boolean; tvShows: boolean }>(() => {
    const saved = localStorage.getItem('emby_featuredMediaType');
    return saved ? JSON.parse(saved) : { movies: true, tvShows: true };
  });

  // Load cached data from sessionStorage immediately on mount
  useEffect(() => {
    const cachedMovies = sessionStorage.getItem('home_latestMovies');
    const cachedEpisodes = sessionStorage.getItem('home_latestEpisodes');
    
    let hasCache = false;
    
    if (cachedMovies) {
      try {
        setLatestMovies(JSON.parse(cachedMovies));
        hasCache = true;
      } catch (e) {
        console.error('Failed to parse cached movies:', e);
      }
    }
    
    if (cachedEpisodes) {
      try {
        setLatestEpisodes(JSON.parse(cachedEpisodes));
        hasCache = true;
      } catch (e) {
        console.error('Failed to parse cached episodes:', e);
      }
    }
    
    // If we have cached data, hide loading immediately
    if (hasCache) {
      setIsInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Rotate featured items every 10 seconds
    if (featuredItems.length <= 1) return;

    const interval = setInterval(() => {
      // Store current scroll position
      const scrollY = window.scrollY;
      const activeElement = document.activeElement;
      
      setIsImageFading(true);
      
      setTimeout(() => {
        setFeaturedItem((prev) => {
          if (!prev) return featuredItems[0];
          const currentIndex = featuredItems.findIndex(item => item.Id === prev.Id);
          const nextIndex = (currentIndex + 1) % featuredItems.length;
          return featuredItems[nextIndex];
        });
        setIsImageFading(false);
        
        // Restore scroll position and focus after state update
        requestAnimationFrame(() => {
          window.scrollTo(0, scrollY);
          if (activeElement && activeElement !== document.body && 'focus' in activeElement) {
            (activeElement as HTMLElement).focus();
          }
        });
      }, 500);
    }, 10000);

    return () => clearInterval(interval);
  }, [featuredItems]);

  const loadData = async () => {
    try {
      // Keep loading screen visible until all essential data loads
      setIsInitialLoad(true);
      
      // Fetch all data in parallel
      const [movies, episodes, resumeMovies, resumeEpisodes, recentlyPlayedEpisodes] = await Promise.all([
        // Latest movies by production year
        embyApi.getItems({ 
          recursive: true, 
          includeItemTypes: 'Movie', 
          limit: 50, 
          sortBy: 'ProductionYear,PremiereDate', 
          sortOrder: 'Descending' 
        }),
        // Latest episodes by premiere/release date
        embyApi.getItems({ 
          recursive: true, 
          includeItemTypes: 'Episode', 
          limit: 50, 
          sortBy: 'PremiereDate', 
          sortOrder: 'Descending' 
        }),
        // Resumable movies (partially watched) - sorted by DatePlayed
        embyApi.getItems({ 
          recursive: true, 
          includeItemTypes: 'Movie', 
          filters: 'IsResumable', 
          limit: 50, 
          sortBy: 'DatePlayed', 
          sortOrder: 'Descending',
          fields: 'Genres,Overview,CommunityRating,OfficialRating,RunTimeTicks,ProductionYear,PremiereDate,UserData'
        }),
        // Resumable episodes (partially watched)
        embyApi.getItems({ 
          recursive: true, 
          includeItemTypes: 'Episode', 
          filters: 'IsResumable', 
          limit: 50, 
          sortBy: 'DatePlayed', 
          sortOrder: 'Descending',
          fields: 'Genres,Overview,CommunityRating,OfficialRating,RunTimeTicks,ProductionYear,PremiereDate,UserData,SeriesId,SeriesName,SeriesPrimaryImageTag,ParentIndexNumber,IndexNumber'
        }),
        // Recently PLAYED episodes (completed) - these have LastPlayedDate
        embyApi.getItems({ 
          recursive: true, 
          includeItemTypes: 'Episode', 
          filters: 'IsPlayed', 
          limit: 100, 
          sortBy: 'DatePlayed', 
          sortOrder: 'Descending',
          fields: 'Genres,Overview,CommunityRating,OfficialRating,RunTimeTicks,ProductionYear,PremiereDate,UserData,SeriesId,SeriesName,SeriesPrimaryImageTag,ParentIndexNumber,IndexNumber'
        }),
      ]);

      // Deduplicate movies that exist in multiple libraries
      const deduplicatedMovies = deduplicateItems(movies.Items);
      setLatestMovies(deduplicatedMovies);
      setLatestEpisodes(episodes.Items);
      
      // Cache movies and episodes in sessionStorage for instant loading on return
      sessionStorage.setItem('home_latestMovies', JSON.stringify(deduplicatedMovies));
      sessionStorage.setItem('home_latestEpisodes', JSON.stringify(episodes.Items));
      
      // Build a map of series ID -> most recent LastPlayedDate from recently played episodes
      const seriesLastPlayedMap = new Map<string, string>();
      recentlyPlayedEpisodes.Items.forEach((episode) => {
        if (episode.SeriesId && episode.UserData?.LastPlayedDate) {
          // Only set if not already set (first one is most recent due to sorting)
          if (!seriesLastPlayedMap.has(episode.SeriesId)) {
            seriesLastPlayedMap.set(episode.SeriesId, episode.UserData.LastPlayedDate);
          }
        }
      });
      
      // Also check resumable episodes for LastPlayedDate (partially watched)
      resumeEpisodes.Items.forEach((episode) => {
        if (episode.SeriesId && episode.UserData?.LastPlayedDate) {
          const existing = seriesLastPlayedMap.get(episode.SeriesId);
          // Use more recent date
          if (!existing || episode.UserData.LastPlayedDate > existing) {
            seriesLastPlayedMap.set(episode.SeriesId, episode.UserData.LastPlayedDate);
          }
        }
      });
      
      // Collect unique series IDs from resumable episodes and recently played
      const seriesIds = new Set<string>();
      resumeEpisodes.Items.forEach((ep) => {
        if (ep.SeriesId) seriesIds.add(ep.SeriesId);
      });
      recentlyPlayedEpisodes.Items.forEach((ep) => {
        if (ep.SeriesId) seriesIds.add(ep.SeriesId);
      });
      
      // Helper to compare episode order
      const isAfter = (epA: EmbyItem, epB: EmbyItem) => {
        const seasonA = epA.ParentIndexNumber || 0;
        const seasonB = epB.ParentIndexNumber || 0;
        if (seasonA !== seasonB) return seasonA > seasonB;
        return (epA.IndexNumber || 0) > (epB.IndexNumber || 0);
      };
      
      // Fetch all episodes for each series and apply the same logic as MediaDetails
      const seriesEpisodesPromises = Array.from(seriesIds).map(async (seriesId): Promise<EmbyItem | null> => {
        try {
          const allEpisodesRes = await embyApi.getItems({
            parentId: seriesId,
            recursive: true,
            includeItemTypes: 'Episode',
            sortBy: 'ParentIndexNumber,IndexNumber',
            sortOrder: 'Ascending',
          });
          
          const allEpisodes = allEpisodesRes.Items;
          if (allEpisodes.length === 0) return null;
          
          // Sort episodes by season and episode number
          const sortedEpisodes = [...allEpisodes].sort((a, b) => {
            const seasonA = a.ParentIndexNumber || 0;
            const seasonB = b.ParentIndexNumber || 0;
            if (seasonA !== seasonB) return seasonA - seasonB;
            return (a.IndexNumber || 0) - (b.IndexNumber || 0);
          });
          
          // Find in-progress episodes (have progress but not completed)
          const inProgressEpisodes = sortedEpisodes.filter(
            ep => ep.UserData?.PlaybackPositionTicks && ep.UserData.PlaybackPositionTicks > 0 && !ep.UserData?.Played
          );
          
          let latestInProgress: EmbyItem | null = null;
          if (inProgressEpisodes.length > 0) {
            latestInProgress = inProgressEpisodes.reduce((latest, ep) => 
              isAfter(ep, latest) ? ep : latest
            , inProgressEpisodes[0]);
          }
          
          // Find last completed episode
          const completedEpisodes = sortedEpisodes.filter(ep => ep.UserData?.Played);
          let lastCompleted: EmbyItem | null = null;
          if (completedEpisodes.length > 0) {
            lastCompleted = completedEpisodes.reduce((latest, ep) => 
              isAfter(ep, latest) ? ep : latest
            , completedEpisodes[0]);
          }
          
          let nextUpEpisode: EmbyItem | null = null;
          
          // Apply same logic as MediaDetails
          if (latestInProgress) {
            // Check if there's a completed episode AFTER the in-progress one
            if (lastCompleted && isAfter(lastCompleted, latestInProgress)) {
              // Find first unwatched after last completed
              nextUpEpisode = sortedEpisodes.find(ep => 
                !ep.UserData?.Played && isAfter(ep, lastCompleted!)
              ) || null;
            } else {
              nextUpEpisode = latestInProgress;
            }
          } else if (lastCompleted) {
            // No in-progress, find first unwatched after last completed
            nextUpEpisode = sortedEpisodes.find(ep => 
              !ep.UserData?.Played && isAfter(ep, lastCompleted!)
            ) || null;
          }
          
          if (nextUpEpisode) {
            // Get series last played date for sorting
            const seriesLastPlayed = seriesLastPlayedMap.get(seriesId);
            
            // Attach series last played date for sorting
            return {
              ...nextUpEpisode,
              UserData: {
                ...(nextUpEpisode.UserData || {}),
                LastPlayedDate: seriesLastPlayed || nextUpEpisode.UserData?.LastPlayedDate,
              } as EmbyItem['UserData'],
            };
          }
          
          return null;
        } catch (err) {
          console.error('Failed to fetch episodes for series:', seriesId, err);
          return null;
        }
      });
      
      const seriesNextUpResults = await Promise.all(seriesEpisodesPromises);
      const processedEpisodes: EmbyItem[] = seriesNextUpResults.filter((ep): ep is EmbyItem => ep !== null);
      
      // Movies are already sorted by DatePlayed from API, deduplicate them
      // Set separate states for movies and series
      setResumeMovies(deduplicateItems(resumeMovies.Items));
      setResumeSeries(processedEpisodes);
      
      // Load featured items in parallel, don't wait for it
      loadFeaturedItems();
      
      // Mark initial load as complete immediately after essential content is ready
      setIsInitialLoad(false);
    } catch (error) {
      console.error('Failed to load home data:', error);
      setIsInitialLoad(false);
    }
  };

  const loadFeaturedItems = async () => {
    try {
      const params: any = {
        recursive: true,
        limit: 8,
        sortBy: 'Random',
        sortOrder: 'Ascending',
      };

      // Apply media type filters
      const includeTypes: string[] = [];
      if (featuredMediaType.movies) includeTypes.push('Movie');
      if (featuredMediaType.tvShows) includeTypes.push('Series');
      if (includeTypes.length > 0) {
        params.includeItemTypes = includeTypes.join(',');
      }

      // Apply genre filter
      if (featuredGenre) {
        params.genres = featuredGenre;
      }

      // Apply year filter
      if (featuredYear) {
        params.years = featuredYear;
      }

      const response = await embyApi.getItems(params);
      
      if (response.Items.length > 0) {
        const featuredCount = Math.min(6, response.Items.length);
        const selectedItems = response.Items.slice(0, featuredCount);
        setFeaturedItems(selectedItems);
        setFeaturedItem(selectedItems[0]);
        
        // Cache featured items in sessionStorage
        sessionStorage.setItem('home_featuredItems', JSON.stringify(selectedItems));
      }
    } catch (error) {
      console.error('Failed to load featured items:', error);
    }
  };

  const handleItemClick = useCallback((item: EmbyItem) => {
    // For episodes, go to the parent series details page
    if (item.Type === 'Episode' && item.SeriesId) {
      navigate(`/details/${item.SeriesId}`);
    } else {
      // For movies/series, go to their details page
      navigate(`/details/${item.Id}`);
    }
  }, [navigate]);

  const handleBrowseClick = useCallback((link: string) => {
    navigate(link);
  }, [navigate]);

  // Show loading screen only on initial load without cache
  if (isInitialLoad) {
    return <LoadingScreen isVisible={true} />;
  }

  // Trigger content fade in after initial load completes
  if (!showContent) {
    setTimeout(() => setShowContent(true), 50);
  }

  const heroBackdropUrl = featuredItem?.BackdropImageTags?.[0]
    ? embyApi.getImageUrl(featuredItem.Id, 'Backdrop', { maxWidth: 1280, tag: featuredItem.BackdropImageTags[0] })
    : featuredItem?.ImageTags?.Primary
    ? embyApi.getImageUrl(featuredItem.Id, 'Primary', { maxWidth: 1280, tag: featuredItem.ImageTags.Primary })
    : '';

  return (
    <div className={`min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 transition-opacity duration-500 ${showContent ? 'opacity-100' : 'opacity-0'}`}>
      {/* Fixed Background from Featured Item */}
      {showFeatured && featuredItem && heroBackdropUrl && (
        <div className="fixed inset-0 z-0">
          <img
            src={heroBackdropUrl}
            alt=""
            className={`w-full h-full object-cover transition-opacity duration-500 ${
              isImageFading ? 'opacity-0' : 'opacity-100'
            }`}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/90 to-gray-950/60" />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-gray-900/30" />
        </div>
      )}

      {/* Header */}
      <header className="relative z-20 bg-gradient-to-b from-black/80 to-transparent">
        <div className="max-w-[1600px] mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/Logo.png" alt="Aether" className="h-20 object-contain rounded-xl" />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/browse')}
              tabIndex={0}
              className="px-5 py-2.5 text-base text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200 flex items-center gap-2 focusable-item"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search
            </button>
            <button
              onClick={() => navigate('/stats')}
              tabIndex={0}
              className="px-5 py-2.5 text-base text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200 flex items-center gap-2 focusable-item"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Stats
            </button>
            <button
              onClick={() => navigate('/settings')}
              tabIndex={0}
              className="px-5 py-2.5 text-base text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200 flex items-center gap-2 focusable-item"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </button>
            <button
              onClick={() => setShowDonateModal(true)}
              tabIndex={0}
              className="px-5 py-2.5 text-base text-pink-300 hover:text-pink-200 hover:bg-pink-500/20 rounded-lg transition-all duration-200 flex items-center gap-2 focusable-item"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
              Donate
            </button>
            <button
              onClick={logout}
              tabIndex={0}
              className="px-5 py-2.5 text-base text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200 flex items-center gap-2 focusable-item"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      {showFeatured && featuredItem && (
        <div className="relative h-[80vh] min-h-[560px] overflow-hidden z-10 tv-hero home-hero">
          {/* Hero Content */}
          <div className="relative h-full max-w-[1600px] mx-auto px-8 flex items-center">
            <div className="max-w-3xl pt-20">
              <div className="flex items-center gap-4 mb-5">
                <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs font-semibold rounded-full border border-blue-500/30">
                  Featured
                </span>
                {featuredItem.OfficialRating && (
                  <span className="px-2 py-1 bg-white/10 text-gray-300 text-xs font-medium rounded border border-white/20">
                    {featuredItem.OfficialRating}
                  </span>
                )}
                {featuredItem.ProductionYear && (
                  <span className="text-gray-400 text-sm">{featuredItem.ProductionYear}</span>
                )}
              </div>
              
              <h2 className="text-6xl font-bold text-white mb-5 leading-tight tv-hero-title">{featuredItem.Name}</h2>
              
              {featuredItem.Overview && (
                <p className="text-gray-200 text-xl leading-relaxed mb-8 line-clamp-3 tv-hero-overview">{featuredItem.Overview}</p>
              )}
              
              <div className="flex items-center gap-5">
                <button
                  onClick={() => navigate(`/player/${featuredItem.Id}`)}
                  tabIndex={0}
                  className="px-10 py-4 bg-white text-black text-lg font-semibold rounded-xl hover:bg-gray-200 transition-all duration-200 flex items-center gap-3 shadow-2xl shadow-white/10 primary-action focusable-item"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                  Play Now
                </button>
                <button 
                  onClick={() => navigate(`/details/${featuredItem.Id}`)}
                  tabIndex={0}
                  className="px-8 py-3.5 bg-white/10 text-white text-lg font-medium rounded-xl hover:bg-white/20 transition-all duration-200 backdrop-blur-sm border border-white/10 focusable-item"
                >
                  More Info
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className={`max-w-[1600px] mx-auto px-8 home-main ${showFeatured && featuredItem ? '-mt-28 relative z-10' : 'pt-28'}`}>
        {/* Content Rows */}
        <MediaRow
          title="Continue Watching Movies"
          items={resumeMovies}
          onItemClick={handleItemClick}
          onBrowseClick={handleBrowseClick}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <MediaRow
          title="Continue Watching TV"
          items={resumeSeries}
          onItemClick={handleItemClick}
          onBrowseClick={handleBrowseClick}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <MediaRow
          title="Latest Movies"
          items={latestMovies}
          browseLink="/browse?type=Movie"
          onItemClick={handleItemClick}
          onBrowseClick={handleBrowseClick}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
          }
        />
        <MediaRow
          title="Latest Episodes"
          items={latestEpisodes}
          browseLink="/browse?type=Series"
          onItemClick={handleItemClick}
          onBrowseClick={handleBrowseClick}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
        />
      </main>

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

      {/* Donate Modal */}
      {showDonateModal && (() => {
        const isTV = /Android/i.test(navigator.userAgent);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
            <div className="bg-gray-900/95 backdrop-blur-md rounded-2xl max-w-md w-full overflow-hidden border border-white/10 shadow-2xl">
              {/* Header */}
              <div className="p-6 text-center border-b border-white/10">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <svg className="w-6 h-6 text-pink-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                  <h2 className="text-2xl font-bold text-white">Support Aether</h2>
                </div>
                <p className="text-gray-400 text-sm">
                  {isTV ? 'Scan the QR code with your phone' : 'Your support helps keep this project alive!'}
                </p>
              </div>

              {/* Content */}
              <div className="p-8 flex flex-col items-center">
                {isTV ? (
                  <>
                    <div className="bg-white p-4 rounded-xl">
                      <img 
                        src="/qr-code.png" 
                        alt="Donate QR Code" 
                        className="w-48 h-48 object-contain"
                      />
                    </div>
                    <p className="text-gray-500 text-sm mt-4">ko-fi.com/danielvnz</p>
                  </>
                ) : (
                  <button 
                    onClick={() => window.open('https://ko-fi.com/danielvnz', '_blank', 'noopener,noreferrer,width=700,height=800')}
                    className="px-8 py-4 bg-pink-500 hover:bg-pink-600 text-white font-semibold rounded-xl transition-all duration-200 flex items-center gap-3 shadow-lg shadow-pink-500/25"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                    Support on Ko-fi
                  </button>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-white/10">
                <button
                  onClick={() => setShowDonateModal(false)}
                  autoFocus
                  tabIndex={0}
                  className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all duration-200 font-medium focusable-item"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
