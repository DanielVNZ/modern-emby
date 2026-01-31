import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { embyApi } from '../services/embyApi';
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

export function Library() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  useTVNavigation();
  const [items, setItems] = useState<EmbyItem[]>([]);
  const [parentItem, setParentItem] = useState<EmbyItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('SortName');

  useEffect(() => {
    if (id) {
      loadLibrary();
    }
  }, [id, sortBy]);

  const loadLibrary = async () => {
    try {
      setIsLoading(true);
      
      // Get items in this library/folder
      const response = await embyApi.getItems({
        parentId: id,
        recursive: true,
        includeItemTypes: 'Movie,Series',
        sortBy: sortBy,
        sortOrder: 'Ascending',
      });

      setItems(response.Items);

      // If viewing a specific item, get its details for the header
      if (id) {
        const allItems = await embyApi.getItems({ parentId: undefined });
        const parent = allItems.Items.find((item) => item.Id === id);
        if (parent) setParentItem(parent);
      }
    } catch (error) {
      console.error('Failed to load library:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredItems = useMemo(() => 
    items.filter((item) =>
      item.Name.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [items, searchTerm]
  );

  const handleItemClick = (item: EmbyItem) => {
    if (item.Type === 'Series') {
      // For TV series, navigate to show the seasons/episodes
      navigate(`/library/${item.Id}`);
    } else {
      // For movies, go to player
      navigate(`/player/${item.Id}`);
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-dark-card/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate('/home')}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-bold text-white">
              {parentItem?.Name || 'Library'}
            </h1>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 bg-dark-bg border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 bg-dark-bg border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="SortName">Name</option>
              <option value="DateCreated">Date Added</option>
              <option value="PremiereDate">Release Date</option>
              <option value="CommunityRating">Rating</option>
            </select>
          </div>
        </div>
      </header>

      {/* Content Grid */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {filteredItems.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            No items found
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredItems.map((item) => {
              const imageUrl = item.ImageTags?.Primary
                ? embyApi.getImageUrl(item.Id, 'Primary', { maxWidth: 300, tag: item.ImageTags.Primary })
                : '';

              return (
                <button
                  key={item.Id}
                  onClick={() => handleItemClick(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleItemClick(item);
                    }
                  }}
                  tabIndex={0}
                  className="cursor-pointer group focusable-card text-left w-full"
                >
                  <div className="relative aspect-[2/3] bg-dark-hover rounded-lg overflow-hidden mb-2">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={item.Name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600">
                        No Image
                      </div>
                    )}
                    {item.UserData?.PlaybackPositionTicks && item.RunTimeTicks && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
                        <div
                          className="h-full bg-blue-600"
                          style={{
                            width: `${(item.UserData.PlaybackPositionTicks / item.RunTimeTicks) * 100}%`,
                          }}
                        />
                      </div>
                    )}
                    {item.UserData?.Played && (
                      <div className="absolute top-2 right-2 bg-blue-600 rounded-full p-1">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <h3 className="text-white font-medium text-sm mb-1 line-clamp-2">
                    {item.Name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
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
                      <span className="px-1.5 py-0.5 border border-gray-600 rounded">
                        {item.OfficialRating}
                      </span>
                    )}
                  </div>
                  {item.CommunityRating && (
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-yellow-500">★</span>
                      <span className="text-xs text-gray-400">
                        {item.CommunityRating.toFixed(1)}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
