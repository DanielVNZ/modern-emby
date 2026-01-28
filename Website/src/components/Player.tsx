import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Hls from 'hls.js';
import { embyApi } from '../services/embyApi';
import { MediaSelector } from './MediaSelector';
import { LoadingScreen } from './LoadingScreen';
import { usePlayerTVNavigation } from '../hooks/useTVNavigation';
import type { MediaSource, EmbyItem } from '../types/emby.types';

export function Player() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [item, setItem] = useState<EmbyItem | null>(null);
  const [mediaSources, setMediaSources] = useState<MediaSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<MediaSource | null>(null);
  const [playSessionId, setPlaySessionId] = useState<string>('');
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [showSelector, setShowSelector] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [selectedAudioIndex, setSelectedAudioIndex] = useState<number | undefined>();
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState<number | null>(null);
  const [error, setError] = useState<string>('');
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPercentage, setBufferedPercentage] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const [isHoveringSeekBar, setIsHoveringSeekBar] = useState(false);
  const [hoverTime, setHoverTime] = useState(0);
  const [hoverPosition, setHoverPosition] = useState(0);
  const [resumePosition, setResumePosition] = useState<number>(0);
  const [prevEpisode, setPrevEpisode] = useState<EmbyItem | null>(null);
  const [nextEpisode, setNextEpisode] = useState<EmbyItem | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [showUpNext, setShowUpNext] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<{
    videoResolution: string;
    currentBitrate: number;
    bufferHealth: number;
    droppedFrames: number;
    totalFrames: number;
    downloadSpeed: number;
    latency: number;
    codec: string;
    audioCodec: string;
    container: string;
    hlsLatency: number;
    bandwidth: number;
  }>({
    videoResolution: '',
    currentBitrate: 0,
    bufferHealth: 0,
    droppedFrames: 0,
    totalFrames: 0,
    downloadSpeed: 0,
    latency: 0,
    codec: '',
    audioCodec: '',
    container: '',
    hlsLatency: 0,
    bandwidth: 0,
  });
  const statsIntervalRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const lastReportedTimeRef = useRef<number>(0);

  useEffect(() => {
    if (id) {
      // Clean up previous playback session before loading new one
      if (hlsRef.current) {
        console.log('Destroying previous HLS instance');
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (progressIntervalRef.current) {
        console.log('Clearing previous progress interval');
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      
      // Reset state for new video
      setStreamUrl('');
      setSelectedSource(null);
      setError('');
      setIsLoading(true);
      
      loadPlaybackInfo();
    }
    
    return () => {
      // Report playback stopped when component unmounts
      if (selectedSource && videoRef.current) {
        const positionTicks = Math.floor(videoRef.current.currentTime * 10000000);
        embyApi.reportPlaybackStopped({
          ItemId: id!,
          MediaSourceId: selectedSource.Id,
          PlaySessionId: playSessionId,
          PositionTicks: positionTicks,
        }).catch(err => console.error('Failed to report playback stopped:', err));
      }
      
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [id]);

  // Effect to collect stats for nerds
  useEffect(() => {
    if (showStats) {
      const collectStats = () => {
        const video = videoRef.current;
        const hls = hlsRef.current;
        
        if (!video) return;
        
        // Get video quality info
        const videoTrack = selectedSource?.MediaStreams?.find(s => s.Type === 'Video');
        const audioTrack = selectedSource?.MediaStreams?.find(s => s.Type === 'Audio');
        
        // Calculate buffer health (seconds of buffered content ahead)
        let bufferHealth = 0;
        if (video.buffered.length > 0) {
          for (let i = 0; i < video.buffered.length; i++) {
            if (video.buffered.start(i) <= video.currentTime && video.buffered.end(i) >= video.currentTime) {
              bufferHealth = video.buffered.end(i) - video.currentTime;
              break;
            }
          }
        }
        
        // Get dropped frames if available
        let droppedFrames = 0;
        let totalFrames = 0;
        if ('getVideoPlaybackQuality' in video) {
          const quality = (video as any).getVideoPlaybackQuality();
          droppedFrames = quality.droppedVideoFrames || 0;
          totalFrames = quality.totalVideoFrames || 0;
        }
        
        // Get HLS-specific stats
        let bandwidth = 0;
        let hlsLatency = 0;
        if (hls) {
          bandwidth = hls.bandwidthEstimate || 0;
          if (hls.latency) {
            hlsLatency = hls.latency;
          }
        }
        
        setStats({
          videoResolution: videoTrack ? `${videoTrack.Width}x${videoTrack.Height}` : `${video.videoWidth}x${video.videoHeight}`,
          currentBitrate: selectedSource?.Bitrate || 0,
          bufferHealth: Math.round(bufferHealth * 10) / 10,
          droppedFrames,
          totalFrames,
          downloadSpeed: bandwidth,
          latency: hlsLatency,
          codec: videoTrack?.Codec?.toUpperCase() || 'Unknown',
          audioCodec: audioTrack?.Codec?.toUpperCase() || 'Unknown',
          container: selectedSource?.Container?.toUpperCase() || 'Unknown',
          hlsLatency,
          bandwidth,
        });
      };
      
      collectStats(); // Initial collection
      statsIntervalRef.current = window.setInterval(collectStats, 1000);
      
      return () => {
        if (statsIntervalRef.current) {
          clearInterval(statsIntervalRef.current);
          statsIntervalRef.current = null;
        }
      };
    }
  }, [showStats, selectedSource]);

  // Effect to show "Up Next" popup when within 2 minutes of end
  useEffect(() => {
    if (nextEpisode && duration > 0 && currentTime > 0) {
      const timeRemaining = duration - currentTime;
      const twoMinutes = 120; // 2 minutes in seconds
      
      if (timeRemaining <= twoMinutes && timeRemaining > 0) {
        setShowUpNext(true);
      } else {
        setShowUpNext(false);
      }
    } else {
      setShowUpNext(false);
    }
  }, [currentTime, duration, nextEpisode]);

  // Effect to manage subtitle track visibility
  useEffect(() => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    const textTracks = video.textTracks;
    
    // Set all tracks to hidden first
    for (let i = 0; i < textTracks.length; i++) {
      textTracks[i].mode = 'hidden';
    }
    
    // If a subtitle is selected, find and enable the matching track
    if (selectedSubtitleIndex !== null && textTracks.length > 0) {
      // Find the track that matches our selected subtitle
      for (let i = 0; i < textTracks.length; i++) {
        const track = textTracks[i];
        // Enable the track if it exists
        if (i === 0) { // We only render one track at a time based on selectedSubtitleIndex
          track.mode = 'showing';
          
          // Force track to reload if it hasn't loaded cues yet
          if (track.cues === null || (track.cues && track.cues.length === 0)) {
            // Track hasn't loaded, give it a moment
            setTimeout(() => {
              if (track.mode === 'showing' && (!track.cues || track.cues.length === 0)) {
                console.log('Subtitle track failed to load, attempting to reload');
                // Try to force reload by toggling mode
                track.mode = 'disabled';
                setTimeout(() => { track.mode = 'showing'; }, 50);
              }
            }, 500);
          }
        }
      }
    }
  }, [selectedSubtitleIndex, streamUrl]); // Also depend on streamUrl to re-apply when video changes

  // Effect to handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Effect to close menus on Escape/Back
  useEffect(() => {
    const handleMenuClose = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'GoBack') {
        if (showAudioMenu || showSubtitleMenu) {
          e.preventDefault();
          e.stopPropagation();
          setShowAudioMenu(false);
          setShowSubtitleMenu(false);
        }
      }
    };

    window.addEventListener('keydown', handleMenuClose, true);
    return () => window.removeEventListener('keydown', handleMenuClose, true);
  }, [showAudioMenu, showSubtitleMenu]);

  // Effect to auto-focus first menu item when audio/subtitle menu opens
  useEffect(() => {
    if (showAudioMenu || showSubtitleMenu) {
      // Small delay to let the menu render
      setTimeout(() => {
        const menuItem = document.querySelector('[role="menu"] [role="menuitem"]') as HTMLElement;
        if (menuItem) {
          menuItem.focus();
        }
      }, 50);
    }
  }, [showAudioMenu, showSubtitleMenu]);

  // Effect to handle video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    const updateTime = () => {
      setCurrentTime(video.currentTime);
      // Update buffered amount - find the range containing current time
      updateBufferedPercentage();
    };
    const updateDuration = () => {
      setDuration(video.duration);
      setIsPlaying(!video.paused);
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };
    const handleProgress = () => {
      updateBufferedPercentage();
    };
    
    const handleWaiting = () => {
      setIsVideoLoading(true);
    };
    
    const handleCanPlay = () => {
      setIsVideoLoading(false);
    };
    
    const handleLoadedData = () => {
      setIsVideoLoading(false);
    };

    const updateBufferedPercentage = () => {
      if (video.buffered.length > 0) {
        const currentTime = video.currentTime;
        const duration = video.duration;
        
        if (duration > 0) {
          // Find the buffered range that contains the current time
          let bufferedEnd = 0;
          for (let i = 0; i < video.buffered.length; i++) {
            const start = video.buffered.start(i);
            const end = video.buffered.end(i);
            
            // Check if current time is within this buffered range
            if (currentTime >= start && currentTime <= end) {
              bufferedEnd = end;
              break;
            }
            // If current time is before this range, use the end of this range
            if (currentTime < start) {
              bufferedEnd = end;
              break;
            }
          }
          
          // If no range contains current time, use the last range's end
          if (bufferedEnd === 0 && video.buffered.length > 0) {
            bufferedEnd = video.buffered.end(video.buffered.length - 1);
          }
          
          setBufferedPercentage((bufferedEnd / duration) * 100);
        }
      } else {
        setBufferedPercentage(0);
      }
    };

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('durationchange', updateDuration);
    video.addEventListener('loadedmetadata', updateDuration);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('progress', handleProgress);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('loadeddata', handleLoadedData);

    // Initialize state
    if (video.duration) {
      setDuration(video.duration);
      setCurrentTime(video.currentTime);
      setIsPlaying(!video.paused);
    }

    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('durationchange', updateDuration);
      video.removeEventListener('loadedmetadata', updateDuration);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('loadeddata', handleLoadedData);
    };
  }, [streamUrl]);

  const handleMouseMove = () => {
    setShowControls(true);
    
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    
    hideTimeoutRef.current = setTimeout(() => {
      if (!showAudioMenu && !showSubtitleMenu) {
        setShowControls(false);
      }
    }, 3000);
  };

  const handleMouseLeave = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    if (!showAudioMenu) {
      setShowControls(false);
    }
  };

  // Helper function to get video height from media source
  const getVideoHeight = (source: MediaSource): number => {
    const videoStream = source.MediaStreams?.find(s => s.Type === 'Video');
    return videoStream?.Height || 0;
  };

  // Select media source based on quality preference
  const selectMediaSourceByQuality = (sources: MediaSource[], preference: string): MediaSource => {
    // Sort sources by video height (resolution)
    const sortedSources = [...sources].sort((a, b) => getVideoHeight(b) - getVideoHeight(a));
    
    const targetResolutions: Record<string, number> = {
      '4k': 2160,
      '1080p': 1080,
      '720p': 720,
      'highest': Infinity,
      'lowest': 0,
    };
    
    const target = targetResolutions[preference];
    
    if (preference === 'highest') {
      return sortedSources[0]; // Highest resolution
    }
    
    if (preference === 'lowest') {
      return sortedSources[sortedSources.length - 1]; // Lowest resolution
    }
    
    // Find exact match or closest
    let bestMatch = sortedSources[0];
    let bestDiff = Infinity;
    
    for (const source of sortedSources) {
      const height = getVideoHeight(source);
      const diff = Math.abs(height - target);
      
      // Prefer sources at or below target, then fallback to higher
      if (height <= target && diff < bestDiff) {
        bestMatch = source;
        bestDiff = diff;
      } else if (bestDiff === Infinity && diff < Math.abs(getVideoHeight(bestMatch) - target)) {
        // No source at or below target yet, take closest above
        bestMatch = source;
      }
    }
    
    // If we wanted a specific resolution but only have higher ones, take the lowest available
    if (bestDiff === Infinity) {
      bestMatch = sortedSources[sortedSources.length - 1];
      for (const source of sortedSources) {
        if (getVideoHeight(source) >= target) {
          bestMatch = source;
        }
      }
    }
    
    console.log(`Quality preference: ${preference}, selected: ${getVideoHeight(bestMatch)}p`);
    return bestMatch;
  };

  const loadPlaybackInfo = async () => {
    try {
      setIsLoading(true);
      setError('');

      const playbackInfo = await embyApi.getPlaybackInfo(id!);

      if (!playbackInfo.MediaSources || playbackInfo.MediaSources.length === 0) {
        setError('No playable media sources found');
        return;
      }

      setMediaSources(playbackInfo.MediaSources);
      setPlaySessionId(playbackInfo.PlaySessionId);

      // Get full item details including resume position
      const itemDetails = await embyApi.getItem(id!);
      if (itemDetails) setItem(itemDetails);
      
      // Get resume position in seconds
      const resumePositionTicks = itemDetails?.UserData?.PlaybackPositionTicks || 0;
      const resumePositionSeconds = resumePositionTicks / 10000000;
      setResumePosition(resumePositionSeconds);

      // If this is an episode, fetch adjacent episodes for next/previous navigation
      if (itemDetails?.Type === 'Episode' && itemDetails?.SeriesId) {
        try {
          // Get all episodes from the series
          const episodesResponse = await embyApi.getItems({
            parentId: itemDetails.SeriesId,
            includeItemTypes: 'Episode',
            recursive: true,
            sortBy: 'ParentIndexNumber,IndexNumber',
            sortOrder: 'Ascending',
            fields: 'Overview',
          });
          
          const episodes = episodesResponse.Items;
          const currentIndex = episodes.findIndex(ep => ep.Id === id);
          
          if (currentIndex > 0) {
            setPrevEpisode(episodes[currentIndex - 1]);
          } else {
            setPrevEpisode(null);
          }
          
          if (currentIndex < episodes.length - 1) {
            setNextEpisode(episodes[currentIndex + 1]);
          } else {
            setNextEpisode(null);
          }
        } catch (err) {
          console.error('Failed to load adjacent episodes:', err);
        }
      } else {
        setPrevEpisode(null);
        setNextEpisode(null);
      }

      // Check playback quality preference
      const qualityPref = localStorage.getItem('emby_playbackQuality') || 'manual';
      
      if (qualityPref === 'manual' && playbackInfo.MediaSources.length > 1) {
        // Manual mode - show selector if multiple sources
        setShowSelector(true);
      } else if (playbackInfo.MediaSources.length === 1) {
        // Only one source, use it
        handleMediaSourceSelect(playbackInfo.MediaSources[0], playbackInfo.PlaySessionId, resumePositionSeconds);
      } else {
        // Auto-select based on quality preference
        const selectedSource = selectMediaSourceByQuality(playbackInfo.MediaSources, qualityPref);
        handleMediaSourceSelect(selectedSource, playbackInfo.PlaySessionId, resumePositionSeconds);
      }
    } catch (err) {
      console.error('Failed to load playback info:', err);
      setError('Failed to load video. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadVideo = (url: string, startPosition: number = 0) => {
    if (!videoRef.current) return;

    console.log('Loading video URL:', url, 'Start position:', startPosition);

    // Destroy existing HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Add video event listeners for playback reporting
    const video = videoRef.current;
    
    const handlePause = () => {
      if (selectedSource) {
        const positionTicks = Math.floor(video.currentTime * 10000000);
        embyApi.reportPlaybackProgress({
          ItemId: id!,
          MediaSourceId: selectedSource.Id,
          PlaySessionId: playSessionId,
          PositionTicks: positionTicks,
          IsPaused: true,
          EventName: 'Pause',
          PlayMethod: 'Transcode',
        }).catch(err => console.error('Failed to report pause:', err));
      }
    };
    
    const handlePlay = () => {
      if (selectedSource) {
        const positionTicks = Math.floor(video.currentTime * 10000000);
        embyApi.reportPlaybackProgress({
          ItemId: id!,
          MediaSourceId: selectedSource.Id,
          PlaySessionId: playSessionId,
          PositionTicks: positionTicks,
          IsPaused: false,
          EventName: 'Unpause',
          PlayMethod: 'Transcode',
        }).catch(err => console.error('Failed to report unpause:', err));
      }
    };
    
    const handleEnded = () => {
      if (selectedSource) {
        const positionTicks = Math.floor(video.duration * 10000000);
        embyApi.reportPlaybackStopped({
          ItemId: id!,
          MediaSourceId: selectedSource.Id,
          PlaySessionId: playSessionId,
          PositionTicks: positionTicks,
        }).catch(err => console.error('Failed to report playback ended:', err));
      }
      
      // Auto-play next episode if available
      if (nextEpisode) {
        navigate(`/player/${nextEpisode.Id}`, { replace: true });
      }
    };
    
    video.addEventListener('pause', handlePause);
    video.addEventListener('play', handlePlay);
    video.addEventListener('ended', handleEnded);

    if (Hls.isSupported()) {
      console.log('Using HLS.js');
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 300, // Keep 5 mins of back buffer
        maxBufferLength: 900, // Buffer up to 15 minutes ahead
        maxMaxBufferLength: 900,
        maxBufferSize: 2 * 1000 * 1000 * 1000, // 2GB buffer for 4K
        maxBufferHole: 0.5,
      });
      
      hls.loadSource(url);
      hls.attachMedia(videoRef.current);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest parsed, starting playback');
        // Seek to resume position if provided
        if (startPosition > 0 && videoRef.current) {
          console.log('Seeking to resume position:', startPosition);
          videoRef.current.currentTime = startPosition;
        }
        videoRef.current?.play().catch(e => console.log('Autoplay prevented:', e));
      });
      
      hls.on(Hls.Events.ERROR, (_event, data) => {
        // Only log fatal errors or specific recoverable ones we care about
        // Suppress bufferFullError as it's normal for 4K content and auto-recovers
        if (data.fatal) {
          console.error('HLS fatal error:', data);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('Network error, trying to recover...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('Media error, trying to recover...');
              hls.recoverMediaError();
              break;
            default:
              setError('Failed to load video stream');
              hls.destroy();
              break;
          }
        }
        // Non-fatal errors like bufferFullError are handled automatically by HLS.js
      });
      
      hlsRef.current = hls;
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS support
      console.log('Using native HLS support');
      videoRef.current.src = url;
      videoRef.current.addEventListener('loadedmetadata', () => {
        // Seek to resume position if provided
        if (startPosition > 0 && videoRef.current) {
          videoRef.current.currentTime = startPosition;
        }
        videoRef.current?.play().catch(e => console.log('Autoplay prevented:', e));
      });
    } else {
      setError('HLS is not supported in this browser');
    }
  };

  const handleMediaSourceSelect = (source: MediaSource, sessionId: string = playSessionId, startPosition: number = 0) => {
    setSelectedSource(source);
    setShowSelector(false);
    setResumePosition(startPosition);
    
    const audioStreams = source.MediaStreams.filter(s => s.Type === 'Audio');
    
    // Check for user's preferred audio language
    const preferredAudioLang = localStorage.getItem('emby_preferredAudioLang') || '';
    let defaultAudio = audioStreams.find(s => s.IsDefault) || audioStreams[0];
    
    // If user has a preferred language, try to find a matching audio track
    if (preferredAudioLang) {
      const preferredTrack = audioStreams.find(s => 
        s.Language?.toLowerCase() === preferredAudioLang.toLowerCase()
      );
      if (preferredTrack) {
        defaultAudio = preferredTrack;
        console.log(`Using preferred audio language: ${preferredAudioLang}`);
      }
    }
    
    if (defaultAudio) {
      setSelectedAudioIndex(defaultAudio.Index);
      
      const url = embyApi.getStreamUrl(id!, source.Id, sessionId, source.Container, defaultAudio.Index);
      console.log('Stream URL:', url);
      setStreamUrl(url);
      
      // Report playback started with position
      const positionTicks = Math.floor(startPosition * 10000000);
      embyApi.reportPlaybackStart({
        ItemId: id!,
        MediaSourceId: source.Id,
        PlaySessionId: sessionId,
        PositionTicks: positionTicks,
        AudioStreamIndex: defaultAudio.Index,
        IsPaused: false,
        PlayMethod: 'Transcode',
      }).catch(err => console.error('Failed to report playback start:', err));
      
      // Start progress reporting interval (every 10 seconds)
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      progressIntervalRef.current = window.setInterval(() => {
        if (videoRef.current && !videoRef.current.paused) {
          const positionTicks = Math.floor(videoRef.current.currentTime * 10000000);
          // Only report if position has changed significantly (at least 1 second)
          if (Math.abs(positionTicks - lastReportedTimeRef.current) > 10000000) {
            lastReportedTimeRef.current = positionTicks;
            embyApi.reportPlaybackProgress({
              ItemId: id!,
              MediaSourceId: source.Id,
              PlaySessionId: sessionId,
              PositionTicks: positionTicks,
              AudioStreamIndex: selectedAudioIndex,
              IsPaused: false,
              EventName: 'TimeUpdate',
              PlayMethod: 'Transcode',
            }).catch(err => console.error('Failed to report progress:', err));
          }
        }
      }, 10000);
      
      // Small delay to ensure video element is rendered
      setTimeout(() => loadVideo(url, startPosition), 100);
    }
  };

  const handleAudioTrackChange = async (audioIndex: number) => {
    if (!selectedSource || !videoRef.current) return;
    
    const currentTime = videoRef.current.currentTime;
    setSelectedAudioIndex(audioIndex);
    setShowAudioMenu(false);
    
    // Report playback stopped to end the current transcode session
    const positionTicks = Math.floor(currentTime * 10000000);
    try {
      await embyApi.reportPlaybackStopped({
        ItemId: id!,
        MediaSourceId: selectedSource.Id,
        PlaySessionId: playSessionId,
        PositionTicks: positionTicks,
      });
    } catch (err) {
      console.error('Failed to report playback stopped:', err);
    }
    
    // Destroy current HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    
    // Get a new playback session
    try {
      const newPlaybackInfo = await embyApi.getPlaybackInfo(id!);
      const newSessionId = newPlaybackInfo.PlaySessionId;
      setPlaySessionId(newSessionId);
      
      const url = embyApi.getStreamUrl(id!, selectedSource.Id, newSessionId, selectedSource.Container, audioIndex);
      setStreamUrl(url);
      
      // Report playback start with new audio track
      await embyApi.reportPlaybackStart({
        ItemId: id!,
        MediaSourceId: selectedSource.Id,
        PlaySessionId: newSessionId,
        PositionTicks: positionTicks,
        AudioStreamIndex: audioIndex,
        IsPaused: false,
        PlayMethod: 'Transcode',
      });
      
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 300,
        maxBufferLength: 900,
        maxMaxBufferLength: 900,
        maxBufferSize: 2 * 1000 * 1000 * 1000,
        maxBufferHole: 0.5,
      });
      
      hls.loadSource(url);
      hls.attachMedia(videoRef.current);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (videoRef.current) {
          videoRef.current.currentTime = currentTime;
          videoRef.current.play().catch(e => console.log('Autoplay prevented:', e));
        }
      });
      
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.error('HLS fatal error:', data);
        }
      });
      
      hlsRef.current = hls;
    } catch (err) {
      console.error('Failed to change audio track:', err);
      setError('Failed to change audio track. Please try again.');
    }
  };

  const handleBack = async () => {
    // Report playback stopped before navigating away
    if (selectedSource && videoRef.current) {
      const positionTicks = Math.floor(videoRef.current.currentTime * 10000000);
      try {
        await embyApi.reportPlaybackStopped({
          ItemId: id!,
          MediaSourceId: selectedSource.Id,
          PlaySessionId: playSessionId,
          PositionTicks: positionTicks,
        });
      } catch (err) {
        console.error('Failed to report playback stopped:', err);
      }
    }
    navigate(-1);
  };

  const handlePreviousEpisode = async () => {
    if (!prevEpisode) return;
    
    // Clean up current playback session
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    
    // Report playback stopped before navigating
    if (selectedSource && videoRef.current) {
      const positionTicks = Math.floor(videoRef.current.currentTime * 10000000);
      try {
        await embyApi.reportPlaybackStopped({
          ItemId: id!,
          MediaSourceId: selectedSource.Id,
          PlaySessionId: playSessionId,
          PositionTicks: positionTicks,
        });
      } catch (err) {
        console.error('Failed to report playback stopped:', err);
      }
    }
    
    // Destroy HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    
    navigate(`/player/${prevEpisode.Id}`, { replace: true });
  };

  const handleNextEpisode = async () => {
    if (!nextEpisode) return;
    
    // Clean up current playback session
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    
    // Report playback stopped before navigating
    if (selectedSource && videoRef.current) {
      const positionTicks = Math.floor(videoRef.current.currentTime * 10000000);
      try {
        await embyApi.reportPlaybackStopped({
          ItemId: id!,
          MediaSourceId: selectedSource.Id,
          PlaySessionId: playSessionId,
          PositionTicks: positionTicks,
        });
      } catch (err) {
        console.error('Failed to report playback stopped:', err);
      }
    }
    
    // Destroy HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    
    navigate(`/player/${nextEpisode.Id}`, { replace: true });
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Error toggling fullscreen:', err);
    }
  };

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    if (!showAudioMenu && !showSubtitleMenu) {
      hideTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [showAudioMenu, showSubtitleMenu]);

  const skipForward = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 10, duration);
    showControlsTemporarily();
  }, [duration, showControlsTemporarily]);

  const skipBackward = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 10, 0);
    showControlsTemporarily();
  }, [showControlsTemporarily]);

  const adjustVolume = useCallback((delta: number) => {
    if (!videoRef.current) return;
    const newVolume = Math.max(0, Math.min(1, videoRef.current.volume + delta));
    videoRef.current.volume = newVolume;
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      videoRef.current.muted = false;
      setIsMuted(false);
    }
    showControlsTemporarily();
  }, [isMuted, showControlsTemporarily]);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
    showControlsTemporarily();
  }, [showControlsTemporarily]);

  const togglePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
  }, []);

  // Use the TV navigation hook for player controls
  usePlayerTVNavigation({
    showControls,
    setShowControls,
    isMenuOpen: showAudioMenu || showSubtitleMenu,
    onTogglePlayPause: togglePlayPause,
    onSeekForward: skipForward,
    onSeekBackward: skipBackward,
    onVolumeUp: () => adjustVolume(0.1),
    onVolumeDown: () => adjustVolume(-0.1),
    onBack: handleBack,
  });

  // Ref to track if we're in a click (mousedown without significant movement)
  const isClickRef = useRef(true);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const seekDebounceRef = useRef<number | null>(null);

  const handleSeekBarMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    isClickRef.current = true;
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    updateSeekPosition(e);
  };

  const handleSeekBarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Always track hover position for tooltip
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(pos * 100);
    setHoverTime(pos * duration);
    
    if (isDragging) {
      // If mouse moved more than 5px, it's a drag not a click
      if (mouseDownPosRef.current) {
        const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
        if (dx > 5) {
          isClickRef.current = false;
        }
      }
      updateSeekPosition(e);
    }
  };

  const handleSeekBarMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      updateSeekPosition(e);
      // Debounce the seek to prevent double-seeking
      if (seekDebounceRef.current) {
        clearTimeout(seekDebounceRef.current);
      }
      const targetTime = dragTime;
      seekDebounceRef.current = window.setTimeout(() => {
        seekToTime(targetTime);
        seekDebounceRef.current = null;
      }, 50);
      setIsDragging(false);
      mouseDownPosRef.current = null;
    }
  };

  const updateSeekPosition = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = pos * duration;
    setDragTime(time);
    // Don't seek immediately - let mouseUp handle it to prevent double-seeking
  };

  const seekToTime = (time: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  };

  // Global mouse up handler for dragging
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging && videoRef.current) {
        // Debounce the seek to prevent double-seeking
        if (seekDebounceRef.current) {
          clearTimeout(seekDebounceRef.current);
        }
        const targetTime = dragTime;
        seekDebounceRef.current = window.setTimeout(() => {
          seekToTime(targetTime);
          seekDebounceRef.current = null;
        }, 50);
        setIsDragging(false);
        mouseDownPosRef.current = null;
      }
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        // Find the seek bar element to calculate position
        const seekBar = document.getElementById('seek-bar');
        if (seekBar) {
          const rect = seekBar.getBoundingClientRect();
          const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          const time = pos * duration;
          setDragTime(time);
          // Track if this is a drag vs click
          if (mouseDownPosRef.current) {
            const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
            if (dx > 5) {
              isClickRef.current = false;
            }
          }
        }
      }
    };

    if (isDragging) {
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('mousemove', handleGlobalMouseMove);
    }

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      if (seekDebounceRef.current) {
        clearTimeout(seekDebounceRef.current);
      }
    };
  }, [isDragging, dragTime, duration]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const newVolume = parseFloat(e.target.value);
    videoRef.current.volume = newVolume;
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      videoRef.current.muted = false;
      setIsMuted(false);
    }
  };

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getEndTime = (): string => {
    if (isNaN(duration) || duration <= 0) return '';
    const remainingSeconds = duration - currentTime;
    const endTime = new Date(Date.now() + remainingSeconds * 1000);
    return endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">{error}</div>
          <button
            onClick={handleBack}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {showSelector && (
        <MediaSelector
          mediaSources={mediaSources}
          onSelect={(source) => handleMediaSourceSelect(source, playSessionId, resumePosition)}
          onCancel={streamUrl ? () => setShowSelector(false) : handleBack}
        />
      )}

      {streamUrl && (
        <div
          ref={containerRef}
          className="relative w-full h-screen bg-black"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Header overlay */}
          <div className={`absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-6 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleBack}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div>
                  <h1 className="text-white text-2xl font-bold">{item?.Name}</h1>
                  {item?.SeriesName && (
                    <p className="text-gray-300 text-sm mt-1">
                      {item.SeriesName}
                      {item.ParentIndexNumber !== undefined && item.IndexNumber !== undefined && (
                        <span className="ml-2 text-gray-400">
                          S{item.ParentIndexNumber.toString().padStart(2, '0')}E{item.IndexNumber.toString().padStart(2, '0')}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Quality indicator */}
              {selectedSource && (() => {
                const videoStream = selectedSource.MediaStreams?.find(s => s.Type === 'Video');
                const height = videoStream?.Height || 0;
                const codec = videoStream?.Codec?.toUpperCase() || '';
                const bitrate = selectedSource.Bitrate ? Math.round(selectedSource.Bitrate / 1000000) : null;
                
                let qualityLabel = '';
                if (height >= 2160) qualityLabel = '4K';
                else if (height >= 1080) qualityLabel = '1080p';
                else if (height >= 720) qualityLabel = '720p';
                else if (height >= 480) qualityLabel = '480p';
                else if (height > 0) qualityLabel = `${height}p`;
                
                return (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-lg">
                    {qualityLabel && (
                      <span className={`text-sm font-bold ${height >= 2160 ? 'text-yellow-400' : height >= 1080 ? 'text-blue-400' : 'text-gray-300'}`}>
                        {qualityLabel}
                      </span>
                    )}
                    {codec && (
                      <span className="text-xs text-gray-400">{codec}</span>
                    )}
                    {bitrate && (
                      <span className="text-xs text-gray-500">{bitrate} Mbps</span>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Video element */}
          <video
            ref={videoRef}
            autoPlay
            onClick={togglePlayPause}
            className="w-full h-full object-contain cursor-pointer"
            crossOrigin="anonymous"
            poster={
              item?.Type === 'Episode' && item.SeriesId
                ? embyApi.getImageUrl(item.SeriesId, 'Primary', { maxWidth: 1920 })
                : item?.ImageTags?.Primary
                ? embyApi.getImageUrl(item.Id, 'Primary', { maxWidth: 1920 })
                : undefined
            }
          >
            {/* Subtitle tracks */}
            {selectedSource && selectedSubtitleIndex !== null && selectedSource.MediaStreams
              .filter(s => s.Type === 'Subtitle' && s.IsTextSubtitleStream && s.Index === selectedSubtitleIndex)
              .map((stream) => (
                <track
                  key={`${stream.Index}-${streamUrl}`}
                  kind="subtitles"
                  label={stream.DisplayTitle || stream.Language || 'Subtitles'}
                  srcLang={stream.Language || 'und'}
                  src={embyApi.getSubtitleUrl(id!, selectedSource.Id, stream.Index)}
                  default
                />
              ))}
          </video>

          {/* Stats for nerds panel */}
          {showStats && (
            <div className="absolute top-20 left-6 z-30 bg-black/90 backdrop-blur-md rounded-xl p-4 shadow-2xl border border-white/10 font-mono text-xs max-w-md">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold text-sm">Stats for Nerds</h3>
                <button
                  onClick={() => setShowStats(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-2 text-gray-300">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <span className="text-gray-500">Video ID:</span>
                  <span className="text-white truncate">{id}</span>
                  
                  <span className="text-gray-500">Resolution:</span>
                  <span className="text-white">{stats.videoResolution}</span>
                  
                  <span className="text-gray-500">Video Codec:</span>
                  <span className="text-white">{stats.codec}</span>
                  
                  <span className="text-gray-500">Audio Codec:</span>
                  <span className="text-white">{stats.audioCodec}</span>
                  
                  <span className="text-gray-500">Container:</span>
                  <span className="text-white">{stats.container}</span>
                  
                  <span className="text-gray-500">Bitrate:</span>
                  <span className="text-white">{stats.currentBitrate ? `${(stats.currentBitrate / 1000000).toFixed(2)} Mbps` : 'N/A'}</span>
                  
                  <span className="text-gray-500">Buffer Health:</span>
                  <span className={`${stats.bufferHealth < 2 ? 'text-red-400' : stats.bufferHealth < 5 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {stats.bufferHealth.toFixed(1)}s
                  </span>
                  
                  <span className="text-gray-500">Bandwidth:</span>
                  <span className="text-white">{stats.bandwidth ? `${(stats.bandwidth / 1000000).toFixed(2)} Mbps` : 'Measuring...'}</span>
                  
                  <span className="text-gray-500">Frames:</span>
                  <span className="text-white">
                    {stats.totalFrames > 0 ? (
                      <>
                        {stats.totalFrames.toLocaleString()}
                        {stats.droppedFrames > 0 && (
                          <span className="text-red-400 ml-1">({stats.droppedFrames} dropped)</span>
                        )}
                      </>
                    ) : 'N/A'}
                  </span>
                  
                  <span className="text-gray-500">Current Time:</span>
                  <span className="text-white tabular-nums">{formatTime(currentTime)}</span>
                  
                  <span className="text-gray-500">Duration:</span>
                  <span className="text-white tabular-nums">{formatTime(duration)}</span>
                  
                  <span className="text-gray-500">Play Session:</span>
                  <span className="text-white truncate text-[10px]">{playSessionId || 'N/A'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Loading spinner overlay */}
          {isVideoLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
              <div className="flex flex-col items-center gap-4">
                {/* Spinning loader */}
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-gray-700 border-t-blue-500 animate-spin shadow-2xl" />
                </div>
              </div>
            </div>
          )}

          {/* Up Next popup - appears 2 minutes before end */}
          {showUpNext && nextEpisode && (
            <div className="absolute bottom-32 right-6 z-30 animate-fade-in">
              <div className="bg-black/90 backdrop-blur-md rounded-xl p-4 shadow-2xl border border-gray-700 max-w-sm">
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Up Next</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <h3 className="text-white font-semibold text-lg leading-tight">{nextEpisode.Name}</h3>
                    {nextEpisode.ParentIndexNumber !== undefined && nextEpisode.IndexNumber !== undefined && (
                      <p className="text-gray-400 text-sm mt-1">
                        S{nextEpisode.ParentIndexNumber.toString().padStart(2, '0')}E{nextEpisode.IndexNumber.toString().padStart(2, '0')}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleNextEpisode}
                    className="flex-shrink-0 bg-white text-black px-5 py-2.5 rounded-full font-semibold hover:bg-gray-100 transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg"
                  >
                    Play Now
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Episode navigation buttons */}
          {item?.Type === 'Episode' && (prevEpisode || nextEpisode) && (
            <div className={`absolute bottom-36 sm:bottom-24 left-1/2 -translate-x-1/2 z-20 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <div className="flex items-center gap-1 sm:gap-2 bg-black/60 backdrop-blur-md rounded-full px-2 sm:px-3 py-1.5 sm:py-2 border border-white/10">
                {/* Previous Episode */}
                <button
                  onClick={handlePreviousEpisode}
                  disabled={!prevEpisode}
                  className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full transition-all duration-200 ${
                    prevEpisode 
                      ? 'text-white hover:bg-white/20 hover:scale-105 active:scale-95' 
                      : 'text-gray-600 cursor-not-allowed opacity-50'
                  }`}
                  title={prevEpisode ? `Previous: ${prevEpisode.Name}` : 'No previous episode'}
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
                  </svg>
                  <span className="text-sm font-medium hidden sm:inline">Previous</span>
                </button>

                {/* Separator */}
                <div className="w-px h-4 sm:h-5 bg-white/20"></div>

                {/* Next Episode */}
                <button
                  onClick={handleNextEpisode}
                  disabled={!nextEpisode}
                  className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full transition-all duration-200 ${
                    nextEpisode 
                      ? 'text-white hover:bg-white/20 hover:scale-105 active:scale-95' 
                      : 'text-gray-600 cursor-not-allowed opacity-50'
                  }`}
                  title={nextEpisode ? `Next: ${nextEpisode.Name}` : 'No next episode'}
                >
                  <span className="text-sm font-medium hidden sm:inline">Next</span>
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Custom Control Bar */}
          <div className={`absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {/* Seek bar */}
            <div className="px-4 pt-2">
              <div 
                id="seek-bar"
                tabIndex={0}
                role="slider"
                aria-label="Seek"
                aria-valuemin={0}
                aria-valuemax={duration}
                aria-valuenow={currentTime}
                className="relative h-2 bg-gray-700 rounded-full cursor-pointer group hover:h-2.5 focus:h-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black transition-all"
                onMouseDown={handleSeekBarMouseDown}
                onMouseMove={handleSeekBarMouseMove}
                onMouseUp={handleSeekBarMouseUp}
                onMouseEnter={() => setIsHoveringSeekBar(true)}
                onMouseLeave={() => setIsHoveringSeekBar(false)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    e.stopPropagation();
                    // Fine-grained control: 5 seconds per press when focused on seek bar
                    if (videoRef.current) {
                      videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 5, 0);
                      showControlsTemporarily();
                    }
                  } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    e.stopPropagation();
                    // Fine-grained control: 5 seconds per press when focused on seek bar
                    if (videoRef.current) {
                      videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 5, duration);
                      showControlsTemporarily();
                    }
                  } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    // Allow vertical navigation away from the seek bar
                    // Don't prevent default, let TV navigation handle it
                  }
                }}
              >
                {/* Buffer bar */}
                <div 
                  className="absolute h-full bg-gray-500 rounded-full pointer-events-none"
                  style={{ width: `${bufferedPercentage}%` }}
                />
                {/* Progress bar */}
                <div 
                  className="absolute h-full bg-blue-500 rounded-full pointer-events-none"
                  style={{ width: `${duration > 0 ? ((isDragging ? dragTime : currentTime) / duration) * 100 : 0}%` }}
                />
                {/* Playhead */}
                <div 
                  className="absolute w-3 h-3 bg-white rounded-full shadow-lg -translate-x-1/2 -translate-y-1/2 top-1/2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity pointer-events-none"
                  style={{ 
                    left: `${duration > 0 ? ((isDragging ? dragTime : currentTime) / duration) * 100 : 0}%`,
                    opacity: isDragging ? 1 : undefined
                  }}
                />
                {/* Time preview on hover/drag */}
                {(isDragging || isHoveringSeekBar) && (
                  <div 
                    className="absolute -top-8 -translate-x-1/2 bg-black/90 text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap"
                    style={{ left: `${isDragging ? (duration > 0 ? (dragTime / duration) * 100 : 0) : hoverPosition}%` }}
                  >
                    {formatTime(isDragging ? dragTime : hoverTime)}
                  </div>
                )}
              </div>
            </div>

            {/* Control buttons */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                {/* Play/Pause */}
                <button
                  onClick={togglePlayPause}
                  className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all duration-200 hover:scale-110 active:scale-95"
                >
                  <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                    {isPlaying ? (
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    ) : (
                      <path d="M8 5v14l11-7z" />
                    )}
                  </svg>
                </button>

                {/* Time */}
                <div className="text-white text-sm font-medium flex items-center gap-2 tabular-nums">
                  <span className="min-w-[90px]">{formatTime(currentTime)} / {formatTime(duration)}</span>
                  {duration > 0 && (
                    <span className="text-gray-400 text-xs">• Ends {getEndTime()}</span>
                  )}
                </div>

                {/* Volume */}
                <div className="flex items-center gap-2 group">
                  <button
                    onClick={toggleMute}
                    className="p-2 rounded-full hover:bg-white/10 text-white transition-all duration-200 hover:scale-105 active:scale-95"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      {isMuted || volume === 0 ? (
                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                      ) : volume < 0.5 ? (
                        <path d="M7 9v6h4l5 5V4l-5 5H7z" />
                      ) : (
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                      )}
                    </svg>
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-20 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0"
                    style={{
                      background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(isMuted ? 0 : volume) * 100}%, #374151 ${(isMuted ? 0 : volume) * 100}%, #374151 100%)`
                    }}
                  />
                </div>
              </div>

              {/* Right side controls placeholder */}
              <div className="flex items-center gap-2">
              </div>
            </div>
          </div>

          {/* Audio, Subtitle, Version selectors and other controls */}
          <div className={`absolute bottom-24 right-6 z-20 transition-opacity duration-300 flex items-center gap-2 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {/* Version selector button */}
            {mediaSources.length > 1 && selectedSource && (
              <button
                onClick={() => setShowSelector(true)}
                className="player-control h-10 px-4 bg-black/60 hover:bg-black/80 text-white text-sm rounded-full transition-all duration-200 backdrop-blur-md border border-white/10 hover:border-white/20 hover:scale-105 active:scale-95 inline-flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span className="hidden sm:inline">
                  {(() => {
                    const videoStream = selectedSource.MediaStreams?.find(s => s.Type === 'Video');
                    const height = videoStream?.Height || 0;
                    let quality = '';
                    if (height >= 2160) quality = '4K';
                    else if (height >= 1080) quality = '1080p';
                    else if (height >= 720) quality = '720p';
                    else quality = '480p';
                    return `${quality} • ${mediaSources.length} versions`;
                  })()}
                </span>
                <span className="sm:hidden">{mediaSources.length}</span>
              </button>
            )}
            {/* Stats for nerds button */}
            <button
              onClick={() => setShowStats(!showStats)}
              className={`player-control w-10 h-10 flex items-center justify-center bg-black/60 hover:bg-black/80 text-white rounded-full transition-all duration-200 backdrop-blur-md border hover:scale-105 active:scale-95 ${
                showStats ? 'border-blue-500 bg-blue-500/20' : 'border-white/10 hover:border-white/20'
              }`}
              title="Stats for nerds"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>

            {/* Fullscreen button */}
            <button
              onClick={toggleFullscreen}
              className="player-control w-10 h-10 flex items-center justify-center bg-black/60 hover:bg-black/80 text-white rounded-full transition-all duration-200 backdrop-blur-md border border-white/10 hover:border-white/20 hover:scale-105 active:scale-95"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isFullscreen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                )}
              </svg>
            </button>

            {/* Subtitle track selector */}
            {selectedSource && selectedSource.MediaStreams.filter(s => s.Type === 'Subtitle' && s.IsTextSubtitleStream).length > 0 && (
              <div className="relative">
                <button
                  onClick={() => { setShowSubtitleMenu(!showSubtitleMenu); setShowAudioMenu(false); }}
                  className={`player-control px-4 py-2.5 bg-black/60 hover:bg-black/80 text-white text-sm rounded-full transition-all duration-200 backdrop-blur-md border hover:scale-105 active:scale-95 flex items-center gap-2 ${
                    selectedSubtitleIndex !== null ? 'border-blue-500 bg-blue-500/20' : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  CC
                </button>

                {showSubtitleMenu && (
                  <div className="absolute bottom-full mb-2 right-0 bg-gray-900/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl min-w-[250px] max-h-[300px] overflow-y-auto" role="menu">
                    {/* Off option */}
                    <button
                      onClick={() => { setSelectedSubtitleIndex(null); setShowSubtitleMenu(false); }}
                      className={`player-menu-item w-full px-4 py-3 text-left transition-all duration-150 border-b border-white/5 ${
                        selectedSubtitleIndex === null ? 'bg-blue-500/20 text-blue-400' : 'text-white hover:bg-white/10'
                      }`}
                      role="menuitem"
                    >
                      <div className="font-medium">Off</div>
                    </button>
                    {selectedSource.MediaStreams
                      .filter(s => s.Type === 'Subtitle' && s.IsTextSubtitleStream)
                      .map((stream) => (
                        <button
                          key={stream.Index}
                          onClick={() => { setSelectedSubtitleIndex(stream.Index); setShowSubtitleMenu(false); }}
                          className={`player-menu-item w-full px-4 py-3 text-left transition-all duration-150 border-b border-white/5 last:border-b-0 ${
                            selectedSubtitleIndex === stream.Index ? 'bg-blue-500/20 text-blue-400' : 'text-white hover:bg-white/10'
                          }`}
                          role="menuitem"
                        >
                          <div className="font-medium">
                            {stream.DisplayTitle || stream.Language?.toUpperCase() || `Subtitle ${stream.Index}`}
                            {stream.IsDefault && ' (Default)'}
                            {stream.IsForced && ' (Forced)'}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {stream.Codec?.toUpperCase()}
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Audio track selector */}
            {selectedSource && selectedSource.MediaStreams.filter(s => s.Type === 'Audio').length > 1 && (
              <div className="relative">
                <button
                  onClick={() => { setShowAudioMenu(!showAudioMenu); setShowSubtitleMenu(false); }}
                  className="player-control px-4 py-2.5 bg-black/60 hover:bg-black/80 text-white text-sm rounded-full transition-all duration-200 backdrop-blur-md border border-white/10 hover:border-white/20 hover:scale-105 active:scale-95 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                  Audio
                </button>

                {showAudioMenu && (
                  <div className="absolute bottom-full mb-2 right-0 bg-gray-900/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl min-w-[250px] max-h-[300px] overflow-y-auto" role="menu">
                    {selectedSource.MediaStreams
                      .filter(s => s.Type === 'Audio')
                      .map((stream) => (
                        <button
                          key={stream.Index}
                          onClick={() => handleAudioTrackChange(stream.Index)}
                          className={`player-menu-item w-full px-4 py-3 text-left transition-all duration-150 border-b border-white/5 last:border-b-0 ${
                            selectedAudioIndex === stream.Index ? 'bg-blue-500/20 text-blue-400' : 'text-white hover:bg-white/10'
                          }`}
                          role="menuitem"
                        >
                          <div className="font-medium">
                            {stream.Language ? stream.Language.toUpperCase() : 'Unknown Language'}
                            {stream.IsDefault && ' (Default)'}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {stream.Codec?.toUpperCase()} • {stream.Channels ? `${stream.Channels}.0` : ''} {stream.ChannelLayout || ''}
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
