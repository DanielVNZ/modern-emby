import React, { useState, useEffect, useRef, memo, useCallback, useMemo, type ReactElement } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { embyApi } from '../services/embyApi';
import { tmdbApi } from '../services/tmdbApi';
import { deduplicateItems } from '../services/deduplication';
import type { EmbyItem } from '../types/emby.types';
import { Header } from './Header';
import { Footer } from './Footer';

// MediaCard component - Modern Netflix-style card for PC
const MediaCard = memo(({ item, size = 'normal', onItemClick, onToggleFavorite, isFavChanging, favoriteIds }: { item: EmbyItem; size?: 'normal' | 'large'; onItemClick: (item: EmbyItem) => void; onToggleFavorite?: (item: EmbyItem) => void; isFavChanging?: boolean; favoriteIds?: Set<string> }) => {
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const canShowFavorite = (item.Type === 'Movie' || item.Type === 'Series') || (item.Type === 'Episode' && !!item.SeriesId);
  const canFavorite = canShowFavorite && !!onToggleFavorite;
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
    imageUrl = embyApi.getImageUrl(item.SeriesId, 'Primary', {
      maxWidth: size === 'large' ? 400 : 300,
      tag: item.SeriesPrimaryImageTag
    });
  } else if (item.ImageTags?.Primary) {
    imageUrl = embyApi.getImageUrl(item.Id, 'Primary', {
      maxWidth: size === 'large' ? 400 : 300,
      tag: item.ImageTags.Primary
    });
  }

  // Modern responsive card widths optimized for PC
  const cardWidth = size === 'large' ? 'w-56' : 'w-48';

  return (
    <div
      onClick={() => onItemClick(item)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`flex-shrink-0 ${cardWidth} cursor-pointer group/card text-left transition-all duration-300`}
    >
      <div className={`relative aspect-[2/3] bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg mb-3 shadow-2xl transition-all duration-300 ${
        isHovered ? 'scale-105 shadow-black/80 ring-2 ring-white/20' : 'shadow-black/40'
      }`}>
        <div className="absolute inset-0 overflow-hidden rounded-lg">
        {imageUrl ? (
          <>
            {/* Loading placeholder */}
            {!isImageLoaded && (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-gray-700 to-gray-800" />
            )}
            <img
              src={imageUrl}
              alt={item.Name}
              loading="lazy"
              onLoad={() => setIsImageLoaded(true)}
              className={`w-full h-full object-cover transition-all duration-700 ease-out ${
                isImageLoaded ? 'opacity-100' : 'opacity-0'
              } ${isHovered ? 'scale-110' : 'scale-100'}`}
            />
            
            {/* Gradient overlay on hover */}
            <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity duration-300 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`} />
            
            {/* Hover info overlay */}
            {isHovered && (
              <div className="absolute inset-0 flex flex-col justify-end p-4 text-white">
                <div className="transform translate-y-0 transition-transform duration-300">
                  <h4 className="font-bold text-sm mb-1 line-clamp-2">
                    {item.Type === 'Episode' ? item.SeriesName || item.Name : item.Name}
                  </h4>
                  {item.Type === 'Episode' && (
                    <p className="text-xs text-blue-300 mb-2">
                      S{item.ParentIndexNumber || 1}E{item.IndexNumber || 1}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs">
                    {item.ProductionYear && <span className="text-gray-300">{item.ProductionYear}</span>}
                    {item.OfficialRating && (
                      <span className="px-2 py-0.5 bg-white/20 rounded text-xs">
                        {item.OfficialRating}
                      </span>
                    )}
                    {item.CommunityRating && (
                      <span className="flex items-center gap-1 text-yellow-400">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        {item.CommunityRating.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
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
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/60">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
              style={{
                width: `${(item.UserData.PlaybackPositionTicks / item.RunTimeTicks) * 100}%`,
              }}
            />
          </div>
        )}
        </div>

        {/* Favorite button - outside overflow-hidden but inside relative wrapper */}
        {canShowFavorite && (
          <button
            onClick={(e) => { e.stopPropagation(); canFavorite && onToggleFavorite && onToggleFavorite(favoriteTarget); }}
            onPointerDown={(e) => { e.stopPropagation(); }}
            disabled={isFavChanging || !canFavorite}
            style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', left: 'auto' }}
            aria-label={isFavorite ? `Unfavorite ${favoriteTarget.Name}` : `Favorite ${favoriteTarget.Name}`}
            title={isFavorite ? 'Unfavorite' : 'Favorite'}
            className={`z-50 p-2 rounded-full backdrop-blur-sm transition-all duration-200 flex items-center justify-center ${
              isFavChanging || !canFavorite ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'
            } ${isFavorite ? 'bg-pink-500 text-white' : 'bg-black/70 text-white hover:bg-pink-500/80'}`}
          >
            {isFavChanging ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isFavorite ? 0 : 2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            )}
          </button>
        )}
      </div>
      
      {/* Title - always visible */}
      <div className="px-1">
        <h3 className={`text-white font-medium text-sm line-clamp-1 transition-colors duration-200 ${
          isHovered ? 'text-white' : 'text-gray-300'
        }`}>
          {item.Type === 'Episode' ? item.SeriesName || item.Name : item.Name}
        </h3>
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

// MediaRow component - Modern Netflix-style horizontal scroll
const MediaRow = memo(({ title, items, icon, browseLink, subtitle, onItemClick, onBrowseClick, onToggleFavorite, favChanging, favoriteIds, onRemove, enableDragReorder, onReorder, editMode, isHidden, onToggleVisibility, onMoveUp, onMoveDown, canMoveUp, canMoveDown }: { 
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
  enableDragReorder?: boolean;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  editMode?: boolean;
  isHidden?: boolean;
  onToggleVisibility?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const checkScrollButtons = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScrollButtons();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollButtons);
      const resizeObserver = new ResizeObserver(checkScrollButtons);
      resizeObserver.observe(container);
      return () => {
        container.removeEventListener('scroll', checkScrollButtons);
        resizeObserver.disconnect();
      };
    }
  }, [items]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = scrollContainerRef.current.clientWidth * 0.85;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (items.length === 0 && !editMode) return null;

  return (
    <div className={`mb-12 group/row ${editMode && isHidden ? 'opacity-80' : ''}`}>
      {/* Row Header */}
      <div className="flex items-center justify-between mb-5 px-2">
        <div className="flex items-center gap-3">
          {icon && <div className="text-blue-500">{icon}</div>}
          <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
          {subtitle && <span className="text-sm text-gray-500 font-medium">{subtitle}</span>}
          {editMode && isHidden && (
            <span className="text-[11px] font-semibold uppercase tracking-wide text-yellow-300/80 bg-yellow-500/10 border border-yellow-500/20 rounded-full px-2 py-0.5">
              Hidden
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {editMode && onMoveUp && onMoveDown && (
            <>
              <button
                onClick={onMoveUp}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  !canMoveUp ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-800/50 text-blue-300 hover:bg-gray-700 hover:scale-110'
                }`}
                disabled={!canMoveUp}
                aria-label={`Move ${title} up`}
                title="Move up"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                onClick={onMoveDown}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  !canMoveDown ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-800/50 text-blue-300 hover:bg-gray-700 hover:scale-110'
                }`}
                disabled={!canMoveDown}
                aria-label={`Move ${title} down`}
                title="Move down"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </>
          )}
          {editMode && (
            <button
              type="button"
              onClick={onToggleVisibility}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isHidden ? 'bg-white/20' : 'bg-blue-500'
              }`}
              aria-pressed={!isHidden}
              aria-label={`${isHidden ? 'Show' : 'Hide'} ${title}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  isHidden ? 'translate-x-1' : 'translate-x-5'
                }`}
              />
            </button>
          )}
          {onRemove && editMode && (
            <button
              onClick={onRemove}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all duration-200"
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
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white/80 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all duration-200"
            >
              Explore All
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Row */}
      <div className="relative">
        {/* Left scroll button */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-0 bottom-0 z-20 w-16 bg-gradient-to-r from-black/80 to-transparent flex items-center justify-start pl-2 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 hover:from-black/90"
            aria-label="Scroll left"
          >
            <div className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center backdrop-blur-sm">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
          </button>
        )}
        
        {/* Right scroll button */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-0 bottom-0 z-20 w-16 bg-gradient-to-l from-black/80 to-transparent flex items-center justify-end pr-2 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 hover:from-black/90"
            aria-label="Scroll right"
          >
            <div className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center backdrop-blur-sm">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        )}

        {items.length === 0 ? (
          <div className="px-2 py-6 text-sm text-gray-500">
            No items to show yet.
          </div>
        ) : (
          <div 
            ref={scrollContainerRef}
            className="flex gap-3 overflow-x-auto scrollbar-hide px-2 py-2" 
            role="list"
            aria-label={title}
          >
            {items.map((item, index) => {
              const isDraggable = !!enableDragReorder;
              const showPlaceholder = isDraggable && dragIndex !== null && dragOverIndex === index && dragIndex !== index;
              return (
                <div
                  key={`${item.Id}-${index}`}
                  className="flex"
                  onDragOver={(e) => {
                    if (!isDraggable) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setDragOverIndex(index);
                  }}
                  onDrop={(e) => {
                    if (!isDraggable) return;
                    e.preventDefault();
                    const fromRaw = dragIndex ?? Number(e.dataTransfer.getData('text/plain'));
                    if (Number.isNaN(fromRaw) || fromRaw === index) {
                      setDragIndex(null);
                      setDragOverIndex(null);
                      return;
                    }
                    onReorder?.(fromRaw, index);
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                >
                  {showPlaceholder && (
                    <div className="flex-shrink-0 w-48 pointer-events-none">
                      <div className="relative aspect-[2/3] rounded-lg border-2 border-dashed border-blue-500/70 bg-blue-500/10 mb-3" />
                    </div>
                  )}
                  <div
                    draggable={isDraggable}
                    onDragStart={(e) => {
                      if (!isDraggable) return;
                      setDragIndex(index);
                      setDragOverIndex(index);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', String(index));
                    }}
                    onDragEnter={() => {
                      if (!isDraggable) return;
                      setDragOverIndex(index);
                    }}
                    onDragOver={(e) => {
                      if (!isDraggable) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      setDragOverIndex(index);
                    }}
                    onDrop={(e) => {
                      if (!isDraggable) return;
                      e.preventDefault();
                      const fromRaw = dragIndex ?? Number(e.dataTransfer.getData('text/plain'));
                      if (Number.isNaN(fromRaw) || fromRaw === index) {
                        setDragIndex(null);
                        setDragOverIndex(null);
                        return;
                      }
                      onReorder?.(fromRaw, index);
                      setDragIndex(null);
                      setDragOverIndex(null);
                    }}
                    onDragEnd={() => {
                      setDragIndex(null);
                      setDragOverIndex(null);
                    }}
                    className={isDraggable ? 'cursor-grab active:cursor-grabbing' : ''}
                  >
                    <MediaCard 
                      item={item} 
                      onItemClick={onItemClick} 
                      onToggleFavorite={onToggleFavorite}
                      isFavChanging={!!favChanging?.[item.Type === 'Episode' && item.SeriesId ? item.SeriesId : item.Id]}
                      favoriteIds={favoriteIds}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.items === nextProps.items && 
         prevProps.title === nextProps.title &&
         prevProps.browseLink === nextProps.browseLink &&
         prevProps.subtitle === nextProps.subtitle &&
         prevProps.favChanging === nextProps.favChanging &&
         prevProps.favoriteIds === nextProps.favoriteIds &&
         prevProps.onRemove === nextProps.onRemove &&
         prevProps.editMode === nextProps.editMode &&
         prevProps.isHidden === nextProps.isHidden &&
         prevProps.canMoveUp === nextProps.canMoveUp &&
         prevProps.canMoveDown === nextProps.canMoveDown &&
         prevProps.onMoveUp === nextProps.onMoveUp &&
         prevProps.onMoveDown === nextProps.onMoveDown;
});

export function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const defaultHomeSectionOrder = [
    'continue_movies',
    'continue_tv',
    'favorites',
    'recommended_movies',
    'recommended_series',
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
  const [recommendedMovies, setRecommendedMovies] = useState<EmbyItem[]>([]);
  const [recommendedSeries, setRecommendedSeries] = useState<EmbyItem[]>([]);
  const [recommendationStatus, setRecommendationStatus] = useState<'loading' | 'no_stats' | 'no_genres' | 'no_results' | 'ready' | null>(null);
  const [latestStatus, setLatestStatus] = useState<'idle' | 'loading' | 'loaded'>('idle');
  const [popularStatus, setPopularStatus] = useState<'idle' | 'loading' | 'loaded'>('idle');
  const [isEditMode, setIsEditMode] = useState(false);
  const HOME_SECTION_VISIBILITY_KEY = 'emby_homeSectionVisibility';
  const [sectionVisibility, setSectionVisibility] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(HOME_SECTION_VISIBILITY_KEY);
      return raw ? JSON.parse(raw) as Record<string, boolean> : {};
    } catch (error) {
      console.error('Failed to parse home section visibility:', error);
      return {};
    }
  });
  const [favChanging, setFavChanging] = useState<Record<string, boolean>>({});
  const [isInitialLoad, setIsInitialLoad] = useState(true); // Track if this is first load
  const [showContent, setShowContent] = useState(false); // Track content fade in
  const [featuredItems, setFeaturedItems] = useState<EmbyItem[]>([]);
  const [featuredItem, setFeaturedItem] = useState<EmbyItem | null>(null);
  const [isImageFading, setIsImageFading] = useState(false);
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
  const [homeSectionOrder, setHomeSectionOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('emby_homeSectionOrder');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((id: unknown) => typeof id === 'string');
        }
      } catch (error) {
        console.error('Failed to parse home section order:', error);
      }
    }
    return [];
  });
  const normalizeFavoritesOrder = (items: EmbyItem[]) => items.slice().reverse();
  const favoriteIds = useMemo(() => new Set(favoriteItems.map(it => it.Id)), [favoriteItems]);
  const canDragFavorites = true; // Always enable for PC
  const latestMoviesRef = useRef<HTMLDivElement | null>(null);
  const latestEpisodesRef = useRef<HTMLDivElement | null>(null);
  const popularMoviesRef = useRef<HTMLDivElement | null>(null);
  const popularTvRef = useRef<HTMLDivElement | null>(null);
  const recommendedMoviesRef = useRef<HTMLDivElement | null>(null);
  const recommendedSeriesRef = useRef<HTMLDivElement | null>(null);
  const hasWarmCacheRef = useRef(false);

  const HOME_SECTIONS_KEY = 'home_customSections';
  const HOME_CACHE_REFRESH_KEY = 'home_cache_last_refresh';
  const HOME_CACHE_TTL_MS = 10 * 60 * 1000;
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

  const heroBackdropUrl = featuredItem?.BackdropImageTags?.[0]
    ? embyApi.getImageUrl(featuredItem.Id, 'Backdrop', { maxWidth: 1280, tag: featuredItem.BackdropImageTags[0] })
    : featuredItem?.ImageTags?.Primary
    ? embyApi.getImageUrl(featuredItem.Id, 'Primary', { maxWidth: 1280, tag: featuredItem.ImageTags.Primary })
    : '';

  // Sync sectionVisibility changes to localStorage
  useEffect(() => {
    localStorage.setItem(HOME_SECTION_VISIBILITY_KEY, JSON.stringify(sectionVisibility));
  }, [sectionVisibility, HOME_SECTION_VISIBILITY_KEY]);

  // Normalize sectionVisibility - ensure all section IDs have boolean values
  useEffect(() => {
    const allSectionIds = [...defaultHomeSectionOrder, ...customSections.map(s => s.id)];
    const normalizedVisibility = { ...sectionVisibility };
    let needsUpdate = false;

    // Set undefined values to true (visible by default)
    allSectionIds.forEach((id) => {
      if (typeof normalizedVisibility[id] !== 'boolean') {
        normalizedVisibility[id] = true;
        needsUpdate = true;
      }
    });

    // Remove stale section IDs
    Object.keys(normalizedVisibility).forEach((id) => {
      if (!allSectionIds.includes(id)) {
        delete normalizedVisibility[id];
        needsUpdate = true;
      }
    });

    if (needsUpdate) {
      setSectionVisibility(normalizedVisibility);
    }
  }, [customSections, sectionVisibility, defaultHomeSectionOrder]);

  // Load cached data from sessionStorage immediately on mount
  useEffect(() => {
    const now = Date.now();
    const lastRefreshRaw = localStorage.getItem(HOME_CACHE_REFRESH_KEY);
    const lastRefresh = lastRefreshRaw ? Number(lastRefreshRaw) : Number.NaN;
    const isCacheStale = Number.isNaN(lastRefresh) ? false : now - lastRefresh > HOME_CACHE_TTL_MS;

    if (isCacheStale) {
      // Skip warm cache: next Home load performs a full refresh.
      hasWarmCacheRef.current = false;
      return;
    }

    const cachedResumeMovies = sessionStorage.getItem('home_resumeMovies');
    const cachedMovies = sessionStorage.getItem('home_latestMovies');
    const cachedEpisodes = sessionStorage.getItem('home_latestEpisodes');
    const cachedPopularMovies = sessionStorage.getItem('popular_movies_all');
    const cachedPopularTV = sessionStorage.getItem('popular_tv_all');
    const cachedFavorites = sessionStorage.getItem('home_favorites');
    const cachedResumeSeries = sessionStorage.getItem('home_resumeSeries');
    const cachedFeaturedItems = sessionStorage.getItem('home_featuredItems');
    const cachedRecommendedMovies = sessionStorage.getItem('home_recommendedMovies');
    const cachedRecommendedSeries = sessionStorage.getItem('home_recommendedSeries');
    const cachedRecommendationStatus = sessionStorage.getItem('home_recommendationStatus');

    let hasCache = false;

    if (cachedResumeMovies) {
      try {
        setResumeMovies(JSON.parse(cachedResumeMovies));
        hasCache = true;
      } catch (e) {
        console.error('Failed to parse cached resume movies:', e);
      }
    }

    if (cachedMovies) {
      try {
        setLatestMovies(JSON.parse(cachedMovies));
        setLatestStatus('loaded');
        hasCache = true;
      } catch (e) {
        console.error('Failed to parse cached movies:', e);
      }
    }

    if (cachedEpisodes) {
      try {
        setLatestEpisodes(JSON.parse(cachedEpisodes));
        setLatestStatus('loaded');
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

    if (cachedResumeSeries) {
      try {
        setResumeSeries(JSON.parse(cachedResumeSeries));
        hasCache = true;
      } catch (e) {
        console.error('Failed to parse cached resume series:', e);
      }
    }

    if (cachedFeaturedItems) {
      try {
        const parsed = JSON.parse(cachedFeaturedItems) as EmbyItem[];
        if (parsed.length > 0) {
          setFeaturedItems(parsed);
          setFeaturedItem(parsed[0]);
          hasCache = true;
        }
      } catch (e) {
        console.error('Failed to parse cached featured items:', e);
      }
    }

    if (cachedRecommendedMovies) {
      try {
        setRecommendedMovies(JSON.parse(cachedRecommendedMovies));
      } catch (e) {
        console.error('Failed to parse cached recommended movies:', e);
      }
    }

    if (cachedRecommendedSeries) {
      try {
        setRecommendedSeries(JSON.parse(cachedRecommendedSeries));
      } catch (e) {
        console.error('Failed to parse cached recommended series:', e);
      }
    }

    if (cachedRecommendationStatus) {
      try {
        setRecommendationStatus(JSON.parse(cachedRecommendationStatus));
      } catch (e) {
        console.error('Failed to parse cached recommendation status:', e);
      }
    }

    // Only use cached TMDB-popular rows if an API key is configured; otherwise clear any stale cache
    if (tmdbApi.isConfigured()) {
      if (cachedPopularMovies) {
        try {
          const all = JSON.parse(cachedPopularMovies) as EmbyItem[];
          setPopularMovies(all.slice(0, 15));
          setPopularStatus('loaded');
          hasCache = true;
        } catch (e) {
          console.error('Failed to parse cached popular movies:', e);
        }
      }
      if (cachedPopularTV) {
        try {
          const all = JSON.parse(cachedPopularTV) as EmbyItem[];
          setPopularTVShows(all.slice(0, 15));
          setPopularStatus('loaded');
          hasCache = true;
        } catch (e) {
          console.error('Failed to parse cached popular TV:', e);
        }
      }
    } else {
      // No API key: ensure popular sections are cleared and cache removed
      setPopularMovies([]);
      setPopularTVShows([]);
      setPopularStatus('loaded');
      sessionStorage.removeItem('popular_movies_all');
      sessionStorage.removeItem('popular_tv_all');
      localStorage.setItem('emby_hasPopularMovies', 'false');
      localStorage.setItem('emby_hasPopularTV', 'false');
    }

    // If we have cached data, hide loading immediately
    if (hasCache) {
      hasWarmCacheRef.current = true;
      setIsInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const loadRecommendations = useCallback(async () => {
    try {
      if (recommendationStatus === 'loading') return;
      if (recommendationStatus === 'ready' && (recommendedMovies.length > 0 || recommendedSeries.length > 0)) return;
      setRecommendationStatus('loading');
      const [playedMovies, playedEpisodes] = await Promise.all([
        embyApi.getItems({
          recursive: true,
          includeItemTypes: 'Movie',
          filters: 'IsPlayed',
          fields: 'Genres,UserData',
        }),
        embyApi.getItems({
          recursive: true,
          includeItemTypes: 'Episode',
          filters: 'IsPlayed',
          fields: 'Genres,UserData',
        }),
      ]);

      const totalPlayed = playedMovies.TotalRecordCount + playedEpisodes.TotalRecordCount;
      if (totalPlayed === 0) {
        setRecommendationStatus('no_stats');
        setRecommendedMovies([]);
        setRecommendedSeries([]);
        sessionStorage.setItem('home_recommendationStatus', JSON.stringify('no_stats'));
        return;
      }

      const genreCount: Record<string, number> = {};
      playedMovies.Items.forEach((movie) => {
        movie.Genres?.forEach((genre) => {
          genreCount[genre] = (genreCount[genre] || 0) + 1;
        });
      });
      playedEpisodes.Items.forEach((episode) => {
        episode.Genres?.forEach((genre) => {
          genreCount[genre] = (genreCount[genre] || 0) + 1;
        });
      });

      const topGenres = Object.entries(genreCount)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map((g) => g.name);

      if (topGenres.length === 0) {
        setRecommendationStatus('no_genres');
        setRecommendedMovies([]);
        setRecommendedSeries([]);
        sessionStorage.setItem('home_recommendationStatus', JSON.stringify('no_genres'));
        return;
      }

      setRecommendationStatus('ready');
      sessionStorage.setItem('home_recommendationStatus', JSON.stringify('ready'));

      const fetchRecommendations = async (genres?: string[]) => {
        const genreParam = genres && genres.length > 0 ? genres.join(',') : undefined;
        const [recMoviesRes, recSeriesRes] = await Promise.all([
          embyApi.getItems({
            recursive: true,
            includeItemTypes: 'Movie',
            ...(genreParam ? { genres: genreParam } : {}),
            limit: 80,
            sortBy: 'CommunityRating,PremiereDate',
            sortOrder: 'Descending',
            fields: 'Genres,Overview,CommunityRating,OfficialRating,RunTimeTicks,ProductionYear,PremiereDate,UserData,ProviderIds',
          }),
          embyApi.getItems({
            recursive: true,
            includeItemTypes: 'Series',
            ...(genreParam ? { genres: genreParam } : {}),
            limit: 80,
            sortBy: 'CommunityRating,PremiereDate',
            sortOrder: 'Descending',
            fields: 'Genres,Overview,CommunityRating,OfficialRating,RunTimeTicks,ProductionYear,PremiereDate,Studios,ChildCount,SeasonCount,ProviderIds,UserData',
          }),
        ]);

        const dedupedMovies = deduplicateItems(recMoviesRes.Items)
          .filter((item) => item.UserData?.Played !== true)
          .slice(0, 20);
        const dedupedSeries = deduplicateItems(recSeriesRes.Items)
          .filter((item) => item.UserData?.Played !== true)
          .slice(0, 20);

        return { dedupedMovies, dedupedSeries };
      };

      let recResult = await fetchRecommendations(topGenres);
      if (recResult.dedupedMovies.length === 0 && recResult.dedupedSeries.length === 0 && topGenres.length > 1) {
        recResult = await fetchRecommendations([topGenres[0]]);
      }
      if (recResult.dedupedMovies.length === 0 && recResult.dedupedSeries.length === 0) {
        recResult = await fetchRecommendations();
      }

      setRecommendedMovies(recResult.dedupedMovies);
      setRecommendedSeries(recResult.dedupedSeries);
      sessionStorage.setItem('home_recommendedMovies', JSON.stringify(recResult.dedupedMovies));
      sessionStorage.setItem('home_recommendedSeries', JSON.stringify(recResult.dedupedSeries));
      if (recResult.dedupedMovies.length === 0 && recResult.dedupedSeries.length === 0) {
        setRecommendationStatus('no_results');
        sessionStorage.setItem('home_recommendationStatus', JSON.stringify('no_results'));
      }
    } catch (error) {
      console.error('Failed to load recommendations:', error);
      setRecommendationStatus('no_stats');
    }
  }, [recommendationStatus, recommendedMovies.length, recommendedSeries.length]);

  const moveHomeSection = (sectionId: string, direction: 'up' | 'down') => {
    const allIds = [...defaultHomeSectionOrder, ...customSections.map(s => s.id)];
    
    // Get current order, ensuring all sections (including new custom ones) are included
    const currentSavedOrder = homeSectionOrder.length > 0 ? homeSectionOrder : [];
    const known = new Set(currentSavedOrder);
    const missing = allIds.filter(id => !known.has(id));
    const fullOrder = [...currentSavedOrder, ...missing];
    
    const index = fullOrder.indexOf(sectionId);
    if (index === -1) return;
    
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= fullOrder.length) return;
    
    const newOrder = [...fullOrder];
    [newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]];
    
    localStorage.setItem('emby_homeSectionOrder', JSON.stringify(newOrder));
    setHomeSectionOrder(newOrder);
  };

  const resetHomeSectionOrder = () => {
    const defaultOrder = [...defaultHomeSectionOrder, ...customSections.map(s => s.id)];
    localStorage.setItem('emby_homeSectionOrder', JSON.stringify(defaultOrder));
    setHomeSectionOrder(defaultOrder);
  };

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

  const loadLatestContent = useCallback(async () => {
    if (latestStatus !== 'idle') return;
    try {
      setLatestStatus('loading');
      const [movies, episodes] = await Promise.all([
        embyApi.getItems({ 
          recursive: true, 
          includeItemTypes: 'Movie', 
          limit: 50, 
          sortBy: 'ProductionYear,PremiereDate', 
          sortOrder: 'Descending' 
        }),
        embyApi.getItems({ 
          recursive: true, 
          includeItemTypes: 'Episode', 
          limit: 50, 
          sortBy: 'PremiereDate', 
          sortOrder: 'Descending' 
        }),
      ]);

      const deduplicatedMovies = deduplicateItems(movies.Items);
      setLatestMovies(deduplicatedMovies);

      const seenEpisodeIds = new Set<string>();
      const uniqueEpisodes = episodes.Items.filter(ep => {
        if (seenEpisodeIds.has(ep.Id)) return false;
        seenEpisodeIds.add(ep.Id);
        return true;
      });
      setLatestEpisodes(uniqueEpisodes);

      sessionStorage.setItem('home_latestMovies', JSON.stringify(deduplicatedMovies));
      sessionStorage.setItem('home_latestEpisodes', JSON.stringify(uniqueEpisodes));
      setLatestStatus('loaded');
    } catch (error) {
      console.error('Failed to load latest content:', error);
      setLatestStatus('loaded');
    }
  }, [latestStatus]);

  const loadPopularIfNeeded = useCallback(async () => {
    if (popularStatus !== 'idle') return;
    setPopularStatus('loading');
    await loadPopularContent();
    setPopularStatus('loaded');
  }, [popularStatus]);

  useEffect(() => {
    if (isInitialLoad) return;
    const targets: Array<{ ref: React.RefObject<HTMLDivElement | null>; onEnter: () => void }> = [
      { ref: latestMoviesRef, onEnter: loadLatestContent },
      { ref: latestEpisodesRef, onEnter: loadLatestContent },
      { ref: popularMoviesRef, onEnter: loadPopularIfNeeded },
      { ref: popularTvRef, onEnter: loadPopularIfNeeded },
      { ref: recommendedMoviesRef, onEnter: loadRecommendations },
      { ref: recommendedSeriesRef, onEnter: loadRecommendations },
    ];

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const match = targets.find((t) => t.ref.current === entry.target);
          if (match) {
            match.onEnter();
          }
        });
      },
      { root: null, rootMargin: '600px 0px', threshold: 0.01 }
    );

    targets.forEach(({ ref }) => {
      if (ref.current) observer.observe(ref.current);
    });

    return () => observer.disconnect();
  }, [isInitialLoad, loadLatestContent, loadPopularIfNeeded, loadRecommendations]);

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
      if (!hasWarmCacheRef.current) {
        setIsInitialLoad(true);
      }
      
      // Fetch essential data in parallel
      const [resumeMovies, resumeEpisodes, recentlyPlayedEpisodes, favorites] = await Promise.all([
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
      const dedupedResumeMovies = deduplicateItems(resumeMovies.Items);
      setResumeMovies(dedupedResumeMovies);
      setResumeSeries(uniqueProcessedEpisodes);
      try {
        sessionStorage.setItem('home_resumeMovies', JSON.stringify(dedupedResumeMovies));
        sessionStorage.setItem('home_resumeSeries', JSON.stringify(uniqueProcessedEpisodes));
        localStorage.setItem(HOME_CACHE_REFRESH_KEY, String(Date.now()));
      } catch (e) {
        // ignore cache errors
      }
      
      // Load featured items in parallel, don't wait for it
      loadFeaturedItems();
      
      // Defer popular content + recommendations until visible
      
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
  useEffect(() => {
    if (showContent) return;
    const t = setTimeout(() => setShowContent(true), 50);
    return () => clearTimeout(t);
  }, [showContent]);

  const savedHomeSectionOrder = useMemo(() => {
    const allIds = [...defaultHomeSectionOrder, ...customSections.map(s => s.id)];
    if (homeSectionOrder.length > 0) {
      const known = new Set(allIds);
      const normalized = homeSectionOrder.filter((id: string) => known.has(id));
      const missing = allIds.filter(id => !normalized.includes(id));
      return [...normalized, ...missing];
    }
    return allIds;
  }, [homeSectionOrder, customSections, defaultHomeSectionOrder]);

  return (
    <div className="min-h-screen bg-black">
      {/* Fixed Background from Featured Item */}
      {showFeatured && featuredItem && heroBackdropUrl && (
        <div className="fixed inset-0 z-0">
          <img
            src={heroBackdropUrl}
            alt=""
            className={`w-full h-full object-cover transition-opacity duration-700 ${
              isImageFading ? 'opacity-0' : 'opacity-30'
            }`}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/85 to-black" />
        </div>
      )}

      {/* Header */}
      <Header transparent={showContent} />

      {/* Hero Section - Modern Netflix Billboard */}
      {showFeatured && !isInitialLoad && featuredItem && (
        <div className="relative z-10 pt-24 pb-8 min-h-[50vh] flex items-center">
          <div className="max-w-[1800px] mx-auto px-8 w-full">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold uppercase tracking-wider rounded">
                  Featured
                </span>
                {featuredItem.OfficialRating && (
                  <span className="px-2 py-1 bg-white/10 backdrop-blur-sm text-white text-xs font-medium rounded border border-white/20">
                    {featuredItem.OfficialRating}
                  </span>
                )}
                {featuredItem.ProductionYear && (
                  <span className="text-gray-300 text-sm font-medium">{featuredItem.ProductionYear}</span>
                )}
              </div>
              
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight drop-shadow-2xl">
                {featuredItem.Name}
              </h1>
              
              {featuredItem.Overview && (
                <p className="text-lg md:text-xl text-gray-200 leading-relaxed mb-8 line-clamp-3 drop-shadow-lg">
                  {featuredItem.Overview}
                </p>
              )}
              
              {/* Action Buttons */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate(`/player/${featuredItem.Id}`, { state: { backgroundLocation: location } })}
                  className="px-8 py-3.5 bg-white text-black text-lg font-bold rounded hover:bg-gray-200 transition-all duration-200 flex items-center gap-3 shadow-lg"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                  Play
                </button>
                <button 
                  onClick={() => navigate(`/details/${featuredItem.Id}`)}
                  className="px-8 py-3.5 bg-white/20 backdrop-blur-md text-white text-lg font-semibold rounded hover:bg-white/30 transition-all duration-200 flex items-center gap-3"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  More Info
                </button>
                <button
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    toggleFavorite(featuredItem);
                  }}
                  className={`p-3.5 rounded-full border-2 transition-all duration-200 ${
                    featuredItem.UserData?.IsFavorite
                      ? 'bg-white/20 border-white/50 text-white'
                      : 'bg-transparent border-white/30 text-white hover:border-white/60'
                  }`}
                  aria-label={featuredItem.UserData?.IsFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          
          {/* Fade to content */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent pointer-events-none" />
        </div>
      )}

      {/* Loading State for Hero */}
      {showFeatured && isInitialLoad && (
        <div className="relative z-10 pt-24 pb-8 min-h-[50vh] flex items-center">
          <div className="max-w-[1800px] mx-auto px-8 w-full">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-24 bg-white/10 rounded animate-pulse" />
                <div className="h-7 w-12 bg-white/10 rounded animate-pulse" />
                <div className="h-7 w-16 bg-white/10 rounded animate-pulse" />
              </div>
              <div className="h-16 w-3/4 bg-white/10 rounded animate-pulse mb-6" />
              <div className="space-y-3 mb-8">
                <div className="h-5 w-full bg-white/10 rounded animate-pulse" />
                <div className="h-5 w-11/12 bg-white/10 rounded animate-pulse" />
                <div className="h-5 w-4/5 bg-white/10 rounded animate-pulse" />
              </div>
              <div className="flex gap-4">
                <div className="h-14 w-32 bg-white/10 rounded animate-pulse" />
                <div className="h-14 w-40 bg-white/10 rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="relative z-10 max-w-[1800px] mx-auto px-8 pb-16">
        {isInitialLoad ? (
          /* Loading skeletons */
          <div className="space-y-12">
            {Array.from({ length: 5 }).map((_, rowIndex) => (
              <div key={`skeleton-row-${rowIndex}`} className="animate-pulse">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded bg-white/10" />
                    <div className="h-7 w-56 bg-white/10 rounded" />
                  </div>
                </div>
                <div className="flex gap-3 overflow-hidden">
                  {Array.from({ length: 6 }).map((__, cardIndex) => (
                    <div key={`skeleton-card-${rowIndex}-${cardIndex}`} className="flex-shrink-0 w-48">
                      <div className="aspect-[2/3] bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg mb-3" />
                      <div className="h-4 w-3/4 bg-white/10 rounded mb-2" />
                      <div className="h-3 w-1/2 bg-white/10 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
        /* Content Rows */
        (() => {
          type Section = { id: string; label: string; element: ReactElement | null };
          const sections: Section[] = [
            {
              id: 'continue_movies',
              label: 'Continue Watching Movies',
              element: (
                <MediaRow
                  title="Continue Watching Movies"
                  items={resumeMovies}
                  onItemClick={handleItemClick}
                  onBrowseClick={handleBrowseClick}
                  onToggleFavorite={toggleFavorite}
                  favChanging={favChanging}
                  favoriteIds={favoriteIds}
                  editMode={isEditMode}
                  isHidden={sectionVisibility['continue_movies'] === false}
                  onToggleVisibility={() => {
                    setSectionVisibility(prev => {
                      const isCurrentlyHidden = prev['continue_movies'] === false;
                      return {
                        ...prev,
                        continue_movies: isCurrentlyHidden
                      };
                    });
                  }}
                  icon={
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                    </svg>
                  }
                />
              )
            },
            {
              id: 'continue_tv',
              label: 'Continue Watching Series',
              element: (
                <MediaRow
                  title="Continue Watching Series"
                  items={resumeSeries}
                  onItemClick={handleItemClick}
                  onBrowseClick={handleBrowseClick}
                  onToggleFavorite={toggleFavorite}
                  favChanging={favChanging}
                  favoriteIds={favoriteIds}
                  editMode={isEditMode}
                  isHidden={sectionVisibility['continue_tv'] === false}
                  onToggleVisibility={() => {
                    setSectionVisibility(prev => {
                      const isCurrentlyHidden = prev['continue_tv'] === false;
                      return {
                        ...prev,
                        continue_tv: isCurrentlyHidden
                      };
                    });
                  }}
                  icon={
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                    </svg>
                  }
                />
              )
            },
            {
              id: 'favorites',
              label: 'Favourites',
              element: favoriteItems.length > 0 ? (
                <MediaRow
                  title="Favourites"
                  items={favoriteItems}
                  onItemClick={handleItemClick}
                  onBrowseClick={handleBrowseClick}
                  onToggleFavorite={toggleFavorite}
                  favChanging={favChanging}
                  favoriteIds={favoriteIds}
                  editMode={isEditMode}
                  isHidden={sectionVisibility['favorites'] === false}
                  onToggleVisibility={() => {
                    setSectionVisibility(prev => {
                      const isCurrentlyHidden = prev['favorites'] === false;
                      return {
                        ...prev,
                        favorites: isCurrentlyHidden
                      };
                    });
                  }}
                  enableDragReorder={canDragFavorites}
                  onReorder={(fromIndex, toIndex) => {
                    setFavoriteItems((prev) => {
                      const next = [...prev];
                      const [moved] = next.splice(fromIndex, 1);
                      next.splice(toIndex, 0, moved);
                      sessionStorage.setItem('home_favorites', JSON.stringify(next));
                      return next;
                    });
                  }}
                  icon={
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                    </svg>
                  }
                />
              ) : null
            },
            {
              id: 'recommended_movies',
              label: 'Recommended Movies For You',
              element: (
                <div ref={recommendedMoviesRef}>
                  {recommendedMovies.length > 0 && (
                    <MediaRow
                      title="Recommended Movies For You"
                      subtitle="Based on your viewing history"
                      items={recommendedMovies}
                      onItemClick={handleItemClick}
                      onBrowseClick={handleBrowseClick}
                      onToggleFavorite={toggleFavorite}
                      favChanging={favChanging}
                      favoriteIds={favoriteIds}
                      editMode={isEditMode}
                      isHidden={sectionVisibility['recommended_movies'] === false}
                      onToggleVisibility={() => {
                        setSectionVisibility(prev => {
                          const isCurrentlyHidden = prev['recommended_movies'] === false;
                          return {
                            ...prev,
                            recommended_movies: isCurrentlyHidden
                          };
                        });
                      }}
                      icon={
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      }
                    />
                  )}
                </div>
              )
            },
            {
              id: 'recommended_series',
              label: 'Recommended Shows For You',
              element: (
                <div ref={recommendedSeriesRef}>
                  {recommendedSeries.length > 0 && (
                    <MediaRow
                      title="Recommended Shows For You"
                      subtitle="Based on your viewing history"
                      items={recommendedSeries}
                      onItemClick={handleItemClick}
                      onBrowseClick={handleBrowseClick}
                      onToggleFavorite={toggleFavorite}
                      favChanging={favChanging}
                      favoriteIds={favoriteIds}
                      editMode={isEditMode}
                      isHidden={sectionVisibility['recommended_series'] === false}
                      onToggleVisibility={() => {
                        setSectionVisibility(prev => {
                          const isCurrentlyHidden = prev['recommended_series'] === false;
                          return {
                            ...prev,
                            recommended_series: isCurrentlyHidden
                          };
                        });
                      }}
                      icon={
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      }
                    />
                  )}
                </div>
              )
            },
            {
              id: 'trending_movies',
              label: 'Popular Movies',
              element: (
                <div ref={popularMoviesRef}>
                  {popularStatus === 'loaded' && popularMovies.length > 0 ? (
                    <MediaRow
                      title="Popular Movies"
                      subtitle="Powered by TMDB"
                      items={popularMovies}
                      browseLink="/popular/movies"
                      onItemClick={handleItemClick}
                      onBrowseClick={handleBrowseClick}
                      onToggleFavorite={toggleFavorite}
                      favChanging={favChanging}
                      favoriteIds={favoriteIds}
                      editMode={isEditMode}
                      isHidden={sectionVisibility['trending_movies'] === false}
                      onToggleVisibility={() => {
                        setSectionVisibility(prev => {
                          const isCurrentlyHidden = prev['trending_movies'] === false;
                          return {
                            ...prev,
                            trending_movies: isCurrentlyHidden
                          };
                        });
                      }}
                      icon={
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                        </svg>
                      }
                    />
                  ) : null}
                </div>
              )
            },
            {
              id: 'popular_tv',
              label: 'Popular TV Shows',
              element: (
                <div ref={popularTvRef}>
                  {popularStatus === 'loaded' && popularTVShows.length > 0 ? (
                    <MediaRow
                      title="Popular TV Shows"
                      subtitle="Powered by TMDB"
                      items={popularTVShows}
                      browseLink="/popular/tv"
                      onItemClick={handleItemClick}
                      onBrowseClick={handleBrowseClick}
                      onToggleFavorite={toggleFavorite}
                      favChanging={favChanging}
                      favoriteIds={favoriteIds}
                      editMode={isEditMode}
                      isHidden={sectionVisibility['popular_tv'] === false}
                      onToggleVisibility={() => {
                        setSectionVisibility(prev => {
                          const isCurrentlyHidden = prev['popular_tv'] === false;
                          return {
                            ...prev,
                            popular_tv: isCurrentlyHidden
                          };
                        });
                      }}
                      icon={
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                        </svg>
                      }
                    />
                  ) : null}
                </div>
              )
            },
            {
              id: 'latest_movies',
              label: 'New Movies',
              element: (
                <div ref={latestMoviesRef}>
                  {latestStatus === 'loaded' && latestMovies.length > 0 ? (
                    <MediaRow
                      title="New Movies"
                      subtitle=""
                      items={latestMovies}
                      browseLink="/browse?type=Movie"
                      onItemClick={handleItemClick}
                      onBrowseClick={handleBrowseClick}
                      onToggleFavorite={toggleFavorite}
                      favChanging={favChanging}
                      favoriteIds={favoriteIds}
                      editMode={isEditMode}
                      isHidden={sectionVisibility['latest_movies'] === false}
                      onToggleVisibility={() => {
                        setSectionVisibility(prev => {
                          const isCurrentlyHidden = prev['latest_movies'] === false;
                          return {
                            ...prev,
                            latest_movies: isCurrentlyHidden
                          };
                        });
                      }}
                      icon={
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                        </svg>
                      }
                    />
                  ) : null}
                </div>
              )
            },
            {
              id: 'latest_episodes',
              label: 'New Episodes',
              element: (
                <div ref={latestEpisodesRef}>
                  {latestStatus === 'loaded' && latestEpisodes.length > 0 ? (
                    <MediaRow
                      title="New Episodes"
                      items={latestEpisodes}
                      browseLink="/browse?type=Series"
                      onItemClick={handleItemClick}
                      onBrowseClick={handleBrowseClick}
                      onToggleFavorite={toggleFavorite}
                      favChanging={favChanging}
                      favoriteIds={favoriteIds}
                      editMode={isEditMode}
                      isHidden={sectionVisibility['latest_episodes'] === false}
                      onToggleVisibility={() => {
                        setSectionVisibility(prev => {
                          const isCurrentlyHidden = prev['latest_episodes'] === false;
                          return {
                            ...prev,
                            latest_episodes: isCurrentlyHidden
                          };
                        });
                      }}
                      icon={
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                        </svg>
                      }
                    />
                  ) : null}
                </div>
              )
            },
            ...customSections.map(section => ({
              id: section.id,
              label: section.name,
              element: (customSectionItems[section.id] && customSectionItems[section.id].length > 0) ? (
                <MediaRow
                  title={section.name}
                  items={customSectionItems[section.id] || []}
                  onItemClick={handleItemClick}
                  onBrowseClick={handleBrowseClick}
                  onToggleFavorite={toggleFavorite}
                  favChanging={favChanging}
                  favoriteIds={favoriteIds}
                  subtitle="Custom"
                  onRemove={() => removeCustomSection(section.id)}
                  editMode={isEditMode}
                  isHidden={sectionVisibility[section.id] === false}
                  onToggleVisibility={() => {
                    setSectionVisibility(prev => {
                      const isCurrentlyHidden = prev[section.id] === false;
                      return {
                        ...prev,
                        [section.id]: isCurrentlyHidden
                      };
                    });
                  }}
                  icon={
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h7a1 1 0 100-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" />
                    </svg>
                  }
                />
              ) : null
            })),
          ];

          const sectionsById = new Map(sections.map(section => [section.id, section]));
          const ordered = savedHomeSectionOrder
            .map(id => sectionsById.get(id))
            .filter((section): section is Section => section !== undefined);
          const missing = sections.filter(section => !savedHomeSectionOrder.includes(section.id));

          const filteredSections = [...ordered, ...missing]
            .filter(section => section.element !== null && section.element !== undefined)
            .filter(section => isEditMode || sectionVisibility[section.id] !== false);

          return filteredSections.map((section) => {
            // Calculate position in the FULL order, not just filtered
            const fullIndex = savedHomeSectionOrder.indexOf(section.id);
            const isFirst = fullIndex === 0;
            const isLast = fullIndex === savedHomeSectionOrder.length - 1;
            
            const moveProps = {
              onMoveUp: () => moveHomeSection(section.id, 'up'),
              onMoveDown: () => moveHomeSection(section.id, 'down'),
              canMoveUp: !isFirst,
              canMoveDown: !isLast,
            };

            // Helper to inject props into MediaRow, even if nested
            const injectPropsIntoMediaRow = (element: React.ReactElement<any>): React.ReactElement<any> => {
              // Check multiple ways to identify MediaRow
              const isMediaRow = 
                element.type === MediaRow || // Direct comparison
                (element.type && typeof element.type === 'object' && element.type === MediaRow) || // Memo wrapped
                (element.props?.title && Array.isArray(element.props?.items)); // Props-based detection
              
              if (isMediaRow) {
                // Merge props properly, ensuring move props override any existing ones
                return React.cloneElement(element, {
                  ...element.props,
                  ...moveProps
                });
              }
              
              // If this is a wrapper element (like div), recursively process its children
              if (element.props?.children && React.isValidElement(element.props.children)) {
                return React.cloneElement(element, {
                  children: injectPropsIntoMediaRow(element.props.children)
                });
              }
              
              // If children is a conditional render or fragment, handle accordingly
              if (element.props?.children) {
                const children = element.props.children;
                // Handle conditional rendering that returns MediaRow or null
                if (typeof children === 'object' && children !== null && !Array.isArray(children)) {
                  return React.cloneElement(element, {
                    children: React.isValidElement(children) ? injectPropsIntoMediaRow(children) : children
                  });
                }
              }
              
              return element;
            };
            
            const elementWithProps = section.element && React.isValidElement(section.element)
              ? injectPropsIntoMediaRow(section.element as React.ReactElement<any>)
              : section.element;

            return (
              <div key={section.id}>
                {elementWithProps}
              </div>
            );
          });
        })()
        )}

        {/* Edit Mode Toggle */}
        <div className="mt-10 pb-6 border-t border-white/5 pt-6 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Edit Home</h3>
            <p className="text-sm text-gray-500">Toggle visibility and reorder all sections. Remove custom sections.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={resetHomeSectionOrder}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg transition-all duration-200 font-medium flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset Order
            </button>
            <button
              onClick={() => setIsEditMode(prev => !prev)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                isEditMode ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {isEditMode ? 'Done' : 'Edit'}
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />

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
