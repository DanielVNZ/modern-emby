import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { embyApi } from '../services/embyApi';
import type { EmbyItem } from '../types/emby.types';
import { Header } from './Header';
import { Footer } from './Footer';
// Inline skeletons replace full-screen loading

interface FilterState {
  sortBy: string;
  sortOrder: string;
  genres: string[];
  years: (number | 'Before 1980')[];
  seasonCounts: (number | '10+')[];
}

// Item Card with image loading animation
function ItemCard({ item, imageUrl, onItemClick, isFavorite, isFavChanging, onToggleFavorite, index }: {
  item: EmbyItem;
  imageUrl: string;
  onItemClick: (item: EmbyItem) => void;
  isFavorite?: boolean;
  isFavChanging?: boolean;
  onToggleFavorite?: (item: EmbyItem) => void;
  index: number;
}) {
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={() => onItemClick(item)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="cursor-pointer group text-left w-full transition-all duration-300 soft-appear"
      style={{ animationDelay: `${Math.min(index * 60, 900)}ms` }}
    >
      <div className={`relative aspect-[2/3] bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg mb-3 shadow-2xl transition-all duration-300 ${
        isHovered ? 'scale-105 shadow-black/80 ring-2 ring-white/20' : 'shadow-black/40'
      }`}>
        <div className="absolute inset-0 overflow-hidden rounded-lg">
        {imageUrl ? (
          <>
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
                  {item.Type === 'Series' && item.ChildCount && (
                    <p className="text-xs text-blue-300 mb-2">
                      {item.ChildCount} Season{item.ChildCount !== 1 ? 's' : ''}
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
        {(item.Type === 'Series' || item.Type === 'Movie') && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite && onToggleFavorite(item); }}
            onPointerDown={(e) => { e.stopPropagation(); }}
            disabled={isFavChanging}
            style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', left: 'auto' }}
            aria-label={isFavorite ? `Unfavorite ${item.Name}` : `Favorite ${item.Name}`}
            title={isFavorite ? 'Unfavorite' : 'Favorite'}
            className={`z-50 p-2 rounded-full backdrop-blur-sm transition-all duration-200 flex items-center justify-center ${
              isFavChanging ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'
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

      {/* Title - simple like Home screen */}
      <div className="px-1">
        <h3 className={`text-white font-medium text-sm line-clamp-1 transition-colors duration-200 ${
          isHovered ? 'text-white' : 'text-gray-300'
        }`}>
          {item.Name}
        </h3>
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
}: {
  label: string;
  options: (string | number)[];
  selected: (string | number)[];
  onChange: (selected: (string | number)[]) => void;
  placeholder: string;
  renderOption?: (option: string | number) => string;
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
        className="w-full h-10 px-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 text-left flex items-center justify-between whitespace-nowrap"
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

// Single-select dropdown component
function SingleSelect({
  label,
  options,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  options: { v: string; l: string }[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
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
        className="w-full h-10 px-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 text-left flex items-center justify-between"
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

  // Toast notification for Add-to-Home actions
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
      // Show toast indicating section is already on Home
      setHomeAddToast({ id: match.id, message: 'Already on Home' });
      setTimeout(() => setHomeAddToast(null), 2200);
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
    // Show success toast
    setHomeAddToast({ id: section.id, message: 'Added to Home' });
    setTimeout(() => setHomeAddToast(null), 2200);
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
  const { totalPages, paginatedItems } = useMemo(() => {
    const total = Math.max(1, Math.ceil((totalCount || 0) / itemsPerPage));
    // items already represent the current server page; still apply client-side refinement
    const paginated = filteredItems;
    return { totalPages: total, paginatedItems: paginated };
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

  // Main UI
  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <Header />

      <div className="max-w-[1800px] mx-auto px-8 pb-16 pt-24">
        {/* Page Title and Controls */}
        <div className="mb-8">

          <div className="flex items-center gap-4 mb-6">
            <div className="flex bg-white/10 rounded-lg p-1">
              <button
                onClick={() => navigate('/browse?type=Movie')}
                className={`px-6 h-12 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center justify-center ${
                  mediaType === 'Movie' ? 'bg-white text-black' : 'text-gray-300 hover:text-white'
                }`}
              >
                Movies
              </button>
              <button
                onClick={() => navigate('/browse?type=Series')}
                className={`px-6 h-12 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center justify-center ${
                  mediaType === 'Series' ? 'bg-white text-black' : 'text-gray-300 hover:text-white'
                }`}
              >
                TV Shows
              </button>
            </div>
            <div className="flex-1 relative">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 h-12 bg-white/10 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Saved Filters */}
          {savedFilters.length > 0 && (
            <div className="mb-6 p-4 rounded-xl border border-white/10 bg-white/5">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Saved Filters</h3>
              <div className="flex flex-wrap gap-2">
                {savedFilters.map((sf) => (
                  <div
                    key={sf.id}
                    className="group flex items-center gap-2 pl-4 pr-2 py-2 bg-white/10 hover:bg-white/15 rounded-lg transition-all duration-200 border border-white/10"
                  >
                    <button
                      onClick={() => applySavedFilter(sf)}
                      className="text-sm text-white hover:text-blue-300 transition-colors font-medium"
                    >
                      {sf.name}
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => addSavedFilterToHome(sf)}
                        title="Add to Home screen"
                        className="p-1.5 rounded-md text-gray-400 hover:text-green-400 hover:bg-green-500/10 transition-all duration-200"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                      <button
                        onClick={() => removeSavedFilter(sf.id)}
                        title="Remove saved filter"
                        className="p-1.5 rounded-md text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="p-6 rounded-xl border border-white/10 bg-white/5">
            <div className="flex flex-wrap items-end gap-4">
              {/* Genre */}
              <div className="w-full sm:w-56">
                <MultiSelect
                  label="Genre"
                  options={genres}
                  selected={filters.genres}
                  onChange={(selected) => setFilters({ ...filters, genres: selected as string[] })}
                  placeholder="All Genres"
                />
              </div>
              {/* Year */}
              <div className="w-full sm:w-44">
                <MultiSelect
                  label="Year"
                  options={years}
                  selected={filters.years}
                  onChange={(selected) => setFilters({ ...filters, years: selected as (number | 'Before 1980')[] })}
                  placeholder="All Years"
                  renderOption={(opt) => (typeof opt === 'number' ? String(opt) : 'Before 1980')}
                />
              </div>
              {/* Seasons (Series only) */}
              {mediaType === 'Series' && (
                <div className="w-full sm:w-48">
                  <MultiSelect
                    label="Seasons"
                    options={seasonCountOptions}
                    selected={filters.seasonCounts}
                    onChange={(selected) => setFilters({ ...filters, seasonCounts: selected as (number | '10+')[] })}
                    placeholder="All"
                    renderOption={(opt) => (typeof opt === 'number' ? `${opt} Season${opt !== 1 ? 's' : ''}` : `${opt} Seasons`)}
                  />
                </div>
              )}
              <div className="w-full lg:flex-1 min-w-[220px]">
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
                />
              </div>
              <div className="w-full sm:w-auto min-w-[180px]">
                <SingleSelect
                  label="Order"
                  options={[
                    { v: 'Descending', l: 'Desc' },
                    { v: 'Ascending', l: 'Asc' },
                  ]}
                  value={filters.sortOrder}
                  onChange={(v) => setFilters({ ...filters, sortOrder: v })}
                  placeholder="Select"
                />
              </div>
              {/* Actions */}
              <div className="flex items-end gap-3 ml-auto">
                <button
                  onClick={saveCurrentFilters}
                  title="Save current filters"
                  disabled={!hasAnyFilterApplied(filters, searchTerm)}
                  className={`px-4 h-10 text-sm rounded-md transition-colors whitespace-nowrap ${hasAnyFilterApplied(filters, searchTerm) ? 'text-gray-200 bg-white/6 hover:bg-white/10' : 'text-gray-600 bg-transparent opacity-40 cursor-not-allowed'}`}
                >
                  Save Filter
                </button>
                <button
                  onClick={clearFilters}
                  className="px-6 h-10 text-sm text-gray-400 hover:text-white transition-colors whitespace-nowrap"
                >
                  Clear All
                </button>
                <button
                  onClick={applyFilters}
                  className="px-8 h-10 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white text-sm font-semibold rounded-xl shadow whitespace-nowrap"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-gray-400 text-sm flex items-center">
            <span>
              {totalCount} {totalCount === 1 ? 'result' : 'results'}
              {totalPages > 1 && (
                <span className="ml-2">
                  • Page {currentPage} of {totalPages}
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
        {isLoading ? (
          <div className="max-w-[1800px] mx-auto px-8 py-6">
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
                  <div className="aspect-[2/3] rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 animate-pulse mb-3" />
                  <div className="h-4 bg-white/10 rounded w-10/12 mb-2 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20">
            <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
            <p className="text-gray-400 text-lg mb-2">No items found</p>
            <p className="text-gray-600 text-sm">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-6">
              {paginatedItems.map((item, index) => {
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
                  index={index}
                />
              );
            })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-12 flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-4 py-3 rounded-lg bg-white/10 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/20 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-3 rounded-lg bg-white/10 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/20 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <div className="flex items-center gap-2">
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
                        className={`w-12 h-12 rounded-lg font-medium transition-colors ${
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
                  className="px-4 py-3 rounded-lg bg-white/10 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/20 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-3 rounded-lg bg-white/10 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/20 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Toast Notifications */}
      {homeAddToast && (
        <div className="fixed bottom-8 right-8 z-50 animate-fade-in">
          <div className="bg-green-500/90 backdrop-blur-sm text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3">
            <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">{homeAddToast.message}</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <Footer />
    </div>
  );
}
