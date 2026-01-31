import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { embyApi } from '../services/embyApi';
import { deduplicateItems } from '../services/deduplication';
import { useTVNavigation } from '../hooks/useTVNavigation';
import type { EmbyItem } from '../types/emby.types';
import { LoadingScreen } from './LoadingScreen';

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
  years: number[];
  seasonCounts: number[];
}

// Item Card with image loading animation
function ItemCard({ item, imageUrl, onItemClick }: { 
  item: EmbyItem; 
  imageUrl: string; 
  onItemClick: (item: EmbyItem) => void;
}) {
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const versionCount = (item.AlternateVersions?.length ?? 0) + 1;

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
    </button>
  );
}


// Multi-select dropdown component
function MultiSelect({ 
  label, 
  options, 
  selected, 
  onChange, 
  placeholder,
  renderOption 
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
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 text-left flex items-center justify-between"
      >
        <span className={selected.length === 0 ? 'text-gray-500' : ''}>{displayText}</span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {selected.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="w-full px-3 py-2 text-left text-sm text-blue-400 hover:bg-gray-700 border-b border-gray-700"
            >
              Clear selection
            </button>
          )}
          {options.map((option) => (
            <button
              key={option}
              onClick={() => toggleOption(option)}
              className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-700 flex items-center gap-2"
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

export function Browse() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  useTVNavigation();
  
  const mediaType = searchParams.get('type') || 'Movie'; // 'Movie' or 'Series'
  
  const [items, setItems] = useState<EmbyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showContent, setShowContent] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [genres, setGenres] = useState<string[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [seasonCounts, setSeasonCounts] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;
  const [filters, setFilters] = useState<FilterState>({
    sortBy: 'PremiereDate',
    sortOrder: 'Descending',
    genres: [],
    years: [],
    seasonCounts: [],
  });
  const [showFilters, setShowFilters] = useState(false);

  // Initialize genre filter from URL parameter
  useEffect(() => {
    const genreParam = searchParams.get('genre');
    if (genreParam) {
      setFilters(prev => ({
        ...prev,
        genres: [genreParam]
      }));
      setShowFilters(true); // Show filters panel when coming from a genre click
    }
  }, [searchParams]);

  useEffect(() => {
    loadItems();
    loadFilterOptions();
  }, [mediaType]);

  const applyFilters = () => {
    setCurrentPage(1);
    loadItems();
  };

  // Fetch all items via pagination to avoid server-side page caps
  const fetchAllItems = async (baseParams: any): Promise<EmbyItem[]> => {
    const pageSize = 1000;
    let startIndex = 0;
    let all: EmbyItem[] = [];
    while (true) {
      const res = await embyApi.getItems({
        ...baseParams,
        startIndex,
        limit: pageSize,
      });
      if (res.Items && res.Items.length) {
        all = all.concat(res.Items as EmbyItem[]);
      }
      if (!res.Items || res.Items.length < pageSize) break;
      startIndex += pageSize;
    }
    return all;
  };

  const loadItems = async () => {
    try {
      setIsLoading(true);
      
      const params: any = {
        recursive: true,
        includeItemTypes: mediaType,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        // limit intentionally small; we will paginate
      };

      if (filters.genres.length > 0) {
        params.genres = filters.genres.join(',');
      }

      if (filters.years.length > 0) {
        params.years = filters.years.join(',');
      }

      // Fetch all pages to ensure we truly have everything
      const allItems = await fetchAllItems(params);
      
      // Deduplicate items that exist in multiple libraries
      let deduplicatedItems = deduplicateItems(allItems);
      
      // Filter by season count client-side if needed (only for Series)
      let filteredItems = deduplicatedItems;
      if (mediaType === 'Series' && filters.seasonCounts.length > 0) {
        filteredItems = filteredItems.filter(item => {
          const childCount = (item as any).ChildCount;
          if (childCount === undefined || childCount === null) return false;
          // Convert both to numbers for comparison to handle any type mismatches
          return filters.seasonCounts.some(count => Number(count) === Number(childCount));
        });
      }
      
      // If user entered a search term, also ask server to search (more robust)
      if (searchTerm.trim().length > 0) {
        const searchItems = await fetchAllItems({
          recursive: true,
          includeItemTypes: mediaType,
          searchTerm: searchTerm.trim(),
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
        });
        filteredItems = deduplicateItems([...filteredItems, ...searchItems]);
      }

      setItems(filteredItems);
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFilterOptions = async () => {
    try {
      // Get genres from the Emby API
      const genresResponse = await embyApi.getGenres({ includeItemTypes: mediaType });
      setGenres(genresResponse.Items.map(g => g.Name));

      // Get all items to extract unique years and season counts
      const responseItems = await fetchAllItems({
        recursive: true,
        includeItemTypes: mediaType,
        fields: 'ProductionYear,ChildCount',
      });

      // Extract unique years
      const allYears = new Set<number>();
      const allSeasonCounts = new Set<number>();
      responseItems.forEach(item => {
        if (item.ProductionYear) {
          allYears.add(item.ProductionYear);
        }
        if (mediaType === 'Series' && (item as any).ChildCount) {
          allSeasonCounts.add((item as any).ChildCount);
        }
      });
      setYears(Array.from(allYears).sort((a, b) => b - a));
      setSeasonCounts(Array.from(allSeasonCounts).sort((a, b) => a - b));
    } catch (error) {
      console.error('Failed to load filter options:', error);
    }
  };

  const handleItemClick = (item: EmbyItem) => {
    navigate(`/details/${item.Id}`);
  };

  const filteredItems = useMemo(() => 
    items.filter((item) =>
      item.Name.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [items, searchTerm]
  );

  // Pagination calculations
  const { totalPages, paginatedItems, startIndex, endIndex } = useMemo(() => {
    const total = Math.ceil(filteredItems.length / itemsPerPage);
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const paginated = filteredItems.slice(startIdx, endIdx);
    return { totalPages: total, paginatedItems: paginated, startIndex: startIdx, endIndex: endIdx };
  }, [filteredItems, currentPage, itemsPerPage]);

  // Reset to page 1 if current page exceeds total pages
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [filteredItems.length, currentPage, totalPages]);

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

  const activeFiltersCount = [
    filters.genres.length > 0,
    filters.years.length > 0,
    filters.seasonCounts.length > 0,
    filters.sortBy !== 'PremiereDate' || filters.sortOrder !== 'Descending',
  ].filter(Boolean).length;

  if (isLoading) {
    return <LoadingScreen isVisible={true} />;
  }

  // Trigger content fade in after loading completes
  if (!showContent) {
    setTimeout(() => setShowContent(true), 50);
  }

  return (
    <div className={`min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 transition-opacity duration-500 ${showContent ? 'opacity-100' : 'opacity-0'}`}>
      {/* Header */}
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
            <h1 className="text-2xl font-bold text-white">
              {mediaType === 'Movie' ? 'Movies' : 'TV Shows'}
            </h1>
          </div>

          {/* Type Toggle */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex bg-white/10 rounded-lg p-1">
              <button
                onClick={() => navigate('/browse?type=Movie')}
                tabIndex={0}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all focusable-tab ${
                  mediaType === 'Movie'
                    ? 'bg-white text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Movies
              </button>
              <button
                onClick={() => navigate('/browse?type=Series')}
                tabIndex={0}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all focusable-tab ${
                  mediaType === 'Series'
                    ? 'bg-white text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                TV Shows
              </button>
            </div>
          </div>

          {/* Search and Filter Row */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
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
                className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focusable-item"
              />
            </div>

            {/* Filter Toggle Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              tabIndex={0}
              className={`px-4 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all focusable-item ${
                showFilters || activeFiltersCount > 0
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
              {activeFiltersCount > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="mt-4 p-4 bg-white/5 rounded-xl border border-gray-800">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {/* Sort By */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Sort By</label>
                  <select
                    value={filters.sortBy}
                    onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="PremiereDate">Release Date</option>
                    <option value="SortName">Name</option>
                    <option value="DateCreated">Date Added</option>
                    <option value="CommunityRating">Rating</option>
                    <option value="Runtime">Runtime</option>
                  </select>
                </div>

                {/* Sort Order */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Order</label>
                  <select
                    value={filters.sortOrder}
                    onChange={(e) => setFilters({ ...filters, sortOrder: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="Descending">Descending</option>
                    <option value="Ascending">Ascending</option>
                  </select>
                </div>

                {/* Genre - Multi-select */}
                <MultiSelect
                  label="Genre"
                  options={genres}
                  selected={filters.genres}
                  onChange={(selected) => setFilters({ ...filters, genres: selected as string[] })}
                  placeholder="All Genres"
                />

                {/* Year - Multi-select */}
                <MultiSelect
                  label="Year"
                  options={years}
                  selected={filters.years}
                  onChange={(selected) => setFilters({ ...filters, years: selected as number[] })}
                  placeholder="All Years"
                />

                {/* Season Count - Multi-select (only for TV Shows) */}
                {mediaType === 'Series' && seasonCounts.length > 0 && (
                  <MultiSelect
                    label="Seasons"
                    options={seasonCounts}
                    selected={filters.seasonCounts}
                    onChange={(selected) => setFilters({ ...filters, seasonCounts: selected as number[] })}
                    placeholder="All"
                    renderOption={(count) => `${count} Season${count !== 1 ? 's' : ''}`}
                  />
                )}
              </div>

              {/* Filter Actions */}
              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Clear All
                </button>
                <button
                  onClick={applyFilters}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Results Count */}
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <p className="text-gray-400 text-sm">
          {filteredItems.length} {filteredItems.length === 1 ? 'result' : 'results'}
          {totalPages > 1 && (
            <span className="ml-2">
              • Showing {startIndex + 1}-{Math.min(endIndex, filteredItems.length)} (Page {currentPage} of {totalPages})
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
