import { useState, useEffect, useRef, useCallback } from 'react';
import { unzipSync, strFromU8 } from 'fflate';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Hls from 'hls.js';
import { embyApi } from '../services/embyApi';
import { MediaSelector } from './MediaSelector';
import { usePlayerUi } from '../context/PlayerUiContext';
import { isTauri } from '@tauri-apps/api/core';
import { appCacheDir, join } from '@tauri-apps/api/path';
import type { MpvObservableProperty } from 'tauri-plugin-libmpv-api';
// Inline skeleton replaces full-screen loading
import type { MediaSource, EmbyItem } from '../types/emby.types';

export function Player({ id: playerId, isCollapsed: isCollapsedProp }: { id?: string; isCollapsed?: boolean }) {
  const params = useParams<{ id: string }>();
  const resolvedId = playerId ?? params.id;
  const navigate = useNavigate();
  const location = useLocation();
  const { setActiveId, isCollapsed, setIsCollapsed, lastNonPlayerPath, setSuppressAutoOpen } = usePlayerUi();
  const backgroundLocation = (location.state as { backgroundLocation?: unknown } | undefined)
    ?.backgroundLocation as typeof location | undefined;
  const isCollapsedView = isCollapsedProp ?? isCollapsed;
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInTauri = isTauri();
  const selectedPlayer = localStorage.getItem('emby_videoPlayer') || 'hlsjs';
  const useLibmpv = isInTauri && selectedPlayer === 'libmpv';
  const VOLUME_STORAGE_KEY = 'player_volume';
  const MUTE_STORAGE_KEY = 'player_muted';
  const MPV_AUTO_ZOOM_THRESHOLD = 1.05;
  const clampVolume = (value: number) => Math.max(0, Math.min(1, value));
  const getStoredVolume = (): number => {
    const raw = localStorage.getItem(VOLUME_STORAGE_KEY);
    const parsed = raw ? Number(raw) : 1;
    if (!Number.isFinite(parsed)) return 1;
    return clampVolume(parsed);
  };
  const getMpvAutoZoom = (videoParams: { width: number; height: number } | null): number | null => {
    if (!videoParams) return null;
    const container = containerRef.current;
    if (!container) return null;
    const width = videoParams.width;
    const height = videoParams.height;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    if (!Number.isFinite(containerWidth) || !Number.isFinite(containerHeight) || containerWidth <= 0 || containerHeight <= 0) {
      return null;
    }
    const containerRatio = containerWidth / containerHeight;
    if (!Number.isFinite(containerRatio) || containerRatio <= 0) return null;
    const videoRatio = width / height;
    if (!Number.isFinite(videoRatio) || videoRatio <= 0) return null;

    // If the video is underscanned (bars on all sides), scale up until one side touches.
    const fitScale = Math.min(containerWidth / width, containerHeight / height);
    if (fitScale > MPV_AUTO_ZOOM_THRESHOLD) {
      return Math.max(1, Math.min(2.5, fitScale));
    }

    // Otherwise, remove letterbox/pillarbox by zooming to fill (may crop the opposite side).
    const ratio = containerRatio / videoRatio;
    const cropScale = Math.max(ratio, 1 / ratio);
    if (cropScale > MPV_AUTO_ZOOM_THRESHOLD) {
      return Math.max(1, Math.min(2.5, cropScale));
    }

    return 1.0;
  };

  const [item, setItem] = useState<EmbyItem | null>(null);
  const [mediaSources, setMediaSources] = useState<MediaSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<MediaSource | null>(null);
  const [playSessionId, setPlaySessionId] = useState<string>('');
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [showSelector, setShowSelector] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showZoomMenu, setShowZoomMenu] = useState(false);
  const [selectedAudioIndex, setSelectedAudioIndex] = useState<number | undefined>();
  const [customSubtitleUrl, setCustomSubtitleUrl] = useState<string>('');
  const [customSubtitleLabel, setCustomSubtitleLabel] = useState<string>('');
  const [subtitleDelay, setSubtitleDelay] = useState<number>(() => {
    const raw = localStorage.getItem('player_subtitleDelay');
    const parsed = raw ? Number(raw) : 0;
    if (Number.isNaN(parsed)) return 0;
    return Math.max(-5, Math.min(5, parsed));
  });
  const [subdlResults, setSubdlResults] = useState<any[]>([]);
  const [subdlTitles, setSubdlTitles] = useState<any[]>([]);
  const [subdlSelectedTitleId, setSubdlSelectedTitleId] = useState<string>('');
  const [subdlError, setSubdlError] = useState<string>('');
  const [isSubdlSearching, setIsSubdlSearching] = useState(false);
  const [subdlManualQuery, setSubdlManualQuery] = useState<string>('');
  const [selectedFilter, setSelectedFilter] = useState<string>(() => localStorage.getItem('player_videoFilter') || 'normal');
  const [videoZoom, setVideoZoom] = useState<number>(() => parseFloat(localStorage.getItem('player_videoZoom') || '1.0'));
  const [autoZoomEnabled, setAutoZoomEnabled] = useState<boolean>(() => localStorage.getItem('player_videoZoom') === 'auto');
  const [detectedZoom, setDetectedZoom] = useState<number>(1.0);
  const [detectedOffset, setDetectedOffset] = useState<number>(0);
  const [autoZoomLocked, setAutoZoomLocked] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPercentage, setBufferedPercentage] = useState(0);
  const [volume, setVolume] = useState(() => getStoredVolume());
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem(MUTE_STORAGE_KEY) === 'true');
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
  const [upNextDismissed, setUpNextDismissed] = useState(false);
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
  const [mpvCacheDuration, setMpvCacheDuration] = useState<number>(0);
  const [mpvCacheSpeed, setMpvCacheSpeed] = useState<number>(0);
  const [mpvBufferedPercent, setMpvBufferedPercent] = useState<number>(0);
  const [mpvVideoParams, setMpvVideoParams] = useState<{ width: number; height: number } | null>(null);
  const statsIntervalRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const loadTimeoutRef = useRef<number | null>(null);
  const loadTokenRef = useRef<number>(0);
  const playbackHandlersRef = useRef<{
    pause: () => void;
    play: () => void;
    ended: () => void;
  } | null>(null);
  const lastReportedTimeRef = useRef<number>(0);
  const isSeekingRef = useRef<boolean>(false);
  const autoZoomIntervalRef = useRef<number | null>(null);
  const autoZoomLockedRef = useRef<boolean>(false);
  const autoZoomSampleStartRef = useRef<number | null>(null);
  const autoZoomSamplesRef = useRef<{ zoom: number; offset: number }[]>([]);
  const autoZoomCandidateRef = useRef<{ zoom: number; offset: number } | null>(null);
  const mpvApiRef = useRef<null | typeof import('tauri-plugin-libmpv-api')>(null);
  const mpvInitializedRef = useRef(false);
  const mpvObservingRef = useRef(false);
  const mpvActiveRef = useRef(false);
  const mpvLastPauseRef = useRef<boolean | null>(null);
  const mpvPauseRef = useRef(true);
  const mpvUnlistenRef = useRef<null | (() => void)>(null);
  const mpvPendingSeekRef = useRef<number | null>(null);
  const mpvLastTimePosRef = useRef<number>(0);
  const mpvLoadingResolvedRef = useRef<boolean>(false);
  const mpvCacheDurationRef = useRef<number>(0);
  const mpvLoadStartRef = useRef<number>(0);
  const mpvFirstTimePosRef = useRef<number | null>(null);
  const mpvFirstTimeWallRef = useRef<number>(0);
  const currentTimeRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Keyboard hold-to-seek for seek bar
  const seekHoldIntervalRef = useRef<number | null>(null);
  const seekHoldDirRef = useRef<'left' | 'right' | null>(null);
  const seekHoldStartRef = useRef<number>(0);
  // Focus target for moving from sliders
  const playButtonFocusRef = useRef<HTMLButtonElement>(null);
  const lastSubdlSearchKeyRef = useRef<string>('');
  const subtitleBlobUrlRef = useRef<string>('');
  const mpvSubtitlePathRef = useRef<string>('');
  const selectedSourceRef = useRef<MediaSource | null>(null);
  const playSessionIdRef = useRef<string>('');
  const nextEpisodeRef = useRef<EmbyItem | null>(null);
  const resolvedIdRef = useRef<string | undefined>(resolvedId);

  const MPV_OBSERVED_PROPERTIES = [
    ['pause', 'flag'],
    ['time-pos', 'double', 'none'],
    ['duration', 'double', 'none'],
    ['volume', 'double', 'none'],
    ['mute', 'flag'],
    ['eof-reached', 'flag'],
    ['demuxer-cache-duration', 'double', 'none'],
    ['cache-speed', 'int64', 'none'],
    ['video-params', 'node', 'none'],
  ] as const satisfies MpvObservableProperty[];

  const isAndroidTV = /Android/i.test(navigator.userAgent);
  const isLinuxDesktop = /Linux/i.test(navigator.userAgent) && !/Android/i.test(navigator.userAgent);

  useEffect(() => {
    selectedSourceRef.current = selectedSource;
  }, [selectedSource]);

  useEffect(() => {
    playSessionIdRef.current = playSessionId;
  }, [playSessionId]);

  useEffect(() => {
    nextEpisodeRef.current = nextEpisode;
  }, [nextEpisode]);

  useEffect(() => {
    resolvedIdRef.current = resolvedId;
  }, [resolvedId]);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (!useLibmpv) return;
    const html = document.documentElement;
    const body = document.body;
    const shouldBeTransparent = !isVideoLoading;
    if (shouldBeTransparent) {
      html.classList.add('mpv-transparent');
      body.classList.add('mpv-transparent');
    } else {
      html.classList.remove('mpv-transparent');
      body.classList.remove('mpv-transparent');
    }
    return () => {
      html.classList.remove('mpv-transparent');
      body.classList.remove('mpv-transparent');
    };
  }, [isVideoLoading, useLibmpv]);

  useEffect(() => {
    const body = document.body;
    if (useLibmpv && !isCollapsedView) {
      body.classList.add('libmpv-fullscreen');
      return () => body.classList.remove('libmpv-fullscreen');
    }
    body.classList.remove('libmpv-fullscreen');
  }, [isCollapsedView, useLibmpv]);

  useEffect(() => {
    if (!useLibmpv) return;
    if (duration <= 0) {
      setMpvBufferedPercent(0);
      return;
    }
    const bufferedEnd = Math.min(currentTime + mpvCacheDuration, duration);
    const percent = Math.max(0, Math.min(100, (bufferedEnd / duration) * 100));
    setMpvBufferedPercent(percent);
  }, [currentTime, duration, mpvCacheDuration, useLibmpv]);


  useEffect(() => {
    if (resolvedId) {
      // Clean up previous playback session before loading new one
      if (hlsRef.current) {
        console.log('Destroying previous HLS instance');
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      // Invalidate any in-flight loads to avoid double-init in React strict mode
      loadTokenRef.current += 1;
      if (progressIntervalRef.current) {
        console.log('Clearing previous progress interval');
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
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
      if (selectedSource) {
        const seconds = useLibmpv ? currentTimeRef.current : (videoRef.current?.currentTime ?? 0);
        const positionTicks = Math.floor(seconds * 10000000);
        embyApi.reportPlaybackStopped({
          ItemId: resolvedId!,
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
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
      if (subtitleBlobUrlRef.current) {
        URL.revokeObjectURL(subtitleBlobUrlRef.current);
        subtitleBlobUrlRef.current = '';
      }
      if (mpvSubtitlePathRef.current && isInTauri) {
        import('@tauri-apps/plugin-fs')
          .then(({ remove }) => remove(mpvSubtitlePathRef.current).catch(() => {}))
          .catch(() => {});
        mpvSubtitlePathRef.current = '';
      }
      if (mpvActiveRef.current && mpvApiRef.current) {
        mpvApiRef.current.destroy().catch(err => console.warn('Failed to destroy LibMPV instance:', err));
        if (mpvUnlistenRef.current) {
          mpvUnlistenRef.current();
          mpvUnlistenRef.current = null;
        }
        mpvActiveRef.current = false;
        mpvInitializedRef.current = false;
        mpvObservingRef.current = false;
        mpvLastPauseRef.current = null;
      }
    };
  }, [resolvedId, useLibmpv]);

  // Effect to collect stats for nerds
  useEffect(() => {
    if (showStats) {
      if (useLibmpv) {
        const videoTrack = selectedSource?.MediaStreams?.find(s => s.Type === 'Video');
        const audioTrack = selectedSource?.MediaStreams?.find(s => s.Type === 'Audio');
        const height = videoTrack?.Height || 0;
        const width = videoTrack?.Width || 0;

        setStats({
          videoResolution: height && width ? `${width}x${height}` : 'Unknown',
          currentBitrate: selectedSource?.Bitrate || 0,
          bufferHealth: Math.round(mpvCacheDuration * 10) / 10,
          droppedFrames: 0,
          totalFrames: 0,
          downloadSpeed: mpvCacheSpeed || 0,
          latency: 0,
          codec: videoTrack?.Codec?.toUpperCase() || 'Unknown',
          audioCodec: audioTrack?.Codec?.toUpperCase() || 'Unknown',
          container: selectedSource?.Container?.toUpperCase() || 'Unknown',
          hlsLatency: 0,
          bandwidth: mpvCacheSpeed || 0,
        });
        return;
      }

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
  }, [showStats, selectedSource, useLibmpv, mpvCacheDuration, mpvCacheSpeed]);

  useEffect(() => {
    if (!useLibmpv || !mpvApiRef.current || !mpvActiveRef.current) return;
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    const zoomFactor = autoZoomEnabled ? detectedZoom : videoZoom;
    const zoomLog2 = Math.log2(Math.max(0.1, zoomFactor));
    const panY = autoZoomEnabled ? clamp(detectedOffset / 100, -1, 1) : 0;
    mpvApiRef.current.setProperty('video-zoom', zoomLog2).catch(() => {});
    mpvApiRef.current.setProperty('video-pan-y', panY).catch(() => {});
  }, [autoZoomEnabled, detectedOffset, detectedZoom, useLibmpv, videoZoom]);


  useEffect(() => {
    if (!useLibmpv || !mpvApiRef.current || !mpvActiveRef.current) return;
    if (!customSubtitleUrl) {
      mpvApiRef.current.command('sub-remove', ['all']).catch(() => {});
      mpvApiRef.current.setProperty('sub-visibility', false).catch(() => {});
      if (mpvSubtitlePathRef.current) {
        import('@tauri-apps/plugin-fs')
          .then(({ remove }) => remove(mpvSubtitlePathRef.current).catch(() => {}))
          .catch(() => {});
        mpvSubtitlePathRef.current = '';
      }
      return;
    }
    mpvApiRef.current.setProperty('sub-visibility', true).catch(() => {});
    mpvApiRef.current.command('sub-add', [customSubtitleUrl, 'select']).catch(() => {});
  }, [customSubtitleUrl, useLibmpv]);

  useEffect(() => {
    if (!useLibmpv || !mpvApiRef.current || !mpvActiveRef.current) return;
    mpvApiRef.current.setProperty('sub-delay', subtitleDelay).catch(() => {});
  }, [subtitleDelay, useLibmpv]);

  // Effect to show "Up Next" popup when within 2 minutes of end
  useEffect(() => {
    if (nextEpisode && duration > 0 && currentTime > 0) {
      const timeRemaining = duration - currentTime;
      const twoMinutes = 120; // 2 minutes in seconds
      
      if (timeRemaining <= twoMinutes && timeRemaining > 0 && !upNextDismissed) {
        setShowUpNext(true);
      } else if (timeRemaining > twoMinutes) {
        // Reset dismissed state when user seeks back past the 2-minute mark
        setUpNextDismissed(false);
        setShowUpNext(false);
      }
    } else {
      setShowUpNext(false);
    }
  }, [currentTime, duration, nextEpisode, upNextDismissed]);

  // Effect to manage custom subtitle track visibility
  useEffect(() => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    const textTracks = video.textTracks;
    
    // Hide all tracks first
    for (let i = 0; i < textTracks.length; i++) {
      textTracks[i].mode = 'hidden';
    }
    
    if (customSubtitleUrl && textTracks.length > 0) {
      const track = textTracks[0];
      track.mode = 'showing';
      // Some browsers need a tick before cues appear
      const t = window.setTimeout(() => {
        if (track.mode !== 'showing') {
          track.mode = 'showing';
        }
      }, 300);
      return () => window.clearTimeout(t);
    }
  }, [customSubtitleUrl]);

  useEffect(() => {
    if (useLibmpv || !isInTauri) return;
    if (!customSubtitleUrl) return;
    if (
      customSubtitleUrl.startsWith('blob:') ||
      customSubtitleUrl.startsWith('http://') ||
      customSubtitleUrl.startsWith('https://') ||
      customSubtitleUrl.startsWith('tauri://')
    ) {
      return;
    }
    const looksLikeFilePath = /^[a-zA-Z]:\\/.test(customSubtitleUrl) || customSubtitleUrl.startsWith('/');
    if (!looksLikeFilePath) return;

    let cancelled = false;
    import('@tauri-apps/plugin-fs')
      .then(({ readTextFile }) => readTextFile(customSubtitleUrl))
      .then((text) => {
        if (cancelled) return;
        if (subtitleBlobUrlRef.current) {
          URL.revokeObjectURL(subtitleBlobUrlRef.current);
        }
        const blob = new Blob([text], { type: 'text/vtt' });
        const url = URL.createObjectURL(blob);
        subtitleBlobUrlRef.current = url;
        setCustomSubtitleUrl(url);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [customSubtitleUrl, isInTauri, useLibmpv]);

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
        if (showAudioMenu || showSubtitleMenu || showFilterMenu || showZoomMenu) {
          e.preventDefault();
          e.stopPropagation();
          setShowAudioMenu(false);
          setShowSubtitleMenu(false);
          setShowFilterMenu(false);
          setShowZoomMenu(false);
        }
      }
    };

    window.addEventListener('keydown', handleMenuClose, true);
    return () => window.removeEventListener('keydown', handleMenuClose, true);
  }, [showAudioMenu, showSubtitleMenu, showFilterMenu, showZoomMenu]);

  // Effect to auto-focus first menu item when audio/subtitle menu opens
  useEffect(() => {
    if (showAudioMenu || showSubtitleMenu || showFilterMenu || showZoomMenu) {
      // Small delay to let the menu render
      setTimeout(() => {
        const menuItem = document.querySelector('[role="menu"] [role="menuitem"]') as HTMLElement;
        if (menuItem) {
          menuItem.focus();
        }
      }, 50);
    }
  }, [showAudioMenu, showSubtitleMenu, showFilterMenu, showZoomMenu]);

  // Effect to handle video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    const updateTime = () => {
      // Don't update currentTime state while seeking or dragging - it causes the progress bar to bounce back
      if (!isSeekingRef.current) {
        setCurrentTime(video.currentTime);
      }
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
      localStorage.setItem(VOLUME_STORAGE_KEY, String(video.volume));
      localStorage.setItem(MUTE_STORAGE_KEY, String(video.muted));
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

  useEffect(() => {
    if (useLibmpv) return;
    const video = videoRef.current;
    if (!video || !streamUrl) return;
    const nextVolume = clampVolume(volume);
    if (video.volume !== nextVolume) {
      video.volume = nextVolume;
    }
    if (video.muted !== isMuted) {
      video.muted = isMuted;
    }
  }, [isMuted, streamUrl, useLibmpv, volume]);

  // Effect for automatic black bar detection
  useEffect(() => {
    if (!autoZoomEnabled || !videoRef.current || !streamUrl || isCollapsedView || useLibmpv) {
      // Clean up interval if auto mode is disabled
      if (autoZoomIntervalRef.current) {
        clearInterval(autoZoomIntervalRef.current);
        autoZoomIntervalRef.current = null;
      }
      // Reset to no zoom when auto is disabled
      if (!autoZoomEnabled) {
        setDetectedZoom(1.0);
        setDetectedOffset(0);
        setAutoZoomLocked(false);
        autoZoomLockedRef.current = false;
        autoZoomSampleStartRef.current = null;
        autoZoomSamplesRef.current = [];
        autoZoomCandidateRef.current = null;
      }
      return;
    }

    // Reset lock/sampling for each new auto-zoom session
    setDetectedZoom(1.0);
    setDetectedOffset(0);
    setAutoZoomLocked(false);
    autoZoomLockedRef.current = false;
    autoZoomSampleStartRef.current = null;
    autoZoomSamplesRef.current = [];
    autoZoomCandidateRef.current = null;

    const video = videoRef.current;
    
    // Create canvas if it doesn't exist
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!ctx) return;

    const getMedian = (values: number[]): number => {
      if (values.length === 0) return 1.0;
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    };

    const detectBlackBars = () => {
      if (!video || video.readyState < 2 || video.videoWidth === 0) return;
      if (autoZoomLockedRef.current) return;
      
      // Set canvas size to match video
      const width = video.videoWidth;
      const height = video.videoHeight;
      canvas.width = width;
      canvas.height = height;
      
      try {
        // Draw current video frame to canvas
        ctx.drawImage(video, 0, 0, width, height);
        
        // Get image data for analysis
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // Function to check if a pixel is near-black (threshold for black bars)
        const isNearBlack = (r: number, g: number, b: number): boolean => {
          // Consider pixels with RGB values all below 15 as black bars
          return r < 15 && g < 15 && b < 15;
        };
        
        // Function to get average brightness of a row
        const getRowBrightness = (y: number): number => {
          let totalBrightness = 0;
          const samplePoints = 20;
          
          for (let i = 0; i < samplePoints; i++) {
            const x = Math.floor((width / samplePoints) * i);
            const pixelIndex = (y * width + x) * 4;
            const r = data[pixelIndex];
            const g = data[pixelIndex + 1];
            const b = data[pixelIndex + 2];
            totalBrightness += (r + g + b) / 3;
          }
          
          return totalBrightness / samplePoints;
        };
        
        // Scan from top to find where black bar ends
        let topBlackBarHeight = 0;
        for (let y = 0; y < height / 2; y++) {
          let blackPixelCount = 0;
          const samplePoints = 20; // Sample 20 points across the width
          
          for (let i = 0; i < samplePoints; i++) {
            const x = Math.floor((width / samplePoints) * i);
            const pixelIndex = (y * width + x) * 4;
            const r = data[pixelIndex];
            const g = data[pixelIndex + 1];
            const b = data[pixelIndex + 2];
            
            if (isNearBlack(r, g, b)) {
              blackPixelCount++;
            }
          }
          
          // If more than 80% of sampled pixels are black, this row is part of the bar
          if (blackPixelCount > samplePoints * 0.8) {
            topBlackBarHeight = y + 1;
          } else {
            break;
          }
        }
        
        // Scan from bottom to find where black bar starts
        let bottomBlackBarHeight = 0;
        for (let y = height - 1; y > height / 2; y--) {
          let blackPixelCount = 0;
          const samplePoints = 20;
          
          for (let i = 0; i < samplePoints; i++) {
            const x = Math.floor((width / samplePoints) * i);
            const pixelIndex = (y * width + x) * 4;
            const r = data[pixelIndex];
            const g = data[pixelIndex + 1];
            const b = data[pixelIndex + 2];
            
            if (isNearBlack(r, g, b)) {
              blackPixelCount++;
            }
          }
          
          if (blackPixelCount > samplePoints * 0.8) {
            bottomBlackBarHeight = height - y;
          } else {
            break;
          }
        }
        
        // Calculate total black bar height
        const totalBlackBars = topBlackBarHeight + bottomBlackBarHeight;
        
        // Only apply zoom if significant black bars detected (at least 5% of height)
        if (totalBlackBars > height * 0.05) {
          // Verify these are actual letterbox bars by checking contrast
          // Get brightness of the detected bars
          const topBarBrightness = topBlackBarHeight > 0 ? getRowBrightness(Math.floor(topBlackBarHeight / 2)) : 0;
          const bottomBarBrightness = bottomBlackBarHeight > 0 ? getRowBrightness(height - Math.floor(bottomBlackBarHeight / 2)) : 0;
          const avgBarBrightness = (topBarBrightness + bottomBarBrightness) / 2;
          
          // Get brightness of content area (middle of the video)
          const contentBrightness = getRowBrightness(Math.floor(height / 2));
          
          // Only zoom if bars are significantly darker than content (at least 40 brightness units difference)
          // This prevents dark scenes from being mistaken as letterbox bars
          if (contentBrightness - avgBarBrightness > 40) {
            const contentHeight = height - totalBlackBars;
            const zoomFactor = height / contentHeight;
            
            // Calculate vertical offset to center the content
            const offsetPercent = ((topBlackBarHeight - bottomBlackBarHeight) / height) * 100 * zoomFactor;

            const now = performance.now();
            if (!autoZoomSampleStartRef.current) {
              autoZoomSampleStartRef.current = now;
            }
            autoZoomSamplesRef.current.push({ zoom: zoomFactor, offset: offsetPercent });

            if (!autoZoomCandidateRef.current) {
              autoZoomCandidateRef.current = { zoom: zoomFactor, offset: offsetPercent };
              setDetectedZoom(zoomFactor);
              setDetectedOffset(offsetPercent);
            }

            const start = autoZoomSampleStartRef.current;
            if (start && now - start >= 10000) {
              const samples = autoZoomSamplesRef.current;
              if (samples.length > 0) {
                const medianZoom = getMedian(samples.map(s => s.zoom));
                const medianOffset = getMedian(samples.map(s => s.offset));
                setDetectedZoom(medianZoom);
                setDetectedOffset(medianOffset);
              }
              setAutoZoomLocked(true);
              autoZoomLockedRef.current = true;
              if (autoZoomIntervalRef.current) {
                clearInterval(autoZoomIntervalRef.current);
                autoZoomIntervalRef.current = null;
              }
            }
          }
          // If bars are not dark enough compared to content, treat as invalid and keep waiting
        }
        // If no significant black bars detected, treat as invalid and keep waiting
      } catch (err) {
        console.error('Error detecting black bars:', err);
      }
    };
    
    // Initial detection
    setTimeout(detectBlackBars, 1000);
    
    // Run detection every 3 seconds
    autoZoomIntervalRef.current = window.setInterval(detectBlackBars, 3000);
    
    return () => {
      if (autoZoomIntervalRef.current) {
        clearInterval(autoZoomIntervalRef.current);
        autoZoomIntervalRef.current = null;
      }
    };
  }, [autoZoomEnabled, isCollapsedView, streamUrl, useLibmpv]);

  // MPV auto-zoom: compute fill zoom from video aspect vs container aspect
  useEffect(() => {
    if (!useLibmpv || !autoZoomEnabled || !streamUrl || isCollapsedView) {
      return;
    }
    const autoZoom = getMpvAutoZoom(mpvVideoParams);
    if (autoZoom === null) return;
    setDetectedZoom(autoZoom);
    setDetectedOffset(0);
    setAutoZoomLocked(true);
    autoZoomLockedRef.current = true;
  }, [autoZoomEnabled, isCollapsedView, mpvVideoParams, streamUrl, useLibmpv]);

  useEffect(() => {
    if (!useLibmpv || !autoZoomEnabled) return;
    const handleResize = () => {
      setAutoZoomLocked(false);
      autoZoomLockedRef.current = false;
      const autoZoom = getMpvAutoZoom(mpvVideoParams);
      if (autoZoom === null) return;
      setDetectedZoom(autoZoom);
      setDetectedOffset(0);
      setAutoZoomLocked(true);
      autoZoomLockedRef.current = true;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [autoZoomEnabled, mpvVideoParams, useLibmpv]);

  const handleMouseMove = () => {
    // On Android TV, some devices generate synthetic mousemove events
    // that would keep controls from hiding. Ignore mouse moves on TV.
    if (isAndroidTV) return;
    setShowControls(true);
    
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    
    hideTimeoutRef.current = setTimeout(() => {
      if (!showAudioMenu && !showSubtitleMenu && !showFilterMenu && !showZoomMenu) {
        setShowControls(false);
      }
    }, 3000);
  };

  const getSubdlSearchParams = async (override?: { useFullSeason?: boolean; useSelectedTitle?: boolean }) => {
    const apiKey = localStorage.getItem('subdl_apiKey') || '';
    const languages = (localStorage.getItem('subdl_languages') || 'EN').trim();
    if (!apiKey || !item) return null;

    const params: Record<string, string> = { api_key: apiKey };
    if (languages) params.languages = languages;

    let imdbId = item.ProviderIds?.Imdb;
    let tmdbId = item.ProviderIds?.Tmdb;
    const manualQuery = subdlManualQuery.trim();
    if (manualQuery) {
      params.film_name = manualQuery;
      params.type = item.Type === 'Episode' ? 'tv' : 'movie';
      if (item.ParentIndexNumber) params.season_number = String(item.ParentIndexNumber);
      if (item.IndexNumber) params.episode_number = String(item.IndexNumber);
      if (item.ProductionYear) params.year = String(item.ProductionYear);
      if (override?.useFullSeason) params.full_season = '1';
      params.subs_per_page = '30';
      return params;
    }
    const useSelectedTitle = (override?.useSelectedTitle ?? true) && subdlSelectedTitleId;
    if (useSelectedTitle) {
      params.sd_id = subdlSelectedTitleId;
      params.type = item.Type === 'Episode' ? 'tv' : 'movie';
      if (item.ParentIndexNumber) params.season_number = String(item.ParentIndexNumber);
      if (item.IndexNumber) params.episode_number = String(item.IndexNumber);
      if (override?.useFullSeason) params.full_season = '1';
      params.subs_per_page = '30';
      return params;
    }

    if (item.Type === 'Episode') {
      params.type = 'tv';
      if ((!imdbId && !tmdbId) && item.SeriesId) {
        try {
          const seriesItem = await embyApi.getItem(item.SeriesId);
          imdbId = seriesItem?.ProviderIds?.Imdb || imdbId;
          tmdbId = seriesItem?.ProviderIds?.Tmdb || tmdbId;
        } catch (err) {
          // Silent: fallback to name search if series IDs are unavailable
        }
      }
      if (imdbId) params.imdb_id = imdbId;
      if (tmdbId) params.tmdb_id = tmdbId;
      const hasStrongId = Boolean(imdbId || tmdbId);
      if (!hasStrongId) params.film_name = item.SeriesName || item.Name;
      if (item.ParentIndexNumber) params.season_number = String(item.ParentIndexNumber);
      if (item.IndexNumber) params.episode_number = String(item.IndexNumber);
      if (item.ProductionYear) params.year = String(item.ProductionYear);
      if (override?.useFullSeason) params.full_season = '1';
    } else {
      params.type = 'movie';
      if (imdbId) params.imdb_id = imdbId;
      if (tmdbId) params.tmdb_id = tmdbId;
      const hasStrongId = Boolean(imdbId || tmdbId);
      if (!hasStrongId) params.film_name = item.Name;
      if (item.ProductionYear) params.year = String(item.ProductionYear);
    }

    params.subs_per_page = '30';
    return params;
  };

  const searchSubdlSubtitles = async () => {
    const params = await getSubdlSearchParams();
    if (!params) {
      setSubdlError('Add your SubDL API key in Settings to search for subtitles.');
      return;
    }

    setIsSubdlSearching(true);
    setSubdlError('');
    setSubdlResults([]);
    setSubdlTitles([]);

    const runSearch = async (searchParams: Record<string, string>) => {
      const query = new URLSearchParams(searchParams).toString();
      const response = await fetch(`https://api.subdl.com/api/v1/subtitles?${query}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const data = await response.json();
      return data;
    };

    try {
      let data = await runSearch(params);
      if (!data?.status && typeof data?.error === 'string' && data.error.toLowerCase().includes("can't find movie or tv")) {
        // Fallback 1: drop IDs (they might be episode IDs), keep season/episode with series name
        const fallbackParams = { ...params };
        delete fallbackParams.imdb_id;
        delete fallbackParams.tmdb_id;
        if (item?.Type === 'Episode') {
          fallbackParams.type = 'tv';
          fallbackParams.film_name = item.SeriesName || item.Name;
        }
        data = await runSearch(fallbackParams);

        // Fallback 2: broader TV search without season/episode/year
        if (!data?.status && typeof data?.error === 'string' && data.error.toLowerCase().includes("can't find movie or tv")) {
          const fallbackBroad = { ...fallbackParams };
          delete fallbackBroad.episode_number;
          delete fallbackBroad.season_number;
          delete fallbackBroad.year;
          fallbackBroad.full_season = '1';
          data = await runSearch(fallbackBroad);
        }
      }

      if (!data?.status) {
        setSubdlError(data?.error || 'SubDL search failed.');
        setIsSubdlSearching(false);
        return;
      }

      const titles = Array.isArray(data?.results) ? data.results : [];
      setSubdlTitles(titles);
      if (titles.length > 0 && !subdlSelectedTitleId) {
        const firstId = String(titles[0]?.sd_id ?? '');
        if (firstId) setSubdlSelectedTitleId(firstId);
      }

      let subtitles = Array.isArray(data?.subtitles) ? data.subtitles : [];
      if (item?.Type === 'Episode' && item.ParentIndexNumber && item.IndexNumber) {
        const seasonTarget = item.ParentIndexNumber;
        const episodeTarget = item.IndexNumber;
        const matchEpisode = (sub: any) => {
          const season =
            sub?.season_number ?? sub?.season ?? sub?.seasonNumber ?? sub?.season_num ?? sub?.seasonNo ?? sub?.s;
          const episode =
            sub?.episode_number ?? sub?.episode ?? sub?.episodeNumber ?? sub?.episode_num ?? sub?.episodeNo ?? sub?.e;
          const episodeFrom =
            sub?.episode_from ?? sub?.episodeFrom ?? sub?.from_episode ?? sub?.from ?? sub?.episode_start;
          const episodeEnd =
            sub?.episode_end ?? sub?.episodeEnd ?? sub?.to_episode ?? sub?.to ?? sub?.episode_stop;

          if (season == null) return false;
          if (Number(season) !== seasonTarget) return false;

          if (episode != null) {
            return Number(episode) === episodeTarget;
          }
          if (episodeFrom != null && episodeEnd != null) {
            const start = Number(episodeFrom);
            const end = Number(episodeEnd);
            return episodeTarget >= start && episodeTarget <= end;
          }
          return false;
        };
        const exact = subtitles.filter(matchEpisode);
          if (exact.length === 0 && subtitles.length > 0) {
            // Keep list as-is; full-season fallback may still apply.
          }
        if (exact.length > 0) {
          subtitles = exact;
        }
      }
      if (item?.Type === 'Episode' && subtitles.length === 0) {
        const fullSeasonParams = await getSubdlSearchParams({ useFullSeason: true, useSelectedTitle: true });
        if (fullSeasonParams) {
          const fullSeasonData = await runSearch(fullSeasonParams);
          if (fullSeasonData?.status) {
            const fullSubs = Array.isArray(fullSeasonData?.subtitles) ? fullSeasonData.subtitles : [];
            if (fullSubs.length > 0) {
              subtitles = fullSubs;
            }
          }
        }
      }
      if (subtitles.length === 0) {
        setSubdlError('No subtitles found for this title.');
      }
      setSubdlResults(subtitles);
    } catch (err) {
      console.error('SubDL search failed:', err);
      setSubdlError('SubDL search failed. Please try again.');
    } finally {
      setIsSubdlSearching(false);
    }
  };

  const extractSubtitleDownloadUrl = (subtitle: any): string | null => {
    const link = subtitle?.download_link || subtitle?.link || subtitle?.url || subtitle?.file;
    if (typeof link === 'string' && link.length > 0) {
      if (link.startsWith('http://') || link.startsWith('https://')) return link;
      if (link.startsWith('/')) return `https://dl.subdl.com${link}`;
      if (link.startsWith('subtitle/')) return `https://dl.subdl.com/${link}`;
      if (link.endsWith('.zip')) return `https://dl.subdl.com/${link}`;
      return link;
    }

    const id = subtitle?.subtitle_id || subtitle?.id || subtitle?.sd_id || subtitle?.sid;
    if (id) return `https://dl.subdl.com/subtitle/${id}.zip`;
    return null;
  };

  const srtToVtt = (srt: string): string => {
    const cleaned = srt.replace(/^\uFEFF/, '');
    const vtt = cleaned
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
    return `WEBVTT\n\n${vtt}`;
  };

  const pickSubtitleEntry = (entries: string[], season?: number, episode?: number): string => {
    const lower = entries.map(name => name.toLowerCase());
    const s = season ?? 0;
    const e = episode ?? 0;
    const s2 = s.toString().padStart(2, '0');
    const e2 = e.toString().padStart(2, '0');

    const byExt = (ext: string) => entries.filter(name => name.toLowerCase().endsWith(ext));
    const vtt = byExt('.vtt');
    const srt = byExt('.srt');
    const candidates = (vtt.length > 0 ? vtt : srt.length > 0 ? srt : entries);

    if (season && episode) {
      const patterns = [
        new RegExp(`s${s2}e${e2}`, 'i'),
        new RegExp(`s${s}e${e}`, 'i'),
        new RegExp(`${s2}x${e2}`, 'i'),
        new RegExp(`${s}x${e}`, 'i'),
        new RegExp(`s0?${s}e0?${e}`, 'i'),
        new RegExp(`season\\s*${s}.*episode\\s*${e}`, 'i'),
      ];
      for (const pattern of patterns) {
        const idx = lower.findIndex(name => pattern.test(name));
        if (idx >= 0) {
          return entries[idx];
        }
      }
      // Fallback: match episode only when season-specific patterns fail
      const episodeOnlyPatterns = [
        new RegExp(`e${e2}`, 'i'),
        new RegExp(`e${e}`, 'i'),
        new RegExp(`ep\\s*${e2}`, 'i'),
        new RegExp(`ep\\s*${e}`, 'i'),
      ];
      for (const pattern of episodeOnlyPatterns) {
        const idx = lower.findIndex(name => pattern.test(name));
        if (idx >= 0) {
          return entries[idx];
        }
      }
    }

    const fallback = candidates[0] || entries[0];
    return fallback;
  };

  const applySubtitleFromZip = async (zipBuffer: ArrayBuffer, subtitleLabel: string) => {
    const zipped = new Uint8Array(zipBuffer);
    const unzipped = unzipSync(zipped);

    const entries = Object.keys(unzipped);
    if (entries.length === 0) {
      throw new Error('Subtitle archive was empty.');
    }

    const chosen = pickSubtitleEntry(entries, item?.ParentIndexNumber, item?.IndexNumber);
    const content = unzipped[chosen];
    if (!content) {
      throw new Error('Subtitle file not found in archive.');
    }

    let subtitleText = strFromU8(content);
    if (chosen.toLowerCase().endsWith('.srt')) {
      subtitleText = srtToVtt(subtitleText);
    }

    if (subtitleBlobUrlRef.current) {
      URL.revokeObjectURL(subtitleBlobUrlRef.current);
    }
    if (useLibmpv && isInTauri) {
      const filePath = await writeSubtitleToTempFile(subtitleText);
      if (filePath) {
        setCustomSubtitleUrl(filePath);
      }
    } else {
      const blob = new Blob([subtitleText], { type: 'text/vtt' });
      const url = URL.createObjectURL(blob);
      subtitleBlobUrlRef.current = url;
      setCustomSubtitleUrl(url);
    }
    setCustomSubtitleLabel(subtitleLabel);
  };

  const writeSubtitleToTempFile = async (content: string): Promise<string | null> => {
    if (!isInTauri) return null;
    try {
      const { writeTextFile, mkdir, remove } = await import('@tauri-apps/plugin-fs');
      const baseDir = await appCacheDir();
      const dir = await join(baseDir, 'subtitles');
      await mkdir(dir, { recursive: true });
      if (mpvSubtitlePathRef.current) {
        await remove(mpvSubtitlePathRef.current).catch(() => {});
      }
      const filename = `subtitle-${Date.now()}-${Math.random().toString(36).slice(2)}.vtt`;
      const path = await join(dir, filename);
      await writeTextFile(path, content);
      mpvSubtitlePathRef.current = path;
      return path;
    } catch (err) {
      console.error('Failed to write subtitle file for MPV:', err);
      return null;
    }
  };

  const applySubtitleFromText = (subtitleText: string, subtitleLabel: string, formatHint?: string) => {
    let text = subtitleText;
    if (formatHint === 'srt' || (!subtitleText.startsWith('WEBVTT') && subtitleText.includes('-->'))) {
      text = srtToVtt(subtitleText);
    }

    if (subtitleBlobUrlRef.current) {
      URL.revokeObjectURL(subtitleBlobUrlRef.current);
    }
    if (useLibmpv && isInTauri) {
      void writeSubtitleToTempFile(text).then((filePath) => {
        if (filePath) {
          setCustomSubtitleUrl(filePath);
        }
      });
    } else {
      const blob = new Blob([text], { type: 'text/vtt' });
      const url = URL.createObjectURL(blob);
      subtitleBlobUrlRef.current = url;
      setCustomSubtitleUrl(url);
    }
    setCustomSubtitleLabel(subtitleLabel);
  };

  const downloadAndApplySubdlSubtitle = async (subtitle: any) => {
    try {
      const url = extractSubtitleDownloadUrl(subtitle);
      if (!url) {
        setSubdlError('Unable to determine subtitle download URL.');
        return;
      }
      setSubdlError('');
      const response = await fetch(url);
      if (!response.ok) {
        setSubdlError('Failed to download subtitle.');
        return;
      }
      const buffer = await response.arrayBuffer();
      const label = subtitle?.language || subtitle?.lang || subtitle?.release || subtitle?.name || 'Subtitle';

      const bytes = new Uint8Array(buffer);
      const isZip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
      if (isZip) {
        await applySubtitleFromZip(buffer, label);
      } else {
        const contentType = response.headers.get('content-type') || '';
        const formatHint = contentType.includes('text/vtt') ? 'vtt' : 'srt';
        const text = new TextDecoder('utf-8').decode(bytes);
        applySubtitleFromText(text, label, formatHint);
      }
      setShowSubtitleMenu(false);
    } catch (err) {
      console.error('Failed to apply subtitle:', err);
      setSubdlError('Failed to apply subtitle.');
    }
  };

  const handleMouseLeave = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    if (!showAudioMenu && !showZoomMenu) {
      setShowControls(false);
    }
  };

  // On TV/remotes there is no mousemove to kick off the initial auto-hide.
  // Ensure the controls auto-hide after a few seconds of inactivity.
  useEffect(() => {
    if (!isAndroidTV) return; // Desktop already handled by mouse events
    if (!showControls) return;

    // If menus are open, don't auto-hide
    if (showAudioMenu || showSubtitleMenu || showFilterMenu || showZoomMenu) return;

    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    hideTimeoutRef.current = window.setTimeout(() => {
      // Double-check menus are still closed before hiding
      if (!showAudioMenu && !showSubtitleMenu && !showFilterMenu && !showZoomMenu) {
        setShowControls(false);
      }
    }, 3000);

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    };
  }, [isAndroidTV, showControls, showAudioMenu, showSubtitleMenu, showFilterMenu, showZoomMenu]);

  useEffect(() => {
    if (!showSubtitleMenu) return;
    if (!item) return;
    const apiKey = localStorage.getItem('subdl_apiKey') || '';
    if (!apiKey) return;

    const languages = (localStorage.getItem('subdl_languages') || 'EN').trim();
    const searchKey = `${item.Id}:${languages}`;
    if (lastSubdlSearchKeyRef.current === searchKey && subdlResults.length > 0) {
      return;
    }
    lastSubdlSearchKeyRef.current = searchKey;
    searchSubdlSubtitles();
  }, [showSubtitleMenu, item?.Id]);

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

      const playbackInfo = await embyApi.getPlaybackInfo(resolvedId!);

      if (!playbackInfo.MediaSources || playbackInfo.MediaSources.length === 0) {
        setError('No playable media sources found');
        return;
      }

      setMediaSources(playbackInfo.MediaSources);
      setPlaySessionId(playbackInfo.PlaySessionId);

      // Get full item details including resume position
      const itemDetails = await embyApi.getItem(resolvedId!);
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
          const currentIndex = episodes.findIndex(ep => ep.Id === resolvedId);
          
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

  const loadVideoWithLibmpv = async (url: string, startPosition: number = 0) => {
    if (!useLibmpv) return;
    setIsVideoLoading(true);
    setError('');
    mpvLoadingResolvedRef.current = false;
    mpvLastTimePosRef.current = 0;
    mpvPauseRef.current = true;
    mpvCacheDurationRef.current = 0;
    mpvLoadStartRef.current = Date.now();
    mpvFirstTimePosRef.current = null;
    mpvFirstTimeWallRef.current = 0;
    setMpvVideoParams(null);

    const loadToken = ++loadTokenRef.current;
    const isStale = () => loadToken !== loadTokenRef.current;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (isStale()) return;

    try {
      if (!mpvApiRef.current) {
        const api = await import('tauri-plugin-libmpv-api');
        mpvApiRef.current = api;
      }

      const mpvApi = mpvApiRef.current;
      if (!mpvApi) return;

      if (!mpvInitializedRef.current) {
        const isWindows = /Windows/i.test(navigator.userAgent);
        await mpvApi.init({
          initialOptions: {
            'vo': 'gpu-next',
            ...(isWindows ? { 'gpu-context': 'd3d11' } : {}),
            'hwdec': 'auto',
            'hwdec-codecs': 'all',
            'vd-lavc-dr': 'yes',
            'cache': 'yes',
            'cache-secs': '1800',
            'cache-on-disk': 'no',
            'demuxer-max-bytes': '500M',
            'demuxer-max-back-bytes': '500M',
            'network-timeout': '30',
            'keep-open': 'yes',
            'force-window': 'yes',
          },
          observedProperties: MPV_OBSERVED_PROPERTIES,
        });
        mpvInitializedRef.current = true;
      }

      if (!mpvObservingRef.current) {
        if (mpvUnlistenRef.current) {
          mpvUnlistenRef.current();
          mpvUnlistenRef.current = null;
        }
        mpvUnlistenRef.current = await mpvApi.observeProperties(
          MPV_OBSERVED_PROPERTIES,
          (event) => {
            const { name, data } = event;
            const timePos = name === 'time-pos' && typeof data === 'number' ? data : undefined;
            const durationValue = name === 'duration' && typeof data === 'number' ? data : undefined;
            const pauseValue = name === 'pause' && typeof data === 'boolean' ? data : undefined;
            const volumeValue = name === 'volume' && typeof data === 'number' ? data : undefined;
            const muteValue = name === 'mute' && typeof data === 'boolean' ? data : undefined;
            const eofReached = name === 'eof-reached' && typeof data === 'boolean' ? data : false;
            const cacheDuration = name === 'demuxer-cache-duration' && typeof data === 'number' ? data : undefined;
            const cacheSpeed = name === 'cache-speed' && typeof data === 'number' ? data : undefined;

            if (typeof timePos === 'number') {
              setCurrentTime(timePos);
              mpvLastTimePosRef.current = timePos;
              if (mpvFirstTimePosRef.current === null) {
                mpvFirstTimePosRef.current = timePos;
                mpvFirstTimeWallRef.current = Date.now();
              }
              if (!mpvLoadingResolvedRef.current) {
                const startPos = mpvFirstTimePosRef.current ?? timePos;
                const elapsedMs = Date.now() - mpvFirstTimeWallRef.current;
                if (elapsedMs >= 1000 && timePos - startPos >= 1.0) {
                  setIsVideoLoading(false);
                  mpvLoadingResolvedRef.current = true;
                }
              }
              if (mpvPendingSeekRef.current !== null) {
                const seekTarget = mpvPendingSeekRef.current;
                mpvPendingSeekRef.current = null;
                mpvApiRef.current?.command('seek', [seekTarget, 'absolute', 'exact']).catch(() => {});
              }
            }
            if (typeof durationValue === 'number' && !Number.isNaN(durationValue)) {
              setDuration(durationValue);
              if (mpvPendingSeekRef.current !== null) {
                const seekTarget = mpvPendingSeekRef.current;
                mpvPendingSeekRef.current = null;
                mpvApiRef.current?.command('seek', [seekTarget, 'absolute', 'exact']).catch(() => {});
              }
            }
            if (typeof pauseValue === 'boolean') {
              mpvPauseRef.current = pauseValue;
              setIsPlaying(!pauseValue);
              const source = selectedSourceRef.current;
              const sessionId = playSessionIdRef.current;
              const itemId = resolvedIdRef.current;
              if (mpvLastPauseRef.current !== pauseValue && source && sessionId && itemId) {
                const positionTicks = Math.floor((timePos ?? currentTimeRef.current) * 10000000);
                embyApi.reportPlaybackProgress({
                  ItemId: itemId,
                  MediaSourceId: source.Id,
                  PlaySessionId: sessionId,
                  PositionTicks: positionTicks,
                  IsPaused: pauseValue,
                  EventName: pauseValue ? 'Pause' : 'Unpause',
                  PlayMethod: 'DirectPlay',
                }).catch(err => console.error('Failed to report pause state:', err));
                mpvLastPauseRef.current = pauseValue;
              }
            }
            if (typeof volumeValue === 'number') {
              setVolume(Math.max(0, Math.min(1, volumeValue / 100)));
            }
            if (typeof muteValue === 'boolean') {
              setIsMuted(muteValue);
            }
            if (typeof cacheDuration === 'number') {
              setMpvCacheDuration(cacheDuration);
              mpvCacheDurationRef.current = cacheDuration;
            }
            if (typeof cacheSpeed === 'number') {
              setMpvCacheSpeed(cacheSpeed);
            }
            if (name === 'video-params' && data && typeof data === 'object') {
              const params = data as { w?: number; h?: number; dw?: number; dh?: number; width?: number; height?: number; dwidth?: number; dheight?: number };
              const width = Number(params.dw ?? params.w ?? params.dwidth ?? params.width);
              const height = Number(params.dh ?? params.h ?? params.dheight ?? params.height);
              if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
                setMpvVideoParams({ width, height });
              }
            }
            if (eofReached) {
              const source = selectedSourceRef.current;
              const sessionId = playSessionIdRef.current;
              const itemId = resolvedIdRef.current;
              if (source && sessionId && itemId) {
                const positionTicks = Math.floor((durationValue ?? currentTimeRef.current) * 10000000);
                embyApi.reportPlaybackStopped({
                  ItemId: itemId,
                  MediaSourceId: source.Id,
                  PlaySessionId: sessionId,
                  PositionTicks: positionTicks,
                }).catch(err => console.error('Failed to report playback ended:', err));
              }

              const next = nextEpisodeRef.current;
              if (next) {
                navigate(`/player/${next.Id}`, { replace: true, state: { backgroundLocation: backgroundLocation ?? location } });
              }
            }
          }
        );
        mpvObservingRef.current = true;
      }

      if (isStale()) return;
      mpvActiveRef.current = true;
      await mpvApi.command('loadfile', [url, 'replace']);
      await mpvApi.setProperty('volume', Math.round(clampVolume(volume) * 100));
      await mpvApi.setProperty('mute', isMuted);
      await mpvApi.setProperty('pause', false);
      mpvPauseRef.current = false;
      mpvLastPauseRef.current = false;
      setIsPlaying(true);
      // Apply current filter/zoom/subtitles for LibMPV sessions
      try {
        const zoomFactor = autoZoomEnabled ? detectedZoom : videoZoom;
        const zoomLog2 = Math.log2(Math.max(0.1, zoomFactor));
        const panY = autoZoomEnabled ? Math.max(-1, Math.min(1, detectedOffset / 100)) : 0;
        await mpvApi.setProperty('video-zoom', zoomLog2);
        await mpvApi.setProperty('video-pan-y', panY);
        if (customSubtitleUrl) {
          await mpvApi.setProperty('sub-visibility', true);
          await mpvApi.command('sub-add', [customSubtitleUrl, 'select']);
          await mpvApi.setProperty('sub-delay', subtitleDelay);
        } else {
          await mpvApi.setProperty('sub-visibility', false);
        }
      } catch (err) {
        console.warn('Failed to apply MPV filters/zoom/subtitles:', err);
      }
      if (startPosition > 0) {
        mpvPendingSeekRef.current = startPosition;
      }
    } catch (err) {
      console.error('Failed to load video with LibMPV:', err);
      const errorMessage = String(err || '');
      if (isLinuxDesktop && /libmpv|not found|failed to load|LoadLibrary/i.test(errorMessage)) {
        setError(
          'LibMPV is not installed. Install it and restart Aether. ' +
          'Debian/Ubuntu: sudo apt update && sudo apt install libmpv2. ' +
          'Arch: sudo pacman -S mpv. ' +
          'Fedora: sudo dnf install mpv-libs. ' +
          'openSUSE: sudo zypper install libmpv-2.'
        );
      } else {
        setError('Failed to load video with LibMPV');
      }
      setIsVideoLoading(false);
    }
  };

  const loadVideo = async (url: string, startPosition: number = 0) => {
    if (!videoRef.current) return;

    console.log('Loading video URL:', url, 'Start position:', startPosition);

    const loadToken = ++loadTokenRef.current;
    const isStale = () => loadToken !== loadTokenRef.current;

    if (mpvActiveRef.current && mpvApiRef.current) {
      try {
        await mpvApiRef.current.destroy();
      } catch (err) {
        console.warn('Failed to destroy LibMPV instance:', err);
      }
      if (mpvUnlistenRef.current) {
        mpvUnlistenRef.current();
        mpvUnlistenRef.current = null;
      }
      mpvActiveRef.current = false;
      mpvInitializedRef.current = false;
      mpvObservingRef.current = false;
      mpvLastPauseRef.current = null;
    }

    // Destroy existing player instances - await to ensure clean state
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (isStale()) return;

    // Add video event listeners for playback reporting
    const video = videoRef.current;
    // Reset the media element to avoid MediaSource reuse issues
    video.removeAttribute('src');
    video.load();

    if (playbackHandlersRef.current) {
      video.removeEventListener('pause', playbackHandlersRef.current.pause);
      video.removeEventListener('play', playbackHandlersRef.current.play);
      video.removeEventListener('ended', playbackHandlersRef.current.ended);
      playbackHandlersRef.current = null;
    }
    
    const handlePause = () => {
      if (selectedSource) {
        const positionTicks = Math.floor(video.currentTime * 10000000);
        embyApi.reportPlaybackProgress({
          ItemId: resolvedId!,
          MediaSourceId: selectedSource.Id,
          PlaySessionId: playSessionId,
          PositionTicks: positionTicks,
          IsPaused: true,
          EventName: 'Pause',
          PlayMethod: 'DirectPlay',
        }).catch(err => console.error('Failed to report pause:', err));
      }
    };
    
    const handlePlay = () => {
      if (selectedSource) {
        const positionTicks = Math.floor(video.currentTime * 10000000);
        embyApi.reportPlaybackProgress({
          ItemId: resolvedId!,
          MediaSourceId: selectedSource.Id,
          PlaySessionId: playSessionId,
          PositionTicks: positionTicks,
          IsPaused: false,
          EventName: 'Unpause',
          PlayMethod: 'DirectPlay',
        }).catch(err => console.error('Failed to report unpause:', err));
      }
    };
    
    const handleEnded = () => {
      if (selectedSource) {
        const positionTicks = Math.floor(video.duration * 10000000);
        embyApi.reportPlaybackStopped({
          ItemId: resolvedId!,
          MediaSourceId: selectedSource.Id,
          PlaySessionId: playSessionId,
          PositionTicks: positionTicks,
        }).catch(err => console.error('Failed to report playback ended:', err));
      }
      
      // Auto-play next episode if available
      if (nextEpisode) {
        navigate(`/player/${nextEpisode.Id}`, { replace: true, state: { backgroundLocation: backgroundLocation ?? location } });
      }
    };
    
    video.addEventListener('pause', handlePause);
    video.addEventListener('play', handlePlay);
    video.addEventListener('ended', handleEnded);
    playbackHandlersRef.current = { pause: handlePause, play: handlePlay, ended: handleEnded };

    if (Hls.isSupported()) {
      if (isStale()) return;
      console.log('Using HLS.js');
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 300, // Keep 5 mins of back buffer
        maxBufferLength: 1800, // Buffer up to 30 minutes ahead
        maxMaxBufferLength: 1800,
        maxBufferSize: 2 * 1000 * 1000 * 1000, // 2GB buffer for 4K
        maxBufferHole: 0.5,
        // Continue buffering while paused - don't stop loading
        startFragPrefetch: true,
      });
      hlsRef.current = hls;
      if (isStale()) {
        hls.destroy();
        if (hlsRef.current === hls) {
          hlsRef.current = null;
        }
        return;
      }
      
      hls.loadSource(url);
      const videoElement = videoRef.current;
      if (!videoElement) {
        hls.destroy();
        if (hlsRef.current === hls) {
          hlsRef.current = null;
        }
        return;
      }
      hls.attachMedia(videoElement);
      
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
      if (isStale()) return;
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
      
      const url = embyApi.getStreamUrl(resolvedId!, source.Id, sessionId, source.Container, defaultAudio.Index);
      console.log('Stream URL:', url);
      setStreamUrl(url);
      
      // Report playback started with position
      const positionTicks = Math.floor(startPosition * 10000000);
      embyApi.reportPlaybackStart({
        ItemId: resolvedId!,
        MediaSourceId: source.Id,
        PlaySessionId: sessionId,
        PositionTicks: positionTicks,
        AudioStreamIndex: defaultAudio.Index,
        IsPaused: false,
        PlayMethod: 'DirectPlay',
      }).catch(err => console.error('Failed to report playback start:', err));
      
      // Start progress reporting interval (every 10 seconds)
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      progressIntervalRef.current = window.setInterval(() => {
        if (useLibmpv) {
          if (!isPlayingRef.current) return;
          const positionTicks = Math.floor(currentTimeRef.current * 10000000);
          if (Math.abs(positionTicks - lastReportedTimeRef.current) > 10000000) {
            lastReportedTimeRef.current = positionTicks;
            embyApi.reportPlaybackProgress({
              ItemId: resolvedId!,
              MediaSourceId: source.Id,
              PlaySessionId: sessionId,
              PositionTicks: positionTicks,
              AudioStreamIndex: selectedAudioIndex,
              IsPaused: false,
              EventName: 'TimeUpdate',
              PlayMethod: 'DirectPlay',
            }).catch(err => console.error('Failed to report progress:', err));
          }
          return;
        }

        if (videoRef.current && !videoRef.current.paused) {
          const positionTicks = Math.floor(videoRef.current.currentTime * 10000000);
          // Only report if position has changed significantly (at least 1 second)
          if (Math.abs(positionTicks - lastReportedTimeRef.current) > 10000000) {
            lastReportedTimeRef.current = positionTicks;
            embyApi.reportPlaybackProgress({
              ItemId: resolvedId!,
              MediaSourceId: source.Id,
              PlaySessionId: sessionId,
              PositionTicks: positionTicks,
              AudioStreamIndex: selectedAudioIndex,
              IsPaused: false,
              EventName: 'TimeUpdate',
              PlayMethod: 'DirectPlay',
            }).catch(err => console.error('Failed to report progress:', err));
          }
        }
      }, 10000);
      
      // Small delay to ensure video element is rendered
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
      loadTimeoutRef.current = window.setTimeout(() => {
        loadTimeoutRef.current = null;
        if (useLibmpv) {
          loadVideoWithLibmpv(url, startPosition);
        } else {
          loadVideo(url, startPosition);
        }
      }, 100);
    }
  };

  const handleAudioTrackChange = async (audioIndex: number) => {
    if (!selectedSource) return;
    
    const currentTime = useLibmpv ? currentTimeRef.current : (videoRef.current?.currentTime ?? 0);
    setSelectedAudioIndex(audioIndex);
    setShowAudioMenu(false);
    
    // Report playback stopped to end the current transcode session
    const positionTicks = Math.floor(currentTime * 10000000);
    try {
      await embyApi.reportPlaybackStopped({
        ItemId: resolvedId!,
        MediaSourceId: selectedSource.Id,
        PlaySessionId: playSessionId,
        PositionTicks: positionTicks,
      });
    } catch (err) {
      console.error('Failed to report playback stopped:', err);
    }
    
    // Destroy current player instances - await to ensure clean state
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (mpvActiveRef.current && mpvApiRef.current) {
      try {
        await mpvApiRef.current.destroy();
      } catch (err) {
        console.warn('Failed to destroy LibMPV instance:', err);
      }
      if (mpvUnlistenRef.current) {
        mpvUnlistenRef.current();
        mpvUnlistenRef.current = null;
      }
      mpvActiveRef.current = false;
      mpvInitializedRef.current = false;
      mpvObservingRef.current = false;
      mpvLastPauseRef.current = null;
    }
    
    // Get a new playback session
    try {
      const newPlaybackInfo = await embyApi.getPlaybackInfo(resolvedId!);
      const newSessionId = newPlaybackInfo.PlaySessionId;
      setPlaySessionId(newSessionId);
      
      const url = embyApi.getStreamUrl(resolvedId!, selectedSource.Id, newSessionId, selectedSource.Container, audioIndex);
      setStreamUrl(url);
      
      // Report playback start with new audio track
      await embyApi.reportPlaybackStart({
        ItemId: resolvedId!,
        MediaSourceId: selectedSource.Id,
        PlaySessionId: newSessionId,
        PositionTicks: positionTicks,
        AudioStreamIndex: audioIndex,
        IsPaused: false,
        PlayMethod: 'DirectPlay',
      });
      
      if (useLibmpv) {
        await loadVideoWithLibmpv(url, currentTime);
        return;
      }

      {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 300,
          maxBufferLength: 1800,
          maxMaxBufferLength: 1800,
          maxBufferSize: 2 * 1000 * 1000 * 1000,
          maxBufferHole: 0.5,
          // Continue buffering while paused - don't stop loading
          startFragPrefetch: true,
        });
        
        hls.loadSource(url);
        const videoElement = videoRef.current;
        if (!videoElement) {
          hls.destroy();
          return;
        }
        hls.attachMedia(videoElement);
        
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
      }
    } catch (err) {
      console.error('Failed to change audio track:', err);
      setError('Failed to change audio track. Please try again.');
    }
  };

  const handleBack = async () => {
    // Report playback stopped before navigating away
    if (selectedSource) {
      const seconds = useLibmpv ? currentTimeRef.current : (videoRef.current?.currentTime ?? 0);
      const positionTicks = Math.floor(seconds * 10000000);
      try {
        await embyApi.reportPlaybackStopped({
          ItemId: resolvedId!,
          MediaSourceId: selectedSource.Id,
          PlaySessionId: playSessionId,
          PositionTicks: positionTicks,
        });
      } catch (err) {
        console.error('Failed to report playback stopped:', err);
      }
    }
    if (mpvActiveRef.current && mpvApiRef.current) {
      try {
        await mpvApiRef.current.destroy();
      } catch (err) {
        console.warn('Failed to destroy LibMPV instance:', err);
      }
      if (mpvUnlistenRef.current) {
        mpvUnlistenRef.current();
        mpvUnlistenRef.current = null;
      }
      mpvActiveRef.current = false;
      mpvInitializedRef.current = false;
      mpvObservingRef.current = false;
      mpvLastPauseRef.current = null;
    }
    setSuppressAutoOpen(true);
    setActiveId(null);
    setIsCollapsed(false);
    navigate(lastNonPlayerPath || '/home', { replace: true });
  };

  const handleCollapse = () => {
    if (!resolvedId) return;
    setIsCollapsed(true);
    if (!backgroundLocation) {
      navigate(lastNonPlayerPath || '/home');
    }
  };

  const handleExpand = () => {
    if (!resolvedId) return;
    setIsCollapsed(false);
    navigate(`/player/${resolvedId}`, { state: { backgroundLocation: backgroundLocation ?? location } });
  };

  const handlePreviousEpisode = async () => {
    if (!prevEpisode) return;
    
    // Clean up current playback session
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    
    // Report playback stopped before navigating
    if (selectedSource) {
      const seconds = useLibmpv ? currentTimeRef.current : (videoRef.current?.currentTime ?? 0);
      const positionTicks = Math.floor(seconds * 10000000);
      try {
        await embyApi.reportPlaybackStopped({
          ItemId: resolvedId!,
          MediaSourceId: selectedSource.Id,
          PlaySessionId: playSessionId,
          PositionTicks: positionTicks,
        });
      } catch (err) {
        console.error('Failed to report playback stopped:', err);
      }
    }
    
    // Destroy player instances
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (mpvActiveRef.current && mpvApiRef.current) {
      try {
        await mpvApiRef.current.destroy();
      } catch (err) {
        console.warn('Failed to destroy LibMPV instance:', err);
      }
      if (mpvUnlistenRef.current) {
        mpvUnlistenRef.current();
        mpvUnlistenRef.current = null;
      }
      mpvActiveRef.current = false;
      mpvInitializedRef.current = false;
      mpvObservingRef.current = false;
      mpvLastPauseRef.current = null;
    }
    
    navigate(`/player/${prevEpisode.Id}`, { replace: true, state: { backgroundLocation: backgroundLocation ?? location } });
  };

  const handleNextEpisode = async () => {
    if (!nextEpisode) return;
    
    // Clean up current playback session
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    
    // Report playback stopped before navigating
    if (selectedSource) {
      const seconds = useLibmpv ? currentTimeRef.current : (videoRef.current?.currentTime ?? 0);
      const positionTicks = Math.floor(seconds * 10000000);
      try {
        await embyApi.reportPlaybackStopped({
          ItemId: resolvedId!,
          MediaSourceId: selectedSource.Id,
          PlaySessionId: playSessionId,
          PositionTicks: positionTicks,
        });
      } catch (err) {
        console.error('Failed to report playback stopped:', err);
      }
    }
    
    // Destroy player instances
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (mpvActiveRef.current && mpvApiRef.current) {
      try {
        await mpvApiRef.current.destroy();
      } catch (err) {
        console.warn('Failed to destroy LibMPV instance:', err);
      }
      if (mpvUnlistenRef.current) {
        mpvUnlistenRef.current();
        mpvUnlistenRef.current = null;
      }
      mpvActiveRef.current = false;
      mpvInitializedRef.current = false;
      mpvObservingRef.current = false;
      mpvLastPauseRef.current = null;
    }
    
    navigate(`/player/${nextEpisode.Id}`, { replace: true, state: { backgroundLocation: backgroundLocation ?? location } });
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
    if (!showAudioMenu && !showSubtitleMenu && !showZoomMenu) {
      hideTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [showAudioMenu, showSubtitleMenu, showZoomMenu]);

  // When controls become visible, move focus to the first control (seek bar or primary button)
  useEffect(() => {
    if (showControls) {
      // Small delay to allow opacity transition to apply and elements to be visible
      const t = setTimeout(() => {
        const active = document.activeElement as HTMLElement | null;
        const inControls = active?.closest('.player-ui');
        if (!inControls) {
          const first = document.querySelector<HTMLElement>(
            // Prefer a primary control like Play/Pause, then other buttons, then sliders
            '.player-ui .player-control, .player-ui button, .player-ui [role="slider"]'
          );
          first?.focus();
        }
      }, 50);
      return () => clearTimeout(t);
    }
  }, [showControls]);

  const toggleMute = useCallback(() => {
    if (useLibmpv && mpvApiRef.current) {
      const nextMuted = !isMuted;
      mpvApiRef.current.setProperty('mute', nextMuted).catch(() => {});
      setIsMuted(nextMuted);
      localStorage.setItem(MUTE_STORAGE_KEY, String(nextMuted));
      showControlsTemporarily();
      return;
    }
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
    localStorage.setItem(MUTE_STORAGE_KEY, String(videoRef.current.muted));
    showControlsTemporarily();
  }, [isMuted, showControlsTemporarily, useLibmpv]);

  const togglePlayPause = useCallback(() => {
    if (useLibmpv && mpvApiRef.current) {
      if (!mpvActiveRef.current) return;
      const nextPaused = isPlayingRef.current;
      mpvApiRef.current.setProperty('pause', nextPaused).catch(() => {});
      setIsPlaying(!nextPaused);
      return;
    }
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
  }, [useLibmpv]);

  // Effect to handle space bar for pause/unpause
  useEffect(() => {
    const handleSpaceBar = (e: KeyboardEvent) => {
      // Check if we're in an input field
      const target = e.target as HTMLElement;
      const isInInput = target?.tagName === 'INPUT' || 
                        target?.tagName === 'TEXTAREA' ||
                        target?.isContentEditable;
      
      // Only handle space bar for video pause/unpause
      if (e.key === ' ' && !isInInput) {
        e.preventDefault();
        e.stopPropagation();
        togglePlayPause();
      }
    };

    // Use capture phase to intercept before TV navigation
    window.addEventListener('keydown', handleSpaceBar, true);
    return () => window.removeEventListener('keydown', handleSpaceBar, true);
  }, [togglePlayPause]);

  // Helpers for keyboard-accelerated seeking on the seek bar
  const clampTime = (t: number, min: number, max: number) => Math.max(min, Math.min(max, t));
  const getSeekStep = (heldMs: number): number => {
    // Acceleration: start small then ramp up with hold duration
    if (heldMs > 6000) return 40; // 40s per tick
    if (heldMs > 3000) return 20; // 20s per tick
    if (heldMs > 1500) return 10; // 10s per tick
    if (heldMs > 800) return 5;   // 5s per tick
    return 2;                     // 2s initial
  };

  // Ref to track if we're in a click (mousedown without significant movement)
  const isClickRef = useRef(true);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);

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
      // Calculate the target time directly from the event to avoid stale state
      const rect = e.currentTarget.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const targetTime = pos * duration;
      setDragTime(targetTime);
      setCurrentTime(targetTime);
      
      // Seek immediately
      seekToTime(targetTime);
      setIsDragging(false);
      mouseDownPosRef.current = null;
    }
  };

  const updateSeekPosition = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!useLibmpv && !videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = pos * duration;
    setDragTime(time);
    // Don't seek immediately - let mouseUp handle it to prevent double-seeking
  };

  const seekToTime = (time: number) => {
    if (useLibmpv && mpvApiRef.current) {
      if (!mpvActiveRef.current || duration <= 0) return;
      isSeekingRef.current = true;
      mpvApiRef.current.command('seek', [time, 'absolute', 'exact']).catch(() => {});
      setCurrentTime(time);
      setTimeout(() => {
        isSeekingRef.current = false;
      }, 500);
      return;
    }
    if (!videoRef.current) return;
    isSeekingRef.current = true;
    videoRef.current.currentTime = time;
    setCurrentTime(time);
    
    // Clear seeking flag after video has had time to seek
    // The 'seeked' event would be ideal but this timeout is more reliable
    setTimeout(() => {
      isSeekingRef.current = false;
    }, 500);
  };

  // Global mouse up handler for dragging
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging && videoRef.current) {
        const targetTime = dragTime;
        setCurrentTime(targetTime);
        seekToTime(targetTime);
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
    };
  }, [isDragging, dragTime, duration]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    if (useLibmpv && mpvApiRef.current) {
      mpvApiRef.current.setProperty('volume', Math.round(newVolume * 100)).catch(() => {});
      setVolume(newVolume);
      localStorage.setItem(VOLUME_STORAGE_KEY, String(newVolume));
      if (newVolume > 0 && isMuted) {
        mpvApiRef.current.setProperty('mute', false).catch(() => {});
        setIsMuted(false);
        localStorage.setItem(MUTE_STORAGE_KEY, 'false');
      }
      return;
    }
    if (!videoRef.current) return;
    videoRef.current.volume = newVolume;
    setVolume(newVolume);
    localStorage.setItem(VOLUME_STORAGE_KEY, String(newVolume));
    if (newVolume > 0 && isMuted) {
      videoRef.current.muted = false;
      setIsMuted(false);
      localStorage.setItem(MUTE_STORAGE_KEY, 'false');
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
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 rounded-full border-2 border-white/10" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500/80 border-r-purple-500/80 animate-[spin_2.4s_linear_infinite]" />
            <div className="absolute inset-3 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 blur-sm opacity-60" />
            <div className="absolute inset-3 rounded-full bg-black" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-md animate-ping" />
                <svg className="relative w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor" aria-label="Loading">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="w-56 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 animate-[shimmer_1.6s_ease-in-out_infinite]" style={{backgroundSize:'200% 100%'}} />
          </div>
        </div>
      </div>
    );
  }

  // Video filter presets
  const filterPresets: { key: string; name: string; css: string }[] = [
    { key: 'normal', name: 'Normal', css: 'none' },
    { key: 'vibrant', name: 'Vibrant', css: 'saturate(1.3) contrast(1.05)' },
    { key: 'cinema', name: 'Cinema', css: 'contrast(1.1) brightness(0.95) saturate(1.1) hue-rotate(-3deg)' },
    { key: 'warm', name: 'Warm', css: 'sepia(0.06) saturate(1.1) brightness(1.02)' },
    { key: 'cool', name: 'Cool', css: 'brightness(1.02) saturate(0.95) hue-rotate(-8deg)' },
    { key: 'noir', name: 'Noir', css: 'grayscale(1) contrast(1.05)' },
    { key: 'high-contrast', name: 'High Contrast', css: 'contrast(1.2) brightness(0.98)' },
    { key: 'night', name: 'Night', css: 'brightness(0.85) contrast(1.05)' },
  ];

  const currentFilterCss = filterPresets.find(p => p.key === selectedFilter)?.css || 'none';

  const applyFilter = (key: string) => {
    setSelectedFilter(key);
    localStorage.setItem('player_videoFilter', key);
    setShowFilterMenu(false);
  };

  // Video zoom presets
  const zoomPresets: { value: number | 'auto'; label: string }[] = [
    { value: 'auto', label: 'Auto (Detect Black Bars)' },
    { value: 1.0, label: '100% (Default)' },
    { value: 1.1, label: '110%' },
    { value: 1.2, label: '120%' },
    { value: 1.3, label: '130%' },
    { value: 1.4, label: '140%' },
    { value: 1.5, label: '150%' },
    { value: 1.6, label: '160%' },
    { value: 1.7, label: '170%' },
    { value: 1.8, label: '180%' },
    { value: 2.0, label: '200%' },
  ];

  const applyZoom = (zoom: number | 'auto') => {
    if (zoom === 'auto') {
      setAutoZoomEnabled(true);
      setVideoZoom(1.0);
      localStorage.setItem('player_videoZoom', 'auto');
    } else {
      setAutoZoomEnabled(false);
      setVideoZoom(zoom);
      localStorage.setItem('player_videoZoom', zoom.toString());
    }
    setShowZoomMenu(false);
  };

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

  const posterUrl =
    item?.Type === 'Episode' && item.SeriesId
      ? embyApi.getImageUrl(item.SeriesId, 'Primary', { maxWidth: 1920 })
      : item?.ImageTags?.Primary
      ? embyApi.getImageUrl(item.Id, 'Primary', { maxWidth: 1920 })
      : undefined;

  return (
    <div className="relative">
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
          className={`player-ui fixed inset-0 z-50 ${
            useLibmpv && !isVideoLoading ? 'bg-transparent' : 'bg-black'
          } overflow-hidden border-t border-white/10 shadow-2xl motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)] [--mini-height:5rem] sm:[--mini-height:6rem]`}
          style={
            {
              transform: isCollapsedView ? 'translateY(calc(100% - var(--mini-height)))' : 'translateY(0)',
              ...(isCollapsedView && posterUrl
                ? {
                    backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.7) 45%, rgba(0,0,0,0.92) 100%), url(${posterUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : {}),
            }
          }
          onMouseMove={isCollapsedView ? undefined : handleMouseMove}
          onMouseLeave={isCollapsedView ? undefined : handleMouseLeave}
          onClick={(e) => {
            if (!useLibmpv || isCollapsedView) return;
            const target = e.target as HTMLElement;
            if (target.closest('.player-controls, .player-control, [role="menu"], button, input, select, textarea')) {
              return;
            }
            togglePlayPause();
          }}
        >
          {/* Header overlay */}
          {!isCollapsedView && (
            <div className={`absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-6 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 sm:gap-4">
                  <button
                    onClick={handleCollapse}
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all duration-200 hover:scale-105 active:scale-95"
                    title="Collapse player"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={handleBack}
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all duration-200 hover:scale-105 active:scale-95"
                    title="Close player"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
                  const width = videoStream?.Width || 0;
                  const codec = videoStream?.Codec?.toUpperCase() || '';
                  const bitrate = selectedSource.Bitrate ? Math.round(selectedSource.Bitrate / 1000000) : null;

                  // Consider cropped scope titles: treat 3840-wide as 4K even if height < 2160
                  let qualityLabel = '';
                  if (width >= 3800 || height >= 2160) qualityLabel = '4K';
                  else if (width >= 1920 || height >= 1080) qualityLabel = '1080p';
                  else if (width >= 1280 || height >= 720) qualityLabel = '720p';
                  else if (width >= 854 || height >= 480) qualityLabel = '480p';
                  else if (height > 0) qualityLabel = `${height}p`;

                  return (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-lg">
                      {qualityLabel && (
                        <span className={`text-sm font-bold ${(width >= 3800 || height >= 2160) ? 'text-yellow-400' : (width >= 1920 || height >= 1080) ? 'text-blue-400' : 'text-gray-300'}`}>
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
          )}

          {/* Video element */}
          <video
            ref={videoRef}
            autoPlay
            onClick={togglePlayPause}
            className={`w-full h-full cursor-pointer ${isCollapsedView || useLibmpv ? 'object-cover opacity-0 pointer-events-none' : 'object-contain'}`}
            style={{ 
              filter: currentFilterCss,
              transform: autoZoomEnabled 
                ? `scale(${detectedZoom}) translateY(${-detectedOffset}%)`
                : `scale(${videoZoom})`,
              transformOrigin: 'center center'
            }}
            crossOrigin="anonymous"
            poster={posterUrl}
          >
            {/* Subtitle tracks (HTML5 only) */}
            {customSubtitleUrl && !useLibmpv && (
              <track
                key={`subdl-${customSubtitleUrl}`}
                kind="subtitles"
                label={customSubtitleLabel || 'Subtitles'}
                srcLang="und"
                src={customSubtitleUrl}
                default
                onLoad={() => {
                  const video = videoRef.current;
                  if (!video) return;
                  if (video.textTracks.length > 0) {
                    video.textTracks[0].mode = 'showing';
                  }
                }}
                onError={() => {}}
              />
            )}
          </video>

          {isCollapsedView && (
            <div className="absolute top-0 left-0 right-0 z-40 h-[var(--mini-height)] flex items-center justify-between px-3 sm:px-4 bg-gradient-to-r from-black/85 via-black/50 to-black/85 backdrop-blur-sm">
              <button
                onClick={handleExpand}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all duration-200 hover:scale-105 active:scale-95"
                title="Expand player"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>

              <div className="flex items-center gap-3 flex-1 min-w-0 mx-3">
                {posterUrl && (
                  <img
                    src={posterUrl}
                    alt={item?.Name || 'Now playing'}
                    className="h-12 w-12 sm:h-14 sm:w-14 rounded-md object-cover shadow-lg border border-white/10"
                    loading="lazy"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-semibold truncate">{item?.Name || 'Now Playing'}</p>
                  {item?.SeriesName && (
                    <p className="text-gray-300 text-xs truncate">
                      {item.SeriesName}
                      {item.ParentIndexNumber !== undefined && item.IndexNumber !== undefined && (
                        <span className="ml-2 text-gray-400">
                          S{item.ParentIndexNumber.toString().padStart(2, '0')}E{item.IndexNumber.toString().padStart(2, '0')}
                        </span>
                      )}
                    </p>
                  )}
                  {duration > 0 && (
                    <p className="text-gray-300 text-[11px] sm:text-xs tabular-nums truncate">
                      {formatTime(currentTime)} / {formatTime(duration)}
                      <span className="text-gray-400"> • -{formatTime(Math.max(duration - currentTime, 0))}</span>
                      <span className="text-gray-500"> • Ends {getEndTime()}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlayPause();
                  }}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all duration-200 hover:scale-105 active:scale-95"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                {isPlaying ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBack();
                  }}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all duration-200 hover:scale-105 active:scale-95"
                  title="Close player"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Stats for nerds panel */}
          {!isCollapsedView && showStats && (
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
                  <span className="text-white truncate">{resolvedId}</span>
                  
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
          {!isCollapsedView && isVideoLoading && (
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
          {!isCollapsedView && showUpNext && nextEpisode && (
            <div className="absolute bottom-32 right-6 z-30 animate-fade-in">
              <div className="bg-black/90 backdrop-blur-md rounded-xl p-4 shadow-2xl border border-gray-700 max-w-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-400 text-xs uppercase tracking-wider">Up Next</p>
                  <button
                    onClick={() => {
                      setShowUpNext(false);
                      setUpNextDismissed(true);
                    }}
                    className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded"
                    title="Dismiss"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
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
          {!isCollapsedView && item?.Type === 'Episode' && (prevEpisode || nextEpisode) && (
            <div className={`absolute bottom-36 sm:bottom-24 left-1/2 -translate-x-1/2 z-20 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <div className="flex items-center gap-1 sm:gap-2 bg-black/60 backdrop-blur-md rounded-full px-2 sm:px-3 py-1.5 sm:py-2 border border-white/10" role="list" aria-label="Episode navigation">
                {/* Previous Episode */}
                <button
                  onClick={handlePreviousEpisode}
                  disabled={!prevEpisode}
                  className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full transition-all duration-200 ${
                    prevEpisode 
                      ? 'text-white hover:bg-white/20 hover:scale-105 active:scale-95' 
                      : 'text-gray-600 cursor-not-allowed opacity-50'
                  }`}
                  tabIndex={0}
                  role="listitem"
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
                  tabIndex={0}
                  className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full transition-all duration-200 ${
                    nextEpisode 
                      ? 'text-white hover:bg-white/20 hover:scale-105 active:scale-95' 
                      : 'text-gray-600 cursor-not-allowed opacity-50'
                  }`}
                  role="listitem"
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
          {!isCollapsedView && (
            <div className={`player-controls absolute bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-black/90 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
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
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    e.stopPropagation();
                    const dir = e.key === 'ArrowLeft' ? 'left' : 'right';
                    // Start or update hold-based scrubbing (no immediate seek)
                    if (!seekHoldIntervalRef.current || seekHoldDirRef.current !== dir) {
                      // Restart if direction changes
                      if (seekHoldIntervalRef.current) {
                        clearInterval(seekHoldIntervalRef.current);
                        seekHoldIntervalRef.current = null;
                      }
                      seekHoldDirRef.current = dir;
                      seekHoldStartRef.current = Date.now();
                      // Begin keyboard scrubbing from current position
                      if (!isDragging) {
                        const start = videoRef.current ? videoRef.current.currentTime : currentTime;
                        setDragTime(start);
                        setIsDragging(true);
                      }
                      // Immediate step for tap (5s), final seek happens on keyup
                      setDragTime((prev) => clampTime(prev + (dir === 'left' ? -5 : 5), 0, duration));
                      showControlsTemporarily();
                      // While holding, continue to move the thumb only (no seek yet)
                      seekHoldIntervalRef.current = window.setInterval(() => {
                        const heldMs = Date.now() - seekHoldStartRef.current;
                        const stepSec = getSeekStep(heldMs);
                        setDragTime((prev) => clampTime(prev + (seekHoldDirRef.current === 'left' ? -stepSec : stepSec), 0, duration));
                      }, 120);
                    }
                  }
                  // Up/Down are handled by spatial nav; do not block
                }}
                onKeyUp={(e) => {
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    if (seekHoldIntervalRef.current) {
                      clearInterval(seekHoldIntervalRef.current);
                      seekHoldIntervalRef.current = null;
                    }
                    seekHoldDirRef.current = null;
                    // Commit seek to the selected position
                    const target = isDragging ? dragTime : currentTime;
                    seekToTime(target);
                    setIsDragging(false);
                  }
                }}
                onBlur={() => {
                  if (seekHoldIntervalRef.current) {
                    clearInterval(seekHoldIntervalRef.current);
                    seekHoldIntervalRef.current = null;
                  }
                  seekHoldDirRef.current = null;
                  // If scrubbing was in progress, commit on blur
                  if (isDragging) {
                    seekToTime(dragTime);
                    setIsDragging(false);
                  }
                }}
              >
                {/* Buffer bar */}
                <div 
                  className="absolute h-full bg-gray-500 rounded-full pointer-events-none"
                  style={{ width: `${useLibmpv ? mpvBufferedPercent : bufferedPercentage}%` }}
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
                    className="absolute -top-8 -translate-x-1/2 bg-black/90 text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap z-[9999]"
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
                  tabIndex={0}
                  ref={playButtonFocusRef}
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
                    tabIndex={0}
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
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        playButtonFocusRef.current?.focus();
                      }
                    }}
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
          )}

          {/* Audio, Subtitle, Version selectors and other controls */}
          {!isCollapsedView && (
          <div className={`absolute bottom-24 right-6 z-20 transition-opacity duration-300 flex items-center gap-2 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} role="list" aria-label="Player options">
            {/* Version selector button */}
            {mediaSources.length > 1 && selectedSource && (
              <button
                onClick={() => setShowSelector(true)}
                className="player-control h-10 px-4 bg-black/60 hover:bg-black/80 text-white text-sm rounded-full transition-all duration-200 backdrop-blur-md border border-white/10 hover:border-white/20 hover:scale-105 active:scale-95 inline-flex items-center justify-center gap-2"
                tabIndex={0}
                role="listitem"
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span className="hidden sm:inline">
                  {(() => {
                    const videoStream = selectedSource.MediaStreams?.find(s => s.Type === 'Video');
                    const height = videoStream?.Height || 0;
                    const width = videoStream?.Width || 0;
                    let quality = '';
                    if (width >= 3800 || height >= 2160) quality = '4K';
                    else if (width >= 1920 || height >= 1080) quality = '1080p';
                    else if (width >= 1280 || height >= 720) quality = '720p';
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
              tabIndex={0}
              role="listitem"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>

            {/* Video filter button (HLS only) */}
            {!useLibmpv && (
              <div className="relative" role="listitem">
                <button
                  onClick={() => { setShowFilterMenu(!showFilterMenu); setShowAudioMenu(false); setShowSubtitleMenu(false); setShowZoomMenu(false); }}
                  className={`player-control px-4 py-2.5 bg-black/60 hover:bg-black/80 text-white text-sm rounded-full transition-all duration-200 backdrop-blur-md border hover:scale-105 active:scale-95 flex items-center gap-2 ${
                    selectedFilter !== 'normal' ? 'border-blue-500 bg-blue-500/20' : 'border-white/10 hover:border-white/20'
                  }`}
                  tabIndex={0}
                  title="Video Filters"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h18M6 12h12M10 19h4" />
                  </svg>
                  Filters
                </button>

                {showFilterMenu && (
                  <div className="absolute bottom-full mb-2 right-0 bg-gray-900/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl min-w-[220px] max-h-[300px] overflow-y-auto" role="menu">
                    {filterPresets.map(preset => (
                      <button
                        key={preset.key}
                        onClick={() => applyFilter(preset.key)}
                        className={`player-menu-item w-full px-4 py-3 text-left transition-all duration-150 border-b border-white/5 last:border-b-0 ${
                          selectedFilter === preset.key ? 'bg-blue-500/20 text-blue-400' : 'text-white hover:bg-white/10'
                        }`}
                        role="menuitem"
                      >
                        <div className="font-medium">{preset.name}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Video zoom button */}
            <div className="relative" role="listitem">
              <button
                onClick={() => { setShowZoomMenu(!showZoomMenu); setShowAudioMenu(false); setShowSubtitleMenu(false); setShowFilterMenu(false); }}
                className={`player-control px-4 py-2.5 bg-black/60 hover:bg-black/80 text-white text-sm rounded-full transition-all duration-200 backdrop-blur-md border hover:scale-105 active:scale-95 flex items-center gap-2 ${
                  autoZoomEnabled || videoZoom !== 1.0 ? 'border-blue-500 bg-blue-500/20' : 'border-white/10 hover:border-white/20'
                }`}
                tabIndex={0}
                title="Video Zoom - Remove Black Bars"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                </svg>
                Zoom
              </button>

              {showZoomMenu && (
                <div className="absolute bottom-full mb-2 right-0 bg-gray-900/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl min-w-[220px] max-h-[300px] overflow-y-auto" role="menu">
                  {zoomPresets.map(preset => (
                    <button
                      key={preset.value}
                      onClick={() => applyZoom(preset.value)}
                      className={`player-menu-item w-full px-4 py-3 text-left transition-all duration-150 border-b border-white/5 last:border-b-0 ${
                        (preset.value === 'auto' && autoZoomEnabled) || (preset.value === videoZoom && !autoZoomEnabled)
                          ? 'bg-blue-500/20 text-blue-400' 
                          : 'text-white hover:bg-white/10'
                      }`}
                      role="menuitem"
                    >
                      <div className="font-medium">{preset.label}</div>
                      {preset.value === 'auto' && autoZoomEnabled && detectedZoom > 1.0 && (
                        <div className="text-xs text-gray-400 mt-1">
                          {autoZoomLocked ? 'Locked' : 'Detected'}: {(detectedZoom * 100).toFixed(0)}%
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen button (hide on Android TV) */}
            {!isAndroidTV && (
              <button
                onClick={toggleFullscreen}
                className="player-control w-10 h-10 flex items-center justify-center bg-black/60 hover:bg-black/80 text-white rounded-full transition-all duration-200 backdrop-blur-md border border-white/10 hover:border-white/20 hover:scale-105 active:scale-95"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                tabIndex={0}
                role="listitem"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isFullscreen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  )}
                </svg>
              </button>
            )}

            {/* Subtitle selector (SubDL) */}
            {(useLibmpv || (localStorage.getItem('subdl_apiKey') || '').length > 0 || customSubtitleUrl) && (
              <div className="relative" role="listitem">
                <button
                  onClick={() => { setShowSubtitleMenu(!showSubtitleMenu); setShowAudioMenu(false); setShowFilterMenu(false); }}
                  className={`player-control px-4 py-2.5 bg-black/60 hover:bg-black/80 text-white text-sm rounded-full transition-all duration-200 backdrop-blur-md border hover:scale-105 active:scale-95 flex items-center gap-2 ${
                    customSubtitleUrl ? 'border-blue-500 bg-blue-500/20' : 'border-white/10 hover:border-white/20'
                  }`}
                  tabIndex={0}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  CC
                </button>

                {showSubtitleMenu && (
                  <div className="absolute bottom-full mb-2 right-0 bg-gray-900/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl min-w-[300px] max-h-[360px] overflow-y-auto" role="menu">
                    <div className="px-4 pt-4 pb-2 border-b border-white/5">
                      <div className="text-xs text-gray-400">SubDL Subtitles</div>
                      {((localStorage.getItem('subdl_apiKey') || '').length === 0) && (
                        <div className="text-xs text-gray-500 mt-1">
                          To use subtitles, set a SubDL key in Settings.
                        </div>
                      )}
                      {customSubtitleLabel ? (
                        <div className="text-sm text-blue-300 mt-1">Active: {customSubtitleLabel}</div>
                      ) : (
                        <div className="text-sm text-gray-300 mt-1">No subtitle selected</div>
                      )}
                    </div>

                    <div className="px-4 py-3 border-b border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs text-gray-400">Subtitle Delay</div>
                        <div className="text-xs text-gray-300 tabular-nums">
                          {subtitleDelay >= 0 ? '+' : ''}{subtitleDelay.toFixed(1)}s
                        </div>
                      </div>
                      <input
                        type="range"
                        min={-5}
                        max={5}
                        step={0.1}
                        value={subtitleDelay}
                        onChange={(e) => {
                          const next = Math.max(-5, Math.min(5, Number(e.target.value)));
                          setSubtitleDelay(next);
                          localStorage.setItem('player_subtitleDelay', String(next));
                        }}
                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0"
                        style={{
                          background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((subtitleDelay + 5) / 10) * 100}%, #374151 ${((subtitleDelay + 5) / 10) * 100}%, #374151 100%)`
                        }}
                      />
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSubtitleDelay(0);
                            localStorage.setItem('player_subtitleDelay', '0');
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 text-xs transition-all"
                        >
                          Reset
                        </button>
                        <div className="text-[11px] text-gray-500">
                          Negative = earlier, positive = later
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (subtitleBlobUrlRef.current) {
                          URL.revokeObjectURL(subtitleBlobUrlRef.current);
                          subtitleBlobUrlRef.current = '';
                        }
                        setCustomSubtitleUrl('');
                        setCustomSubtitleLabel('');
                        setShowSubtitleMenu(false);
                      }}
                      className="player-menu-item w-full px-4 py-3 text-left transition-all duration-150 border-b border-white/5 text-white hover:bg-white/10"
                      role="menuitem"
                    >
                      <div className="font-medium">Off</div>
                    </button>

                    <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                      <button
                        onClick={searchSubdlSubtitles}
                        className="px-3 py-2 rounded-lg bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 text-sm font-medium transition-all"
                      >
                        {isSubdlSearching ? 'Searching...' : 'Search Subtitles'}
                      </button>
                      <button
                        onClick={() => {
                          setSubdlResults([]);
                          setSubdlError('');
                          lastSubdlSearchKeyRef.current = '';
                          searchSubdlSubtitles();
                        }}
                        className="px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 text-sm transition-all"
                      >
                        Refresh
                      </button>
                    </div>

                    <div className="px-4 pb-3 border-b border-white/5">
                      <label className="block text-xs text-gray-400 mb-2">Custom Search</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={subdlManualQuery}
                          onChange={(e) => setSubdlManualQuery(e.target.value)}
                          placeholder="Search by title..."
                          className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                        />
                        <button
                          onClick={() => {
                            setSubdlResults([]);
                            setSubdlError('');
                            lastSubdlSearchKeyRef.current = '';
                            searchSubdlSubtitles();
                          }}
                          className="px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 text-sm transition-all"
                        >
                          Go
                        </button>
                      </div>
                    </div>

                    {subdlTitles.length > 0 && (
                      <div className="px-4 pb-3 border-b border-white/5">
                        <label className="block text-xs text-gray-400 mb-2">Matched Titles</label>
                        <select
                          value={subdlSelectedTitleId}
                          onChange={(e) => setSubdlSelectedTitleId(e.target.value)}
                          className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                        >
                          {subdlTitles.map((title) => {
                            const label = `${title?.name || title?.title || 'Unknown'}${title?.year ? ` (${title.year})` : ''}`;
                            const value = String(title?.sd_id ?? '');
                            return (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            );
                          })}
                        </select>
                        <button
                          onClick={() => {
                            setSubdlResults([]);
                            setSubdlError('');
                            lastSubdlSearchKeyRef.current = '';
                            searchSubdlSubtitles();
                          }}
                          className="mt-2 px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 text-sm transition-all"
                        >
                          Search Selected Title
                        </button>
                      </div>
                    )}

                    {subdlError && (
                      <div className="px-4 py-3 text-sm text-red-300 border-b border-white/5">{subdlError}</div>
                    )}

                    {subdlResults.length === 0 && !subdlError && !isSubdlSearching && (
                      <div className="px-4 py-3 text-sm text-gray-400 border-b border-white/5">
                        No results yet. Tap “Search Subtitles”.
                      </div>
                    )}

                    {subdlResults.map((subtitle, idx) => {
                      const label =
                        subtitle?.release_name ||
                        subtitle?.release ||
                        subtitle?.name ||
                        subtitle?.file_name ||
                        `Subtitle ${idx + 1}`;
                      const language = subtitle?.language || subtitle?.lang || '';
                      const hearing = subtitle?.hi ? 'HI' : '';
                      const fullSeason =
                        subtitle?.full_season ||
                        (subtitle?.episode_from && subtitle?.episode_end) ||
                        (typeof subtitle?.release_name === 'string' && /complete|full\s*season/i.test(subtitle.release_name));
                      return (
                        <button
                          key={`${subtitle?.id || subtitle?.subtitle_id || idx}`}
                          onClick={() => downloadAndApplySubdlSubtitle(subtitle)}
                          className="player-menu-item w-full px-4 py-3 text-left transition-all duration-150 border-b border-white/5 last:border-b-0 text-white hover:bg-white/10"
                          role="menuitem"
                        >
                          <div className="font-medium">
                            {language ? `${language.toUpperCase()} • ` : ''}{label}
                          </div>
                          {fullSeason && (
                            <div className="text-xs text-blue-300 mt-1">Full season pack</div>
                          )}
                          {(subtitle?.comment || hearing) && (
                            <div className="text-xs text-gray-400 mt-1">
                              {hearing && `${hearing} `}
                              {subtitle?.comment || ''}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Audio track selector */}
            {selectedSource && selectedSource.MediaStreams.filter(s => s.Type === 'Audio').length > 1 && (
              <div className="relative" role="listitem">
                <button
                  onClick={() => { setShowAudioMenu(!showAudioMenu); setShowSubtitleMenu(false); setShowFilterMenu(false); }}
                  className="player-control px-4 py-2.5 bg-black/60 hover:bg-black/80 text-white text-sm rounded-full transition-all duration-200 backdrop-blur-md border border-white/10 hover:border-white/20 hover:scale-105 active:scale-95 flex items-center gap-2"
                  tabIndex={0}
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
          )}
        </div>
      )}
    </div>
  );
}
