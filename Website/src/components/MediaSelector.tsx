import type { MediaSource, MediaStream } from '../types/emby.types';

interface MediaSelectorProps {
  mediaSources: MediaSource[];
  onSelect: (mediaSource: MediaSource) => void;
  onCancel: () => void;
}

export function MediaSelector({ mediaSources, onSelect, onCancel }: MediaSelectorProps) {
  const formatFileSize = (bytes: number): string => {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatBitrate = (bitrate: number): string => {
    const mbps = bitrate / 1000000;
    return `${mbps.toFixed(1)} Mbps`;
  };

  const getAudioInfo = (streams: MediaStream[]): string => {
    const audioStreams = streams.filter((s) => s.Type === 'Audio');
    if (audioStreams.length === 0) return 'No Audio';

    const defaultAudio = audioStreams.find((s) => s.IsDefault) || audioStreams[0];
    const channels = defaultAudio.Channels ? `${defaultAudio.Channels}.0` : '';
    const codec = defaultAudio.Codec?.toUpperCase() || '';
    const language = defaultAudio.Language ? ` (${defaultAudio.Language})` : '';

    return `${channels} ${codec}${language}`;
  };

  if (mediaSources.length === 1) {
    // Auto-select if only one source
    onSelect(mediaSources[0]);
    return null;
  }

  const getQualityBadge = (streams: MediaStream[]): { label: string; color: string } => {
    const videoStream = streams.find((s) => s.Type === 'Video');
    if (!videoStream?.Height) return { label: 'SD', color: 'text-gray-400 bg-gray-800' };
    
    if (videoStream.Height >= 2160) return { label: '4K', color: 'text-yellow-400 bg-yellow-900/30' };
    if (videoStream.Height >= 1080) return { label: '1080p', color: 'text-blue-400 bg-blue-900/30' };
    if (videoStream.Height >= 720) return { label: '720p', color: 'text-green-400 bg-green-900/30' };
    return { label: '480p', color: 'text-gray-400 bg-gray-800' };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="bg-gray-900/95 backdrop-blur-md rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900/95 backdrop-blur-md border-b border-white/10 p-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Select Version</h2>
            <p className="text-gray-400 text-sm mt-1">{mediaSources.length} versions available</p>
          </div>
        </div>

        {/* Version list */}
        <div className="p-4 space-y-3 overflow-y-auto max-h-[calc(85vh-140px)]">
          {mediaSources.map((source) => {
            const quality = getQualityBadge(source.MediaStreams);
            const videoStream = source.MediaStreams.find((s) => s.Type === 'Video');
            
            return (
              <button
                key={source.Id}
                onClick={() => onSelect(source)}
                tabIndex={0}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/50 rounded-xl p-4 text-left transition-all duration-200 group"
              >
                <div className="flex items-center gap-4">
                  {/* Quality badge */}
                  <div className={`flex-shrink-0 px-3 py-2 rounded-lg font-bold text-sm ${quality.color}`}>
                    {quality.label}
                  </div>
                  
                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-semibold">
                        {videoStream?.Codec?.toUpperCase() || 'Unknown'}
                        {videoStream?.Profile && <span className="text-gray-400 font-normal"> {videoStream.Profile}</span>}
                      </span>
                      {source.SupportsDirectStream && (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full font-medium">
                          Direct
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      <span>{videoStream?.Width}x{videoStream?.Height}</span>
                      <span>•</span>
                      <span>{formatBitrate(source.Bitrate)}</span>
                      <span>•</span>
                      <span>{formatFileSize(source.Size)}</span>
                      <span className="hidden sm:inline">•</span>
                      <span className="hidden sm:inline uppercase">{source.Container}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {getAudioInfo(source.MediaStreams)}
                    </div>
                  </div>
                  
                  {/* Arrow */}
                  <div className="flex-shrink-0 text-gray-500 group-hover:text-blue-400 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-900/95 backdrop-blur-md border-t border-white/10 p-4">
          <button
            onClick={onCancel}
            tabIndex={0}
            className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all duration-200 font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
