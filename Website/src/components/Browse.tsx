import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { embyApi } from '../services/embyApi';
import { useTVNavigation } from '../hooks/useTVNavigation';
import type { EmbyItem } from '../types/emby.types';
// Inline skeletons replace full-screen loading

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

interface FilterState {
  sortBy: string;
  sortOrder: string;
  genres: string[];
  years: (number | 'Before 1980')[];
  seasonCounts: (number | '10+')[];
}

// Item Card with image loading animation
function ItemCard({ item, imageUrl, onItemClick, isFavorite, isFavChanging, onToggleFavorite }: { 
  item: EmbyItem; 
  imageUrl: string; 
  onItemClick: (item: EmbyItem) => void;
  isFavorite?: boolean;
  isFavChanging?: boolean;
  onToggleFavorite?: (item: EmbyItem) => void;
}) {
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const versionCount = (item.AlternateVersions?.length ?? 0) + 1;

  // Long-press handling (for D-pad / Android TV)
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
      className="cursor-pointer group focusable-card text-left w-full"
    >
      <div className="relative aspect-[2/3] bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl overflow-hidden mb-3 shadow-lg shadow-black/30 ring-1 ring-white/5">
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
              className={`w-full h-full object-cover group-hover:scale-110 transition-all duration-500 ${
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

        {/* Multiple versions badge */}
        {versionCount > 1 && (
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-purple-600/90 backdrop-blur-sm rounded text-xs font-medium text-white flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/>
            </svg>
            {versionCount}
          </div>
        )}

        {/* Favorite star (Movies & Series) */}
        {(item.Type === 'Series' || item.Type === 'Movie') && (
          <div className="absolute top-2 right-2 flex items-center gap-2 z-30">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite && onToggleFavorite(item); }}
              onPointerDown={(e) => { e.stopPropagation(); }}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleFavorite && onToggleFavorite(item); } }}
              tabIndex={0}
              data-tv-bottom-only
              aria-label={isFavorite ? `Unfavorite ${item.Name}` : `Favorite ${item.Name}`}
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
        {!!item.UserData?.PlaybackPositionTicks && !!item.RunTimeTicks && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
              style={{
                width: `${(item.UserData.PlaybackPositionTicks / item.RunTimeTicks) * 100}%`,
              }}
            />
          </div>
        )}

        {/* Watched badge */}
        {item.UserData?.Played && (
          <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>
      
      <div className="h-20 flex flex-col justify-start gap-1">
        <h3 className="text-white font-semibold text-sm line-clamp-1 group-hover:text-blue-400 transition-colors">
          {item.Name}
        </h3>
        
        {/* Year/Season count and release date */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500 flex-wrap">
          {item.Type === 'Series' ? (
            <>
              {item.ChildCount && (
                <span>{item.ChildCount} Season{item.ChildCount !== 1 ? 's' : ''}</span>
              )}
              {item.PremiereDate && (
                <>
                  {item.ChildCount && <span>·</span>}
                  <span>{formatReleaseDate(item.PremiereDate)}</span>
                </>
              )}
            </>
          ) : item.Type === 'Episode' ? (
            <span>
              S{item.ParentIndexNumber || 1}E{item.IndexNumber || 1}
              {item.PremiereDate && ` · ${formatReleaseDate(item.PremiereDate)}`}
            </span>
          ) : (
            <>{item.ProductionYear && <span>{item.ProductionYear}</span>}</>
          )}
        </div>
        
        {/* Rating Badge and Community Rating */}
        <div className="flex items-center gap-1.5 text-xs">
          {item.OfficialRating && (
            <span className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-gray-400 text-[10px] font-medium">
              {item.OfficialRating}
            </span>
          )}
          {item.CommunityRating && (
            <span className="flex items-center gap-0.5 text-gray-500">
              <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
              </svg>
              <span className="text-gray-400">{item.CommunityRating.toFixed(1)}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}


// Multi-select dropdown component
function MultiSelect({ 
  label, 
  options, 
  selected, 
  onChange, 
  placeholder,
  renderOption,
  tvGroup,
  tvOrder
}: {
  label: string;
  options: (string | number)[];
  selected: (string | number)[];
  onChange: (selected: (string | number)[]) => void;
  placeholder: string;
  renderOption?: (option: string | number) => string;
  tvGroup?: string;
  tvOrder?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (option: string | number) => {
    if (selected.includes(option)) {
      onChange(selected.filter(s => s !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const displayText = selected.length === 0 
    ? placeholder 
    : selected.length === 1 
      ? (renderOption ? renderOption(selected[0]) : String(selected[0]))
      : `${selected.length} selected`;

  return (
    <div ref={dropdownRef} className="relative">
      <label className="block text-xs text-gray-400 mb-1.5">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        tabIndex={0}
        data-tv-group={tvGroup}
        data-tv-order={tvOrder}
        className="w-full h-10 px-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 text-left flex items-center justify-between focusable-item whitespace-nowrap"
      >
        <span className={selected.length === 0 ? 'text-gray-500' : ''}>{displayText}</span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div role="menu" className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {selected.length > 0 && (
            <button
              onClick={() => onChange([])}
              tabIndex={0}
              role="menuitem"
              className="w-full px-3 py-2 text-left text-sm text-blue-400 hover:bg-gray-700 border-b border-gray-700 focusable-item"
            >
              Clear selection
            </button>
          )}
          {options.map((option) => (
            <button
              key={option}
              onClick={() => toggleOption(option)}
              tabIndex={0}
              role="menuitem"
              className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-700 flex items-center gap-2 focusable-item"
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                selected.includes(option) ? 'bg-blue-500 border-blue-500' : 'border-gray-600'
              }`}>
                {selected.includes(option) && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              {renderOption ? renderOption(option) : String(option)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Single-select dropdown component (TV-friendly and keyboard-accessible)
function SingleSelect({
  label,
  options,
  value,
  onChange,
  placeholder,
  tvGroup,
  tvOrder,
}: {
  label: string;
  options: { v: string; l: string }[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  tvGroup?: string;
  tvOrder?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const selectedLabel = options.find(o => o.v === value)?.l || placeholder || '';

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs text-gray-400 mb-1.5">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        tabIndex={0}
        data-tv-group={tvGroup}
        data-tv-order={tvOrder}
        className="w-full h-10 px-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 text-left flex items-center justify-between focusable-item"
      >
        <span className={`${selectedLabel ? '' : 'text-gray-500'} truncate`}>{selectedLabel}</span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div role="menu" className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {options.map(({ v, l }) => (
            <button
              key={v}
              onClick={() => { onChange(v); setIsOpen(false); }}
              tabIndex={0}
              role="menuitem"
              className={`w-full px-3 py-2 text-left text-sm ${value === v ? 'text-blue-400 bg-gray-700' : 'text-white hover:bg-gray-700'} focusable-item flex items-center justify-between`}
            >
              <span>{l}</span>
              {value === v && (
                <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Browse() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  useTVNavigation();
  
  const mediaType = searchParams.get('type') || 'Movie'; // 'Movie' or 'Series'
  
  const [items, setItems] = useState<EmbyItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isInlineLoading, setIsInlineLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [genres, setGenres] = useState<string[]>([]);
  const [years, setYears] = useState<(number | 'Before 1980')[]>([]);
  // Static season count options: 1-9 and 10+
  const seasonCountOptions = useMemo<(number | '10+')[]>(() => [1,2,3,4,5,6,7,8,9,'10+'], []);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 72;
  const DEFAULT_FILTERS: FilterState = {
    sortBy: 'PremiereDate',
    sortOrder: 'Descending',
    genres: [],
    years: [],
    seasonCounts: [],
  };

  const [filters, setFilters] = useState<FilterState>({ ...DEFAULT_FILTERS });
  // Filters are always visible in the redesigned UI

  // Saved filter shortcuts (persisted separately per media type)
  interface SavedFilter {
    id: string;
    name: string;
    filters: FilterState;
    searchTerm: string;
  }

  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);

  // Brief saved animation/toast state (TV-friendly)
  const [saveToast, setSaveToast] = useState<{ id: string; message: string } | null>(null);
  // Short inline check animation id for Add-to-Home
  const [addedToHomeId, setAddedToHomeId] = useState<string | null>(null);
  const [homeAddToast, setHomeAddToast] = useState<{ id: string; message: string } | null>(null);

  const storageKey = (mt: string) => `savedFilters_${mt}`;  

  // load saved filters when media type changes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(mediaType));
      if (raw) {
        setSavedFilters(JSON.parse(raw));
      } else {
        setSavedFilters([]);
      }
    } catch (e) {
      console.error('Failed to load saved filters:', e);
      setSavedFilters([]);
    }
  }, [mediaType]);

  const persistSavedFilters = (list: SavedFilter[]) => {
    try {
      localStorage.setItem(storageKey(mediaType), JSON.stringify(list));
      setSavedFilters(list);
    } catch (e) {
      console.error('Failed to persist saved filters:', e);
    }
  };

  const generateFilterName = (f: FilterState, term: string) => {
    const parts: string[] = [];
    if (term.trim()) parts.push(`"${term.trim()}"`);
    if (f.genres.length) parts.push(`Genres: ${f.genres.slice(0,3).join(', ')}`);
    if (f.years.length) parts.push(`Years: ${f.years.slice(0,3).join(', ')}`);
    if (f.seasonCounts.length) parts.push(`Seasons: ${f.seasonCounts.slice(0,3).join(', ')}`);
    parts.push(`Sort: ${f.sortBy} ${f.sortOrder === 'Descending' ? 'Desc' : 'Asc'}`);
    return parts.join(' · ');
  };

  const hasAnyFilterApplied = (f: FilterState, term: string) => {
    const isDefault = JSON.stringify(f) === JSON.stringify(DEFAULT_FILTERS) && term.trim() === '';
    return !isDefault;
  };

  const saveCurrentFilters = () => {
    if (!hasAnyFilterApplied(filters, searchTerm)) {
      // nothing to save
      // lightweight toast could be added later; for now use alert
      alert('No filters or search term to save.');
      return;
    }
    const suggestedName = generateFilterName(filters, searchTerm);
    const name = window.prompt('Save filter as (name):', suggestedName) || '';
    if (!name.trim()) return;
    const newFilter: SavedFilter = {
      id: `sf_${Date.now()}`,
      name: name.trim(),
      filters: { ...filters },
      searchTerm: searchTerm,
    };
    const updated = [newFilter, ...savedFilters].slice(0, 12); // cap to 12
    persistSavedFilters(updated);

    // Show a brief TV-friendly saved animation/toast (no blocking modal)
    try {
      setSaveToast({ id: newFilter.id, message: 'Saved' });
      setTimeout(() => setSaveToast(null), 1800);
    } catch (e) {
      // ignore
    }
  };

  const applySavedFilter = (sf: SavedFilter) => {
    setFilters({ ...sf.filters });
    setSearchTerm(sf.searchTerm || '');
    setCurrentPage(1);
    // trigger load
    setTimeout(() => loadItems('filters'), 0);
  };

  const removeSavedFilter = (id: string) => {
    const updated = savedFilters.filter(s => s.id !== id);
    persistSavedFilters(updated);
  };

  // Add saved filter as a section to the Home screen
  const HOME_SECTIONS_KEY = 'home_customSections';
  type HomeSection = {
    id: string;
    name: string;
    filters: FilterState;
    searchTerm: string;
    mediaType: string;
  };

  const loadHomeSections = (): HomeSection[] => {
    try {
      const raw = localStorage.getItem(HOME_SECTIONS_KEY);
      return raw ? JSON.parse(raw) as HomeSection[] : [];
    } catch (e) {
      console.error('Failed to load home sections:', e);
      return [];
    }
  };

  const persistHomeSections = (list: HomeSection[]) => {
    try {
      localStorage.setItem(HOME_SECTIONS_KEY, JSON.stringify(list));
    } catch (e) {
      console.error('Failed to persist home sections:', e);
    }
  };

  const addSavedFilterToHome = (sf: SavedFilter) => {
    const existing = loadHomeSections();

    // Prevent duplicates: match by mediaType + filters + searchTerm
    const match = existing.find(s =>
      s.mediaType === mediaType &&
      JSON.stringify(s.filters) === JSON.stringify(sf.filters) &&
      (s.searchTerm || '') === (sf.searchTerm || '')
    );

    if (match) {
      // Animate the existing section's add button to indicate it's already present
      try {
        setAddedToHomeId(match.id);
        setTimeout(() => setAddedToHomeId(null), 1800);
        setHomeAddToast({ id: match.id, message: 'Already on Home' });
        setTimeout(() => setHomeAddToast(null), 2200);
      } catch (e) {
        // ignore
      }
      return;
    }

    const section: HomeSection = {
      id: `hs_${Date.now()}`,
      name: sf.name,
      filters: { ...sf.filters },
      searchTerm: sf.searchTerm,
      mediaType,
    };
    const updated = [section, ...existing].slice(0, 20); // cap
    persistHomeSections(updated);
    // Brief inline check animation for TV users (non-blocking)
    try {
      setAddedToHomeId(section.id);
      setTimeout(() => setAddedToHomeId(null), 1800);
      setHomeAddToast({ id: section.id, message: 'Added to Home' });
      setTimeout(() => setHomeAddToast(null), 2200);
    } catch (e) {
      // ignore
    }
  };

  // Favorite toggle state for instant UI feedback
  const [favChanging, setFavChanging] = useState<Record<string, boolean>>({});

  const toggleFavorite = async (item: EmbyItem) => {
    if (!item || !item.Id) return;
    const isFav = !!item.UserData?.IsFavorite;

    // Optimistic UI (preserve other required UserData fields)
    setItems(prev => prev.map(it => {
      if (it.Id !== item.Id) return it;
      const prevUD = it.UserData || { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false };
      return { ...it, UserData: { ...prevUD, IsFavorite: !isFav } };
    }));
    setFavChanging(prev => ({ ...prev, [item.Id]: true }));

    try {
      if (!isFav) {
        await embyApi.markFavorite(item.Id);
      } else {
        await embyApi.unmarkFavorite(item.Id);
      }
    } catch (e) {
      console.error('Failed to toggle favorite:', e);
      // revert (preserve other required UserData fields)
      setItems(prev => prev.map(it => {
        if (it.Id !== item.Id) return it;
        const prevUD = it.UserData || { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false };
        return { ...it, UserData: { ...prevUD, IsFavorite: isFav } };
      }));
      alert('Failed to update favorite.');
    } finally {
      setFavChanging(prev => {
        const copy = { ...prev };
        delete copy[item.Id];
        return copy;
      });
    }
  };


  // Initialize genre filter from URL parameter
  useEffect(() => {
    const genreParam = searchParams.get('genre');
    if (genreParam) {
      setFilters(prev => ({
        ...prev,
        genres: [genreParam]
      }));
      // Filters panel is always visible in redesigned UI
    }
  }, [searchParams]);

  useEffect(() => {
    // reset to first page when media type changes
    setCurrentPage(1);
    loadItems('initial');
    loadFilterOptions();

    // Check if a saved filter was applied from Home -> Browse (one-time)
    try {
      const raw = localStorage.getItem('emby_applySavedFilter');
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && obj.mediaType === mediaType) {
          setFilters({ ...(obj.filters || DEFAULT_FILTERS) });
          setSearchTerm(obj.searchTerm || '');
          setCurrentPage(1);
          setTimeout(() => loadItems('filters'), 0);
          localStorage.removeItem('emby_applySavedFilter');
        }
      }
    } catch (e) {
      // ignore
    }
  }, [mediaType]);

  const applyFilters = () => {
    setCurrentPage(1);
    loadItems('filters');
  };

  // Debounce search typing (inline loading, no full-screen)
  useEffect(() => {
    const handle = setTimeout(() => {
      setCurrentPage(1);
      loadItems('search');
    }, 300);
    return () => clearTimeout(handle);
  }, [searchTerm]);

  const loadItems = async (mode: 'initial' | 'page' | 'search' | 'filters' = 'initial') => {
    try {
      if (mode === 'initial') {
        setIsLoading(true);
      } else {
        setIsInlineLoading(true);
      }
      // Decide if we need client-side scanning: season filter for Series or 'Before 1980' year bucket
      const isSeries = mediaType === 'Series';
      const hasSeasonFilter = isSeries && filters.seasonCounts.length > 0;
      const selectedYears = filters.years.filter((y): y is number => typeof y === 'number');
      const includeBefore1980 = filters.years.some((y) => y === 'Before 1980');
      const needsClientYearFilter = includeBefore1980; // requires range filtering

      // If a season filter is active or 'Before 1980' is selected, fetch and filter across the library (capped)
      if (hasSeasonFilter || needsClientYearFilter) {
        const baseParams: any = {
          recursive: true,
          includeItemTypes: mediaType,
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
          // Ensure necessary fields are present (include UserData so favorite state is available)
          fields: isSeries
            ? 'Genres,Overview,CommunityRating,OfficialRating,RunTimeTicks,ProductionYear,PremiereDate,Studios,ChildCount,SeasonCount,ProviderIds,Path,MediaSources,UserData'
            : 'Genres,Overview,CommunityRating,OfficialRating,RunTimeTicks,ProductionYear,PremiereDate,Studios,ProviderIds,Path,MediaSources,UserData',
        };
        if (filters.genres.length > 0) baseParams.genres = filters.genres.join(',');
        // Do NOT pass years when using 'Before 1980' because API doesn't support ranges; we'll filter client-side.
        if (!needsClientYearFilter && selectedYears.length > 0) baseParams.years = selectedYears.join(',');
        if (searchTerm.trim().length > 0) baseParams.searchTerm = searchTerm.trim();

        const matches: EmbyItem[] = [];
        const pageSize = 500;
        const maxScan = 5000;
        let startIndex = 0;
        while (startIndex < maxScan) {
          const res = await embyApi.getItems({ ...baseParams, limit: pageSize, startIndex });
          const batch = res.Items || [];
          if (batch.length === 0) break;
          for (const it of batch) {
            // Year filter (if needed)
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
                const inBefore = includeBefore1980 ? y < 1980 : false;
                yearOk = (selectedYears.length > 0 || includeBefore1980) ? (inSelected || inBefore) : true;
              }
            }

            if (!yearOk) continue;

            // Season filter (Series only)
            if (hasSeasonFilter) {
              const seasonCount = (it as any).SeasonCount ?? (it as any).ChildCount;
              const seasonNum = typeof seasonCount === 'number' ? seasonCount : Number(seasonCount);
              if (seasonNum === undefined || seasonNum === null || Number.isNaN(seasonNum)) continue;
              const seasonOk = filters.seasonCounts.some((sel) =>
                typeof sel === 'number' ? seasonNum === sel : sel === '10+' ? seasonNum >= 10 : false
              );
              if (!seasonOk) continue;
            }

            matches.push(it);
          }
          startIndex += batch.length;
          if (batch.length < pageSize) break;
        }

        // Paginate client-side for season-filtered results
        const total = matches.length;
        setTotalCount(total);
        const offset = (currentPage - 1) * itemsPerPage;
        setItems(matches.slice(offset, offset + itemsPerPage));
      } else {
        const params: any = {
          recursive: true,
          includeItemTypes: mediaType,
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
          limit: itemsPerPage,
          startIndex: (currentPage - 1) * itemsPerPage,
          // Ensure season-related fields are included for Series (include UserData)
          fields: mediaType === 'Series'
            ? 'Genres,Overview,CommunityRating,OfficialRating,RunTimeTicks,ProductionYear,PremiereDate,Studios,ChildCount,SeasonCount,ProviderIds,Path,MediaSources,UserData'
            : undefined,
        };

        if (filters.genres.length > 0) params.genres = filters.genres.join(',');
        const selectedYearsSimple = filters.years.filter((y): y is number => typeof y === 'number');
        if (selectedYearsSimple.length > 0) params.years = selectedYearsSimple.join(',');
        if (searchTerm.trim().length > 0) params.searchTerm = searchTerm.trim();

        // Fetch a single page on the server
        const res = await embyApi.getItems(params);
        const pageItems = res.Items || [];
        setItems(pageItems);
        setTotalCount(res.TotalRecordCount || pageItems.length);
      }
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      if (mode === 'initial') {
        setIsLoading(false);
      } else {
        setIsInlineLoading(false);
      }
    }
  };

  const loadFilterOptions = async () => {
    try {
      // Genres
      const genresResponse = await embyApi.getGenres({ includeItemTypes: mediaType });
      setGenres(genresResponse.Items.map(g => g.Name));

      // Years: show every year down to 1980, then a bucket "Before 1980"
      const currentYear = new Date().getFullYear();
      const list: (number | 'Before 1980')[] = [];
      for (let y = currentYear; y >= 1980; y--) list.push(y);
      list.push('Before 1980');
      setYears(list);

      // Season counts: static options handled by seasonCountOptions
    } catch (error) {
      console.error('Failed to load filter options:', error);
    }
  };

  const handleItemClick = (item: EmbyItem) => {
    navigate(`/details/${item.Id}`, { state: { mediaType: item.Type } });
  };

  // Client-side refinement (on top of server-side filtering)
  const filteredItems = useMemo(() => 
    items.filter((item) =>
      item.Name.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [items, searchTerm]
  );

  // Pagination calculations
  const { totalPages, paginatedItems, startIndex, endIndex } = useMemo(() => {
    const total = Math.max(1, Math.ceil((totalCount || 0) / itemsPerPage));
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    // items already represent the current server page; still apply client-side refinement
    const paginated = filteredItems;
    return { totalPages: total, paginatedItems: paginated, startIndex: startIdx, endIndex: endIdx };
  }, [filteredItems, currentPage, itemsPerPage, totalCount]);

  // Reset to page 1 if current page exceeds total pages
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  // fetch new page when page changes (and not already triggered by other effects)
  useEffect(() => {
    loadItems('page');
  }, [currentPage]);

  const clearFilters = () => {
    setFilters({
      sortBy: 'PremiereDate',
      sortOrder: 'Descending',
      genres: [],
      years: [],
      seasonCounts: [],
    });
    setSearchTerm('');
    setCurrentPage(1);
  };

  // activeFiltersCount no longer needed for a toggle badge

  if (isLoading) {
    // Browse skeleton: header + filters + grid cards
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="h-10 w-32 bg-white/10 rounded mb-4 animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
            <div className="h-10 bg-white/10 rounded animate-pulse" />
            <div className="h-10 bg-white/10 rounded animate-pulse" />
            <div className="h-10 bg-white/10 rounded animate-pulse" />
            <div className="h-10 bg-white/10 rounded animate-pulse" />
            <div className="h-10 bg-white/10 rounded animate-pulse" />
            <div className="h-10 bg-white/10 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="w-full">
                <div className="aspect-[2/3] rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 animate-pulse mb-3" />
                <div className="h-4 bg-white/10 rounded w-10/12 mb-2 animate-pulse" />
                <div className="h-3 bg-white/10 rounded w-6/12 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Main UI
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
      <header className="relative z-20 bg-gray-950 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate('/home')}
              tabIndex={0}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all focusable-item"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-white">{mediaType === 'Movie' ? 'Movies' : 'TV Shows'}</h1>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="flex bg-white/10 rounded-lg p-1" data-tv-row>
              <button
                onClick={() => navigate('/browse?type=Movie')}
                tabIndex={0}
                className={`px-4 h-10 rounded-md text-sm font-medium focusable-tab transition-colors whitespace-nowrap flex items-center justify-center ${
                  mediaType === 'Movie' ? 'bg-white text-black' : 'text-gray-300 hover:text-white'
                }`}
              >
                Movies
              </button>
              <button
                onClick={() => navigate('/browse?type=Series')}
                tabIndex={0}
                className={`px-4 h-10 rounded-md text-sm font-medium focusable-tab transition-colors whitespace-nowrap flex items-center justify-center ${
                  mediaType === 'Series' ? 'bg-white text-black' : 'text-gray-300 hover:text-white'
                }`}
              >
                TV Shows
              </button>
            </div>
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                tabIndex={0}
                className="w-full pl-10 pr-4 h-10 bg-white/10 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focusable-item"
              />
            </div>
          </div>

          {/* Modern Filter Bar */}
          <div className="mt-2 p-4 rounded-xl border border-white/10 bg-white/5" role="toolbar">
            {/* Responsive, TV-friendly filter layout */}
            <div className="flex flex-wrap items-end gap-3">
              {/* Genre */}
              <div className="w-full sm:w-56" data-tv-row>
                <MultiSelect
                  label="Genre"
                  options={genres}
                  selected={filters.genres}
                  onChange={(selected) => setFilters({ ...filters, genres: selected as string[] })}
                  placeholder="All Genres"
                  tvGroup="browse-filters"
                  tvOrder={1}
                />
              </div>
              {/* Year */}
              <div className="w-full sm:w-44" data-tv-row>
                <MultiSelect
                  label="Year"
                  options={years}
                  selected={filters.years}
                  onChange={(selected) => setFilters({ ...filters, years: selected as (number | 'Before 1980')[] })}
                  placeholder="All Years"
                  renderOption={(opt) => (typeof opt === 'number' ? String(opt) : 'Before 1980')}
                  tvGroup="browse-filters"
                />
              </div>
              {/* Seasons (Series only) */}
              {mediaType === 'Series' && (
                <div className="w-full sm:w-48" data-tv-row>
                  <MultiSelect
                    label="Seasons"
                    options={seasonCountOptions}
                    selected={filters.seasonCounts}
                    onChange={(selected) => setFilters({ ...filters, seasonCounts: selected as (number | '10+')[] })}
                    placeholder="All"
                    renderOption={(opt) => (typeof opt === 'number' ? `${opt} Season${opt !== 1 ? 's' : ''}` : `${opt} Seasons`)}
                    tvGroup="browse-filters"
                  />
                </div>
              )}
              <div className="w-full lg:flex-1 min-w-[220px]" data-tv-row>
                <SingleSelect
                  label="Sort By"
                  options={[
                    { v: 'PremiereDate', l: 'Release' },
                    { v: 'SortName', l: 'Name' },
                    { v: 'DateCreated', l: 'Added' },
                    { v: 'CommunityRating', l: 'Rating' },
                    { v: 'Runtime', l: 'Runtime' },
                  ]}
                  value={filters.sortBy}
                  onChange={(v) => setFilters({ ...filters, sortBy: v })}
                  placeholder="Select"
                  tvGroup="browse-filters"
                  tvOrder={2}
                />
              </div>
              <div className="w-full sm:w-auto min-w-[180px]" data-tv-row>
                <SingleSelect
                  label="Order"
                  options={[
                    { v: 'Descending', l: 'Desc' },
                    { v: 'Ascending', l: 'Asc' },
                  ]}
                  value={filters.sortOrder}
                  onChange={(v) => setFilters({ ...filters, sortOrder: v })}
                  placeholder="Select"
                  tvGroup="browse-filters"
                  tvOrder={3}
                />
              </div>
              {/* Actions */}
              <div className="flex items-end gap-3 ml-auto" data-tv-row>
                <button
                  onClick={saveCurrentFilters}
                  tabIndex={0}
                  title="Save current filters"
                  disabled={!hasAnyFilterApplied(filters, searchTerm)}
                  className={`px-4 h-10 text-sm rounded-md transition-colors focusable-item whitespace-nowrap ${hasAnyFilterApplied(filters, searchTerm) ? 'text-gray-200 bg-white/6 hover:bg-white/10' : 'text-gray-600 bg-transparent opacity-40 cursor-not-allowed'}`}
                >
                  Save Filter
                </button>
                {/* TV-friendly saved animation */}
                {saveToast && (
                  <span aria-live="polite" className="ml-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-green-600 text-white transform transition-all duration-300">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {saveToast.message}
                  </span>
                )}
                <button
                  onClick={clearFilters}
                  tabIndex={0}
                  className="px-4 h-10 text-sm text-gray-400 hover:text-white transition-colors focusable-item whitespace-nowrap"
                >
                  Clear All
                </button>
                <button
                  onClick={applyFilters}
                  tabIndex={0}
                  className="px-6 h-10 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white text-sm font-semibold rounded-xl shadow focusable-item whitespace-nowrap"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>

          {/* Favorite help text */}
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-full border border-white/10 bg-gradient-to-r from-white/10 to-white/5 text-xs sm:text-sm text-gray-300">
            <svg className="w-4 h-4 text-yellow-300" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
            <span>Tip: Use the star on a tile to add or remove favorites.</span>
          </div>
        </div>
      </header>

      {/* Saved Filter Shortcuts */}
      {savedFilters.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 pb-2">
          {homeAddToast && (
            <div className="mb-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 text-xs sm:text-sm">
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M5 11l3 3L15 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{homeAddToast.message}</span>
            </div>
          )}
          <div className="flex items-center gap-2 overflow-x-auto py-2">
            {savedFilters.map((sf) => (
              <div key={sf.id} className="group flex items-center gap-2 bg-white/5 border border-white/6 px-3 py-1 rounded-full text-sm text-gray-200 transition-transform duration-150 ease-out transform hover:scale-105 hover:bg-white/10 cursor-pointer focus-within:ring-2 focus-within:ring-blue-400 focus-within:ring-offset-1">
                <button
                  onClick={() => applySavedFilter(sf)}
                  tabIndex={0}
                  className="text-left focusable-item"
                >
                  {sf.name}
                </button>

                <button
                  onClick={() => addSavedFilterToHome(sf)}
                  aria-label={`Add saved filter ${sf.name} to Home`}
                  title={`Add to Home`}
                  tabIndex={0}
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors transition-transform duration-200 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-1 ${addedToHomeId === sf.id ? 'bg-green-600 text-white scale-110' : 'bg-white/6 text-gray-300 hover:scale-110 hover:bg-green-600 hover:text-white cursor-pointer'}`}
                >
                  {addedToHomeId === sf.id ? (
                    <svg className="w-3 h-3" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M5 11l3 3L15 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>

                <button
                  onClick={() => removeSavedFilter(sf.id)}
                  aria-label={`Remove saved filter ${sf.name}`}
                  title={`Remove saved filter ${sf.name}`}
                  tabIndex={0}
                  className="w-6 h-6 rounded-full bg-white/6 flex items-center justify-center text-gray-300 transition-colors transition-transform duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 focus:bg-red-600 focus:text-white hover:scale-110 hover:bg-red-600 hover:text-white cursor-pointer"
                >
                  <svg className="w-3 h-3" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M4.5 4.5L15.5 15.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M15.5 4.5L4.5 15.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results Count */}
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <p className="text-gray-400 text-sm flex items-center">
          <span>
            {totalCount} {totalCount === 1 ? 'result' : 'results'}
            {totalPages > 1 && (
              <span className="ml-2">
                • Showing {Math.min(startIndex + 1, Math.max(totalCount, 0))}-{Math.min(endIndex, totalCount)} (Page {currentPage} of {totalPages})
              </span>
            )}
          </span>
          {isInlineLoading && (
            <span className="ml-3 inline-flex items-center text-gray-500">
              <svg className="animate-spin h-4 w-4 mr-2 text-gray-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
              Updating...
            </span>
          )}
        </p>
      </div>

      {/* Content Grid */}
      <main className="max-w-7xl mx-auto px-6 pb-12">
        {filteredItems.length === 0 ? (
          <div className="text-center py-20">
            <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
            <p className="text-gray-400 text-lg mb-2">No items found</p>
            <p className="text-gray-600 text-sm">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-6">
              {paginatedItems.map((item) => {
              const imageUrl = item.ImageTags?.Primary
                ? embyApi.getImageUrl(item.Id, 'Primary', { maxWidth: 400, tag: item.ImageTags.Primary })
                : '';

              return (
                <ItemCard 
                  key={item.Id}
                  item={item}
                  imageUrl={imageUrl}
                  onItemClick={handleItemClick}
                  isFavorite={!!item.UserData?.IsFavorite}
                  isFavChanging={!!favChanging[item.Id]}
                  onToggleFavorite={() => toggleFavorite(item)}
                />
              );
            })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-2 rounded-lg bg-white/10 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/20 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 rounded-lg bg-white/10 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/20 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'bg-white/10 text-gray-300 hover:bg-white/20'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 rounded-lg bg-white/10 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/20 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 rounded-lg bg-white/10 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/20 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
