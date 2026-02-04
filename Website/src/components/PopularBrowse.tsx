import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { embyApi } from '../services/embyApi';
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

export function PopularBrowse() {
  const navigate = useNavigate();
  const { type } = useParams<{ type: 'movies' | 'tv' }>();
  const [items, setItems] = useState<EmbyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const backButtonRef = useRef<HTMLButtonElement>(null);

  useTVNavigation({
    onBack: () => {
      navigate('/home');
      return true;
    }
  });

  useEffect(() => {
    // Load items from sessionStorage
    const storageKey = type === 'movies' ? 'popular_movies_all' : 'popular_tv_all';
    const stored = sessionStorage.getItem(storageKey);
    
    if (stored) {
      try {
        setItems(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse popular items:', e);
      }
    }
    
    setIsLoading(false);
    
    // Focus back button after load
    setTimeout(() => {
      backButtonRef.current?.focus();
    }, 100);
  }, [type]);

  const handleItemClick = (item: EmbyItem) => {
    navigate(`/details/${item.Id}`, { state: { mediaType: item.Type } });
  };

  const title = type === 'movies' ? 'Popular Movies' : 'Popular TV Shows';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
        <div className="sticky top-0 z-50 bg-gray-950/90 backdrop-blur-md border-b border-gray-800">
          <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-white/10" />
            <div className="h-7 w-56 bg-white/10 rounded animate-pulse" />
            <div className="ml-auto h-5 w-40 bg-white/10 rounded animate-pulse" />
          </div>
        </div>
        <div className="max-w-[1600px] mx-auto px-6 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-6">
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i}>
                <div className="aspect-[2/3] rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 animate-pulse mb-3" />
                <div className="h-4 bg-white/10 rounded w-10/12 mb-2 animate-pulse" />
                <div className="h-3 bg-white/10 rounded w-6/12 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
        <div className="h-20" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gray-950/90 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center gap-4">
          <button
            ref={backButtonRef}
            onClick={() => navigate('/home')}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors focusable-item"
            tabIndex={0}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <h1 className="text-2xl font-bold text-white">{title}</h1>
          </div>
          <div className="ml-auto text-gray-400 text-sm">
            {items.length} {items.length === 1 ? 'item' : 'items'} in your library
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="max-w-[1600px] mx-auto px-6 py-8">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-lg">No popular {type === 'movies' ? 'movies' : 'TV shows'} found in your library</p>
            <p className="text-sm mt-2">Items shown here are based on TMDB's popularity rankings</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-6">
            {items.map((item, index) => (
              <MediaCard 
                key={`${item.Id}-${index}`} 
                item={item} 
                onItemClick={handleItemClick} 
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom spacing for TV */}
      <div className="h-20" />
    </div>
  );
}

// Media Card component for the grid
function MediaCard({ item, onItemClick }: { item: EmbyItem; onItemClick: (item: EmbyItem) => void }) {
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  
  const imageUrl = item.ImageTags?.Primary
    ? embyApi.getImageUrl(item.Id, 'Primary', { maxWidth: 300, tag: item.ImageTags.Primary })
    : '';

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
      className="text-left cursor-pointer group focusable-card"
    >
      <div className="relative aspect-[2/3] bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl overflow-hidden mb-3 shadow-xl shadow-black/40 ring-1 ring-white/5">
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
              className={`w-full h-full object-cover group-hover:scale-110 transition-all duration-500 ease-out ${
                isImageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <svg className="w-16 h-16 opacity-30" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
            </svg>
          </div>
        )}
      </div>
      <div className="px-1">
        <h3
          className="text-white font-semibold text-sm line-clamp-1 group-hover:text-blue-400 transition-colors"
          title={item.Name}
        >
          {item.Name}
        </h3>
        <div className="flex items-center gap-2 text-xs text-gray-400 mt-1 flex-wrap">
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
          {item.OfficialRating && (
            <span className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-gray-300 text-[10px] font-medium">
              {item.OfficialRating}
            </span>
          )}
          {item.CommunityRating && (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {item.CommunityRating.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
