import { useState, useEffect, useRef, memo, useCallback, useMemo, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { embyApi } from '../services/embyApi';
import { tmdbApi } from '../services/tmdbApi';
import { deduplicateItems } from '../services/deduplication';
import { useAuth } from '../hooks/useAuth';
import { useTVNavigation } from '../hooks/useTVNavigation';
import type { EmbyItem } from '../types/emby.types';

// Helper to format date as "1 Jan 2026"
const formatReleaseDate = (dateString?: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const day = date.getDate();
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
};

// MediaCard component - defined outside Home to prevent recreation on re-renders
const MediaCard = memo(({ item, size = 'normal', onItemClick, onToggleFavorite, isFavChanging, favoriteIds }: { item: EmbyItem; size?: 'normal' | 'large'; onItemClick: (item: EmbyItem) => void; onToggleFavorite?: (item: EmbyItem) => void; isFavChanging?: boolean; favoriteIds?: Set<string> }) => {
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const canFavorite = ((item.Type === 'Movie' || item.Type === 'Series') || (item.Type === 'Episode' && !!item.SeriesId)) && !!onToggleFavorite;
  const favoriteKey = item.Type === 'Episode' && item.SeriesId ? item.SeriesId : item.Id;
  const isFavorite = !!item.UserData?.IsFavorite || (favoriteIds ? favoriteIds.has(favoriteKey) : false);
  const favoriteTarget: EmbyItem = item.Type === 'Episode' && item.SeriesId ? {
    Id: item.SeriesId,
    Name: item.SeriesName || item.Name,
    Type: 'Series',
    ImageTags: item.SeriesPrimaryImageTag ? { Primary: item.SeriesPrimaryImageTag } : item.ImageTags,
    UserData: { ...(item.UserData || {}), IsFavorite: isFavorite },
  } as EmbyItem : item;
  
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
    <div
      onClick={() => onItemClick(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onItemClick(item);
        }
      }}
      tabIndex={0}
      role="button"
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

        {/* Favorite star (Movies & Series) */}
        {canFavorite && (
          <div className="absolute top-2 right-2 flex items-center gap-2 z-30">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite && onToggleFavorite(favoriteTarget); }}
              onPointerDown={(e) => { e.stopPropagation(); }}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleFavorite && onToggleFavorite(favoriteTarget); } }}
              tabIndex={0}
              data-tv-bottom-only
              aria-label={isFavorite ? `Unfavorite ${favoriteTarget.Name}` : `Favorite ${favoriteTarget.Name}`}
              title={isFavorite ? 'Unfavorite' : 'Favorite'}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors transition-transform duration-150 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-1 focusable-item ${isFavorite ? 'bg-yellow-400 text-white' : 'bg-white/6 text-gray-300 hover:bg-yellow-400 hover:text-white cursor-pointer'}`}
            >
              {isFavChanging ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>
              ) : isFavorite ? (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
              )}
            </button>
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
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5 flex-wrap">
          {/* Episode details: S1E1 · 1 Jan 2026 */}
          {item.Type === 'Episode' && (
            <span className="text-blue-400 font-medium text-xs">
              S{item.ParentIndexNumber || 1}E{item.IndexNumber || 1}
              {item.PremiereDate && ` · ${formatReleaseDate(item.PremiereDate)}`}
            </span>
          )}
          {/* Series: X Seasons · last episode date */}
          {item.Type === 'Series' && (
            <span className="text-gray-400 text-xs">
              {item.ChildCount && `${item.ChildCount} Season${item.ChildCount !== 1 ? 's' : ''}`}
              {item.PremiereDate && ` · ${formatReleaseDate(item.PremiereDate)}`}
            </span>
          )}
          {/* Movies: just year and rating */}
          {item.Type === 'Movie' && (
            <>
              {item.ProductionYear && <span>{item.ProductionYear}</span>}
              {item.OfficialRating && (
                <span className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-gray-300 text-[11px] font-medium">
                  {item.OfficialRating}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.item.Id === nextProps.item.Id &&
    prevProps.size === nextProps.size &&
    !!prevProps.item.UserData?.IsFavorite === !!nextProps.item.UserData?.IsFavorite &&
    !!prevProps.isFavChanging === !!nextProps.isFavChanging &&
    prevProps.favoriteIds === nextProps.favoriteIds;
});

// MediaRow component - defined outside Home
const MediaRow = memo(({ title, items, icon, browseLink, subtitle, onItemClick, onBrowseClick, onToggleFavorite, favChanging, favoriteIds, onRemove }: { 
  title: string; 
  items: EmbyItem[]; 
  icon?: React.ReactNode; 
  browseLink?: string;
  subtitle?: string;
  onItemClick: (item: EmbyItem) => void;
  onBrowseClick?: (link: string) => void;
  onToggleFavorite?: (item: EmbyItem) => void;
  favChanging?: Record<string, boolean>;
  favoriteIds?: Set<string>;
  onRemove?: () => void;
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
        {subtitle && <span className="text-xs text-gray-500 ml-1">{subtitle}</span>}
        <div className="flex-1 h-px bg-gradient-to-r from-gray-800 to-transparent ml-6" />
        {onRemove && (
          <button
            onClick={onRemove}
            tabIndex={0}
            className="focusable-item flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-300 hover:text-white bg-white/5 hover:bg-white/15 rounded-xl transition-all border border-white/10 hover:border-white/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Remove
          </button>
        )}
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
          {items.map((item, index) => (
            <MediaCard 
              key={`${item.Id}-${index}`} 
              item={item} 
              onItemClick={onItemClick} 
              onToggleFavorite={onToggleFavorite}
              isFavChanging={!!favChanging?.[item.Type === 'Episode' && item.SeriesId ? item.SeriesId : item.Id]}
              favoriteIds={favoriteIds}
            />
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
         prevProps.browseLink === nextProps.browseLink &&
         prevProps.subtitle === nextProps.subtitle &&
         prevProps.favChanging === nextProps.favChanging &&
         prevProps.favoriteIds === nextProps.favoriteIds &&
         prevProps.onRemove === nextProps.onRemove;
});

export function Home() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  useTVNavigation();
  const defaultHomeSectionOrder = [
    'continue_movies',
    'continue_tv',
    'favorites',
    'trending_movies',
    'popular_tv',
    'latest_movies',
    'latest_episodes',
  ];
  const [latestMovies, setLatestMovies] = useState<EmbyItem[]>([]);
  const [latestEpisodes, setLatestEpisodes] = useState<EmbyItem[]>([]);
  const [resumeMovies, setResumeMovies] = useState<EmbyItem[]>([]);
  const [resumeSeries, setResumeSeries] = useState<EmbyItem[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<EmbyItem[]>([]);
  const [favChanging, setFavChanging] = useState<Record<string, boolean>>({});
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
  const [popularMovies, setPopularMovies] = useState<EmbyItem[]>([]);
  const [popularTVShows, setPopularTVShows] = useState<EmbyItem[]>([]);
  const [customSections, setCustomSections] = useState<{ id: string; name: string; filters: any; searchTerm: string; mediaType: string; }[]>([]);
  const [customSectionItems, setCustomSectionItems] = useState<Record<string, EmbyItem[]>>({});
  const normalizeFavoritesOrder = (items: EmbyItem[]) => items.slice().reverse();
  const favoriteIds = useMemo(() => new Set(favoriteItems.map(it => it.Id)), [favoriteItems]);

  const HOME_SECTIONS_KEY = 'home_customSections';
  const DEFAULT_FILTERS = {
    sortBy: 'PremiereDate',
    sortOrder: 'Descending',
    genres: [] as string[],
    years: [] as (number | 'Before 1980')[],
    seasonCounts: [] as (number | '10+')[]
  };

  const updateFavoriteFlag = (list: EmbyItem[], itemId: string, nextFav: boolean) => list.map(it => {
    if (it.Id !== itemId) return it;
    const prevUD = it.UserData || { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false };
    return { ...it, UserData: { ...prevUD, IsFavorite: nextFav } };
  });

  // Load cached data from sessionStorage immediately on mount
  useEffect(() => {
    const cachedMovies = sessionStorage.getItem('home_latestMovies');
    const cachedEpisodes = sessionStorage.getItem('home_latestEpisodes');
    const cachedPopularMovies = sessionStorage.getItem('popular_movies_all');
    const cachedPopularTV = sessionStorage.getItem('popular_tv_all');
    const cachedFavorites = sessionStorage.getItem('home_favorites');

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

    if (cachedFavorites) {
      try {
        const parsed = JSON.parse(cachedFavorites) as EmbyItem[];
        setFavoriteItems(normalizeFavoritesOrder(parsed));
        hasCache = true;
      } catch (e) {
        console.error('Failed to parse cached favorites:', e);
      }
    }

    // Only use cached TMDB-popular rows if an API key is configured; otherwise clear any stale cache
    if (tmdbApi.isConfigured()) {
      if (cachedPopularMovies) {
        try {
          const all = JSON.parse(cachedPopularMovies) as EmbyItem[];
          setPopularMovies(all.slice(0, 15));
          hasCache = true;
        } catch (e) {
          console.error('Failed to parse cached popular movies:', e);
        }
      }
      if (cachedPopularTV) {
        try {
          const all = JSON.parse(cachedPopularTV) as EmbyItem[];
          setPopularTVShows(all.slice(0, 15));
          hasCache = true;
        } catch (e) {
          console.error('Failed to parse cached popular TV:', e);
        }
      }
    } else {
      // No API key: ensure popular sections are cleared and cache removed
      setPopularMovies([]);
      setPopularTVShows([]);
      sessionStorage.removeItem('popular_movies_all');
      sessionStorage.removeItem('popular_tv_all');
      localStorage.setItem('emby_hasPopularMovies', 'false');
      localStorage.setItem('emby_hasPopularTV', 'false');
    }

    // If we have cached data, hide loading immediately
    if (hasCache) {
      setIsInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const loadCustomSections = useCallback(async () => {
    let sections: { id: string; name: string; filters: any; searchTerm: string; mediaType: string; }[] = [];
    try {
      const raw = localStorage.getItem(HOME_SECTIONS_KEY);
      sections = raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Failed to load home custom sections:', e);
    }
    setCustomSections(sections);
    if (sections.length === 0) {
      setCustomSectionItems({});
      return;
    }

    // Warm cache for instant render
    try {
      const cached = sessionStorage.getItem('home_customSectionItems');
      if (cached) {
        const parsed = JSON.parse(cached) as Record<string, EmbyItem[]>;
        setCustomSectionItems(parsed || {});
      }
    } catch (e) {
      // ignore cache errors
    }

    const orderRaw = localStorage.getItem('emby_homeSectionOrder');
    const orderList = orderRaw ? (JSON.parse(orderRaw) as string[]) : [];
    const enabledIds = new Set([...orderList, ...sections.map(s => s.id)]);
    const enabledSections = sections.filter(s => enabledIds.has(s.id));

    const results = await Promise.all(enabledSections.map(async (section) => {
        const f = { ...DEFAULT_FILTERS, ...(section.filters || {}) };
        const isSeries = section.mediaType === 'Series';
        const selectedYears = (f.years || []).filter((y: unknown): y is number => typeof y === 'number');
        const includeBefore1980 = (f.years || []).some((y: unknown) => y === 'Before 1980');
        const hasSeasonFilter = isSeries && Array.isArray(f.seasonCounts) && f.seasonCounts.length > 0;
        const needsClientYearFilter = includeBefore1980;

        const baseParams: any = {
          recursive: true,
          includeItemTypes: section.mediaType,
          sortBy: f.sortBy,
          sortOrder: f.sortOrder,
          fields: isSeries
            ? 'Genres,Overview,CommunityRating,OfficialRating,RunTimeTicks,ProductionYear,PremiereDate,Studios,ChildCount,SeasonCount,ProviderIds,Path,MediaSources,UserData'
            : 'Genres,Overview,CommunityRating,OfficialRating,RunTimeTicks,ProductionYear,PremiereDate,Studios,ProviderIds,Path,MediaSources,UserData',
        };
        if (f.genres && f.genres.length > 0) baseParams.genres = f.genres.join(',');
        if (!needsClientYearFilter && selectedYears.length > 0) baseParams.years = selectedYears.join(',');
        if ((section.searchTerm || '').trim().length > 0) baseParams.searchTerm = section.searchTerm.trim();

        const maxItems = 50;
        if (hasSeasonFilter || needsClientYearFilter) {
          const matches: EmbyItem[] = [];
          const pageSize = 500;
          const maxScan = 5000;
          let startIndex = 0;
          while (startIndex < maxScan && matches.length < maxItems) {
            const res = await embyApi.getItems({ ...baseParams, limit: pageSize, startIndex });
            const batch = res.Items || [];
            if (batch.length === 0) break;
            for (const it of batch) {
              let yearOk = true;
              if (needsClientYearFilter || selectedYears.length > 0) {
                let y: number | null = null;
                if (typeof (it as any).ProductionYear === 'number') y = (it as any).ProductionYear;
                else if (it.PremiereDate) {
                  const d = new Date(it.PremiereDate);
                  if (!isNaN(d.getTime())) y = d.getFullYear();
                }
                if (y == null) yearOk = false;
                else {
                  const inSelected = selectedYears.length > 0 ? selectedYears.includes(y) : false;
                  if (needsClientYearFilter) yearOk = y < 1980 || inSelected;
                  else yearOk = inSelected;
                }
              }
              if (!yearOk) continue;

              if (hasSeasonFilter) {
                const seasonCount = (it as any).SeasonCount ?? (it as any).ChildCount;
                const seasonNum = typeof seasonCount === 'number' ? seasonCount : Number(seasonCount);
                if (seasonNum === undefined || seasonNum === null || Number.isNaN(seasonNum)) continue;
                const seasonOk = (f.seasonCounts || []).some((sel: any) =>
                  typeof sel === 'number' ? seasonNum === sel : sel === '10+' ? seasonNum >= 10 : false
                );
                if (!seasonOk) continue;
              }

              matches.push(it);
              if (matches.length >= maxItems) break;
            }
            startIndex += pageSize;
          }
          return [section.id, matches] as const;
        }

        const res = await embyApi.getItems({ ...baseParams, limit: maxItems });
        return [section.id, res.Items || []] as const;
      }));

    const itemsById = Object.fromEntries(results);
    setCustomSectionItems(itemsById);
    try {
      sessionStorage.setItem('home_customSectionItems', JSON.stringify(itemsById));
    } catch (e) {
      // ignore cache errors
    }
  }, []);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === HOME_SECTIONS_KEY) {
        loadCustomSections();
      }
    };
    const handleFocus = () => loadCustomSections();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadCustomSections();
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadCustomSections]);

  useEffect(() => {
    const t = setTimeout(() => loadCustomSections(), 0);
    return () => clearTimeout(t);
  }, [loadCustomSections]);

  const removeCustomSection = (id: string) => {
    setCustomSections(prev => {
      const updated = prev.filter(s => s.id !== id);
      try {
        localStorage.setItem(HOME_SECTIONS_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to persist home custom sections:', e);
      }
      return updated;
    });
    setCustomSectionItems(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  useEffect(() => {
    // Rotate featured items every 10 seconds
    if (featuredItems.length <= 1) return;

    const interval = setInterval(() => {
      setIsImageFading(true);
      
      setTimeout(() => {
        setFeaturedItem((prev) => {
          if (!prev) return featuredItems[0];
          const currentIndex = featuredItems.findIndex(item => item.Id === prev.Id);
          const nextIndex = (currentIndex + 1) % featuredItems.length;
          return featuredItems[nextIndex];
        });
        setIsImageFading(false);
      }, 500);
    }, 10000);

    return () => clearInterval(interval);
  }, [featuredItems]);

  const loadData = async () => {
    try {
      // Keep loading screen visible until all essential data loads
      setIsInitialLoad(true);
      
      // Fetch all data in parallel
      const [movies, episodes, resumeMovies, resumeEpisodes, recentlyPlayedEpisodes, favorites] = await Promise.all([
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
        // Favorites (movies, series, episodes)
        embyApi.getItems({
          recursive: true,
          includeItemTypes: 'Movie,Series,Episode',
          filters: 'IsFavorite',
          limit: 50,
          sortBy: 'DateCreated',
          sortOrder: 'Descending',
          fields: 'Genres,Overview,CommunityRating,OfficialRating,RunTimeTicks,ProductionYear,PremiereDate,UserData,SeriesId,SeriesName,SeriesPrimaryImageTag,ParentIndexNumber,IndexNumber,ChildCount,ProviderIds'
        }),
      ]);

      // Deduplicate movies that exist in multiple libraries
      const deduplicatedMovies = deduplicateItems(movies.Items);
      setLatestMovies(deduplicatedMovies);
      
      // Deduplicate episodes by ID (same episode can appear from different library sources)
      const seenEpisodeIds = new Set<string>();
      const uniqueEpisodes = episodes.Items.filter(ep => {
        if (seenEpisodeIds.has(ep.Id)) return false;
        seenEpisodeIds.add(ep.Id);
        return true;
      });
      setLatestEpisodes(uniqueEpisodes);

      // Cache movies and episodes in sessionStorage for instant loading on return
      sessionStorage.setItem('home_latestMovies', JSON.stringify(deduplicatedMovies));
      sessionStorage.setItem('home_latestEpisodes', JSON.stringify(uniqueEpisodes));

      const favoritesItems = favorites.Items || [];
      const orderedFavorites = normalizeFavoritesOrder(favoritesItems);
      setFavoriteItems(orderedFavorites);
      sessionStorage.setItem('home_favorites', JSON.stringify(orderedFavorites));
      localStorage.setItem('emby_hasFavorites', favoritesItems.length > 0 ? 'true' : 'false');
      
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
      
      // Deduplicate processedEpisodes by ID
      const seenSeriesEpIds = new Set<string>();
      const uniqueProcessedEpisodes = processedEpisodes.filter(ep => {
        if (seenSeriesEpIds.has(ep.Id)) return false;
        seenSeriesEpIds.add(ep.Id);
        return true;
      });
      
      // Movies are already sorted by DatePlayed from API, deduplicate them
      // Set separate states for movies and series
      setResumeMovies(deduplicateItems(resumeMovies.Items));
      setResumeSeries(uniqueProcessedEpisodes);
      
      // Load featured items in parallel, don't wait for it
      loadFeaturedItems();
      
      // Load TMDB popular content if API key is configured
      loadPopularContent();
      
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

  const loadPopularContent = async () => {
    // Check if TMDB API is configured
    if (!tmdbApi.isConfigured()) {
      // Ensure stale data is cleared when key is missing
      setPopularMovies([]);
      setPopularTVShows([]);
      sessionStorage.removeItem('popular_movies_all');
      sessionStorage.removeItem('popular_tv_all');
      return;
    }

    try {
      // Fetch trending movies + popular TV shows from TMDB (5 pages = 100 items each) + library items in parallel
      const [tmdbMovies, tmdbShows, libraryMovies, librarySeries] = await Promise.all([
        tmdbApi.getTrendingMoviesMultiPage(5),
        tmdbApi.getPopularTVShowsMultiPage(5),
        embyApi.getItems({
          recursive: true,
          includeItemTypes: 'Movie',
          fields: 'ProviderIds,ProductionYear,PremiereDate,OfficialRating,CommunityRating,ChildCount',
        }),
        embyApi.getItems({
          recursive: true,
          includeItemTypes: 'Series',
          fields: 'ProviderIds,ProductionYear,PremiereDate,OfficialRating,CommunityRating,ChildCount',
        }),
      ]);

      // Helper to extract TMDB id from various possible ProviderIds keys
      const extractTmdbId = (providerIds?: Record<string, string>): string | null => {
        if (!providerIds) return null;
        for (const [k, v] of Object.entries(providerIds)) {
          const key = k.toLowerCase();
          // Check for any variation of tmdb key
          if (key.includes('tmdb') || key === 'themoviedb') {
            if (v != null && v !== '') return String(v);
          }
        }
        return null;
      };

      // Create lookup maps by TMDB ID for fast matching (case-insensitive provider keys)
      const moviesByTmdbId = new Map<string, typeof libraryMovies.Items[0]>();
      for (const movie of libraryMovies.Items) {
        const id = extractTmdbId(movie.ProviderIds as any);
        if (id) moviesByTmdbId.set(String(id), movie);
      }

      const seriesByTmdbId = new Map<string, typeof librarySeries.Items[0]>();
      for (const series of librarySeries.Items) {
        const id = extractTmdbId(series.ProviderIds as any);
        if (id) seriesByTmdbId.set(String(id), series);
      }

      // Match TMDB items with library items, preserving TMDB popularity order
      const orderedMovies: EmbyItem[] = [];
      for (const tmdbMovie of tmdbMovies) {
        const match = moviesByTmdbId.get(String(tmdbMovie.id));
        if (match && !orderedMovies.some(x => x.Id === match.Id)) {
          orderedMovies.push(match as EmbyItem);
        }
      }

      const orderedShows: EmbyItem[] = [];
      for (const tmdbShow of tmdbShows) {
        const match = seriesByTmdbId.get(String(tmdbShow.id));
        if (match && !orderedShows.some(x => x.Id === match.Id)) {
          orderedShows.push(match as EmbyItem);
        }
      }

      // Store all matches in sessionStorage for the "See All" pages
      sessionStorage.setItem('popular_movies_all', JSON.stringify(orderedMovies));
      sessionStorage.setItem('popular_tv_all', JSON.stringify(orderedShows));

      // Only show first 15 on home page
      setPopularMovies(orderedMovies.slice(0, 15));
      setPopularTVShows(orderedShows.slice(0, 15));
      localStorage.setItem('emby_hasPopularMovies', orderedMovies.length > 0 ? 'true' : 'false');
      localStorage.setItem('emby_hasPopularTV', orderedShows.length > 0 ? 'true' : 'false');
    } catch (error) {
      console.error('Failed to load popular content from TMDB:', error);
    }
  };

  const applyFavoriteUpdate = (itemId: string, nextFav: boolean, baseItem: EmbyItem) => {
    setLatestMovies(prev => updateFavoriteFlag(prev, itemId, nextFav));
    setLatestEpisodes(prev => updateFavoriteFlag(prev, itemId, nextFav));
    setResumeMovies(prev => updateFavoriteFlag(prev, itemId, nextFav));
    setResumeSeries(prev => updateFavoriteFlag(prev, itemId, nextFav));
    setPopularMovies(prev => updateFavoriteFlag(prev, itemId, nextFav));
    setPopularTVShows(prev => updateFavoriteFlag(prev, itemId, nextFav));
    setFeaturedItems(prev => updateFavoriteFlag(prev, itemId, nextFav));
    setCustomSectionItems(prev => {
      const updated: Record<string, EmbyItem[]> = {};
      for (const [key, list] of Object.entries(prev)) {
        updated[key] = updateFavoriteFlag(list, itemId, nextFav);
      }
      return updated;
    });
    setFeaturedItem(prev => {
      if (!prev || prev.Id !== itemId) return prev;
      const prevUD = prev.UserData || { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false };
      return { ...prev, UserData: { ...prevUD, IsFavorite: nextFav } };
    });
    setFavoriteItems(prev => {
      let updated = prev;
      if (nextFav) {
        if (prev.some(it => it.Id === itemId)) {
          updated = updateFavoriteFlag(prev, itemId, true);
        } else {
          updated = [{ ...baseItem }, ...prev];
        }
      } else {
        updated = prev.filter(it => it.Id !== itemId);
      }
      sessionStorage.setItem('home_favorites', JSON.stringify(updated));
      localStorage.setItem('emby_hasFavorites', updated.length > 0 ? 'true' : 'false');
      return updated;
    });
  };

  const toggleFavorite = async (item: EmbyItem) => {
    if (!item || !item.Id) return;
    const isFav = !!item.UserData?.IsFavorite;
    const nextFav = !isFav;
    const prevUD = item.UserData || { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false };
    const optimisticItem = { ...item, UserData: { ...prevUD, IsFavorite: nextFav } };

    applyFavoriteUpdate(item.Id, nextFav, optimisticItem);
    setFavChanging(prev => ({ ...prev, [item.Id]: true }));

    try {
      if (nextFav) {
        await embyApi.markFavorite(item.Id);
      } else {
        await embyApi.unmarkFavorite(item.Id);
      }
    } catch (e) {
      console.error('Failed to toggle favorite:', e);
      const rollbackItem = { ...item, UserData: { ...prevUD, IsFavorite: isFav } };
      applyFavoriteUpdate(item.Id, isFav, rollbackItem);
      alert('Failed to update favorite.');
    } finally {
      setFavChanging(prev => {
        const copy = { ...prev };
        delete copy[item.Id];
        return copy;
      });
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

  // Trigger content fade in after initial load completes
  if (!showContent) {
    setTimeout(() => setShowContent(true), 50);
  }

  const heroBackdropUrl = featuredItem?.BackdropImageTags?.[0]
    ? embyApi.getImageUrl(featuredItem.Id, 'Backdrop', { maxWidth: 1280, tag: featuredItem.BackdropImageTags[0] })
    : featuredItem?.ImageTags?.Primary
    ? embyApi.getImageUrl(featuredItem.Id, 'Primary', { maxWidth: 1280, tag: featuredItem.ImageTags.Primary })
    : '';

  const savedHomeSectionOrder = (() => {
    const saved = localStorage.getItem('emby_homeSectionOrder');
    const allIds = [...defaultHomeSectionOrder, ...customSections.map(s => s.id)];
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const known = new Set(allIds);
          const normalized = parsed.filter((id: unknown) => typeof id === 'string' && known.has(id));
          const missing = allIds.filter(id => !normalized.includes(id));
          return [...normalized, ...missing];
        }
      } catch (error) {
        console.error('Failed to parse home section order:', error);
      }
    }
    return allIds;
  })();

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
      {showFeatured && isInitialLoad && (
        <div className="relative h-[80vh] sm:h-[70vh] md:h-[80vh] min-h-[400px] sm:min-h-[450px] md:min-h-[560px] overflow-hidden z-10 tv-hero home-hero">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/90 to-gray-950/60" />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-gray-900/30" />
          <div className="relative h-full max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 flex items-center">
            <div className="max-w-3xl pt-16 sm:pt-20">
              <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-5">
                <div className="h-6 w-20 bg-white/10 rounded-full animate-pulse" />
                <div className="h-6 w-14 bg-white/10 rounded animate-pulse" />
                <div className="h-6 w-12 bg-white/10 rounded animate-pulse" />
              </div>
              <div className="h-10 sm:h-12 md:h-14 w-3/4 bg-white/10 rounded animate-pulse mb-4 sm:mb-6" />
              <div className="space-y-2 mb-6 sm:mb-8">
                <div className="h-4 sm:h-5 w-full bg-white/10 rounded animate-pulse" />
                <div className="h-4 sm:h-5 w-11/12 bg-white/10 rounded animate-pulse" />
                <div className="h-4 sm:h-5 w-9/12 bg-white/10 rounded animate-pulse" />
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-5">
                <div className="h-12 sm:h-14 w-40 bg-white/10 rounded-xl animate-pulse" />
                <div className="h-12 sm:h-14 w-32 bg-white/10 rounded-xl animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      )}
      {showFeatured && !isInitialLoad && featuredItem && (
        <div className="relative h-[80vh] sm:h-[70vh] md:h-[80vh] min-h-[400px] sm:min-h-[450px] md:min-h-[560px] overflow-hidden z-10 tv-hero home-hero">
          {/* Hero Content */}
          <div className="relative h-full max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 flex items-center">
            <div className="max-w-3xl pt-16 sm:pt-20">
              <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-5">
                <span className="px-2 sm:px-3 py-1 bg-blue-500/20 text-blue-400 text-xs font-semibold rounded-full border border-blue-500/30">
                  Featured
                </span>
                {featuredItem.OfficialRating && (
                  <span className="px-1.5 sm:px-2 py-1 bg-white/10 text-gray-300 text-xs font-medium rounded border border-white/20">
                    {featuredItem.OfficialRating}
                  </span>
                )}
                {featuredItem.ProductionYear && (
                  <span className="text-gray-400 text-xs sm:text-sm">{featuredItem.ProductionYear}</span>
                )}
              </div>
              
              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-3 sm:mb-5 leading-tight tv-hero-title">{featuredItem.Name}</h2>
              
              {featuredItem.Overview && (
                <p className="text-gray-200 text-sm sm:text-lg md:text-xl leading-relaxed mb-4 sm:mb-6 md:mb-8 line-clamp-2 sm:line-clamp-3 tv-hero-overview">{featuredItem.Overview}</p>
              )}
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-5">
                <button
                  onClick={() => navigate(`/player/${featuredItem.Id}`)}
                  tabIndex={0}
                  className="px-6 sm:px-8 md:px-10 py-3 sm:py-3.5 md:py-4 bg-white text-black text-sm sm:text-base md:text-lg font-semibold rounded-xl hover:bg-gray-200 transition-all duration-200 flex items-center gap-2 sm:gap-3 shadow-2xl shadow-white/10 primary-action focusable-item"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                  Play Now
                </button>
                <button 
                  onClick={() => navigate(`/details/${featuredItem.Id}`)}
                  tabIndex={0}
                  className="px-5 sm:px-6 md:px-8 py-2.5 sm:py-3 md:py-3.5 bg-white/10 text-white text-sm sm:text-base md:text-lg font-medium rounded-xl hover:bg-white/20 transition-all duration-200 backdrop-blur-sm border border-white/10 focusable-item"
                >
                  More Info
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className={`max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 home-main ${showFeatured && featuredItem ? '-mt-8 sm:-mt-16 md:-mt-28 relative z-10' : 'pt-16 sm:pt-20 md:pt-28'}`}>
        {isInitialLoad ? (
          <div className="space-y-16">
            {Array.from({ length: 4 }).map((_, rowIndex) => (
              <div key={`skeleton-row-${rowIndex}`}>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-5 h-5 rounded bg-white/10 animate-pulse" />
                  <div className="h-6 w-48 bg-white/10 rounded animate-pulse" />
                  <div className="flex-1 h-px bg-gradient-to-r from-gray-800 to-transparent ml-6" />
                  <div className="h-10 w-24 rounded-2xl bg-white/10 animate-pulse" />
                </div>
                <div className="flex gap-5 pb-6">
                  {Array.from({ length: 8 }).map((__, cardIndex) => (
                    <div key={`skeleton-card-${rowIndex}-${cardIndex}`} className="flex-shrink-0 w-40 lg:w-36 xl:w-32 2xl:w-36">
                      <div className="relative aspect-[2/3] bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl overflow-hidden mb-4 shadow-xl shadow-black/40 ring-1 ring-white/5">
                        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-gray-700 to-gray-800" />
                      </div>
                      <div className="h-3 w-3/4 bg-white/10 rounded animate-pulse mb-2" />
                      <div className="h-3 w-1/2 bg-white/10 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
        /* Content Rows */
        (() => {
          type Section = { id: string; element: ReactElement | null };
          const sections: Section[] = [
            {
              id: 'continue_movies',
              element: (
                <MediaRow
                  title="Continue Watching Movies"
                  items={resumeMovies}
                  onItemClick={handleItemClick}
                  onBrowseClick={handleBrowseClick}
                  onToggleFavorite={toggleFavorite}
                  favChanging={favChanging}
                  favoriteIds={favoriteIds}
                  icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                />
              )
            },
            {
              id: 'continue_tv',
              element: (
                <MediaRow
                  title="Continue Watching TV"
                  items={resumeSeries}
                  onItemClick={handleItemClick}
                  onBrowseClick={handleBrowseClick}
                  onToggleFavorite={toggleFavorite}
                  favChanging={favChanging}
                  favoriteIds={favoriteIds}
                  icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                />
              )
            },
            {
              id: 'favorites',
              element: favoriteItems.length > 0 ? (
                <MediaRow
                  title="Favorites"
                  items={favoriteItems}
                  onItemClick={handleItemClick}
                  onBrowseClick={handleBrowseClick}
                  onToggleFavorite={toggleFavorite}
                  favChanging={favChanging}
                  favoriteIds={favoriteIds}
                  icon={
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                  }
                />
              ) : null
            },
            {
              id: 'trending_movies',
              element: popularMovies.length > 0 ? (
                <MediaRow
                  title="Trending Movies"
                  items={popularMovies}
                  browseLink="/popular/movies"
                  subtitle="Powered by TMDB"
                  onItemClick={handleItemClick}
                  onBrowseClick={handleBrowseClick}
                  onToggleFavorite={toggleFavorite}
                  favChanging={favChanging}
                  favoriteIds={favoriteIds}
                  icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  }
                />
              ) : null
            },
            {
              id: 'popular_tv',
              element: popularTVShows.length > 0 ? (
                <MediaRow
                  title="Popular TV Shows"
                  items={popularTVShows}
                  browseLink="/popular/tv"
                  subtitle="Powered by TMDB"
                  onItemClick={handleItemClick}
                  onBrowseClick={handleBrowseClick}
                  onToggleFavorite={toggleFavorite}
                  favChanging={favChanging}
                  favoriteIds={favoriteIds}
                  icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  }
                />
              ) : null
            },
            {
              id: 'latest_movies',
              element: (
                <MediaRow
                  title="Latest Movies"
                  items={latestMovies}
                  browseLink="/browse?type=Movie"
                  onItemClick={handleItemClick}
                  onBrowseClick={handleBrowseClick}
                  onToggleFavorite={toggleFavorite}
                  favChanging={favChanging}
                  favoriteIds={favoriteIds}
                  icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                    </svg>
                  }
                />
              )
            },
            {
              id: 'latest_episodes',
              element: (
                <MediaRow
                  title="Latest Episodes"
                  items={latestEpisodes}
                  browseLink="/browse?type=Series"
                  onItemClick={handleItemClick}
                  onBrowseClick={handleBrowseClick}
                  onToggleFavorite={toggleFavorite}
                  favChanging={favChanging}
                  favoriteIds={favoriteIds}
                  icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  }
                />
              )
            },
            ...customSections.map(section => ({
              id: section.id,
              element: (
                <MediaRow
                  title={section.name}
                  items={customSectionItems[section.id] || []}
                  onItemClick={handleItemClick}
                  onBrowseClick={handleBrowseClick}
                  onToggleFavorite={toggleFavorite}
                  favChanging={favChanging}
                  favoriteIds={favoriteIds}
                  subtitle="Custom filter"
                  onRemove={() => removeCustomSection(section.id)}
                  icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L15 12.414V19a1 1 0 01-1.447.894l-4-2A1 1 0 019 17.999v-5.585L3.293 6.707A1 1 0 013 6V4z" />
                    </svg>
                  }
                />
              )
            })),
          ];

          const sectionsById = new Map(sections.map(section => [section.id, section]));
          const ordered = savedHomeSectionOrder
            .map(id => sectionsById.get(id))
            .filter((section): section is Section => section !== undefined);
          const missing = sections.filter(section => !savedHomeSectionOrder.includes(section.id));

          return [...ordered, ...missing]
            .filter(section => section.element !== null && section.element !== undefined)
            .map(section => (
              <div key={section.id}>{section.element}</div>
            ));
        })()
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 mt-8 py-8 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-gray-500 text-sm">
            © Aether 2026
          </p>
          <p className="text-gray-600 text-xs mt-2 max-w-md mx-auto">
            Dates shown for TV Series reflect the show's original release date. Popular/Trending lists show the premiere date from your library metadata.
          </p>
        </div>
      </footer>

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
