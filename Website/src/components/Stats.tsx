import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { embyApi } from '../services/embyApi';
import type { EmbyItem } from '../types/emby.types';
// Inline skeletons replace full-screen loading
import { Header } from './Header';
import { Footer } from './Footer';

interface WatchStats {
  totalMovies: number;
  totalEpisodes: number;
  totalSeries: number;
  totalWatchTimeTicks: number;
  favoriteGenres: { name: string; count: number }[];
  favoriteStudios: { name: string; count: number }[];
  recentlyWatched: EmbyItem[];
  mostWatched: EmbyItem[];
  oldestWatched: EmbyItem | null;
  newestWatched: EmbyItem | null;
  averageRating: number;
  totalItems: number;
  activeSessions: number;
  nowPlaying: number;
  sessions: any[];
}

export function Stats() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<WatchStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const statsRef = useRef<HTMLDivElement>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setIsLoading(true);

      // Fetch all played movies
      const playedMovies = await embyApi.getItems({
        recursive: true,
        includeItemTypes: 'Movie',
        filters: 'IsPlayed',
        fields: 'Genres,Studios,CommunityRating,RunTimeTicks,ProductionYear,UserData',
      });

      // Fetch all played episodes
      const playedEpisodes = await embyApi.getItems({
        recursive: true,
        includeItemTypes: 'Episode',
        filters: 'IsPlayed',
        fields: 'Genres,Studios,RunTimeTicks,SeriesName,UserData',
      });

      // Fetch played series (unique)
      const playedSeries = await embyApi.getItems({
        recursive: true,
        includeItemTypes: 'Series',
        filters: 'IsPlayed',
      });

      let activeSessions = 0;
      let nowPlaying = 0;
      let sessionsSnapshot: any[] = [];
      try {
        const sessions = await embyApi.getSessions();
        activeSessions = sessions.length;
        nowPlaying = sessions.filter((s: any) => s.NowPlayingItem).length;
        sessionsSnapshot = sessions;
      } catch (error) {
        console.warn('Failed to load sessions:', error);
      }

      // Calculate total watch time
      let totalWatchTimeTicks = 0;
      const genreCount: Record<string, number> = {};
      const studioCount: Record<string, number> = {};
      let totalRating = 0;
      let ratedCount = 0;

      // Process movies
      playedMovies.Items.forEach((movie) => {
        if (movie.RunTimeTicks) {
          totalWatchTimeTicks += movie.RunTimeTicks * (movie.UserData?.PlayCount || 1);
        }
        movie.Genres?.forEach((genre) => {
          genreCount[genre] = (genreCount[genre] || 0) + 1;
        });
        movie.Studios?.forEach((studio) => {
          studioCount[studio.Name] = (studioCount[studio.Name] || 0) + 1;
        });
        if (movie.CommunityRating) {
          totalRating += movie.CommunityRating;
          ratedCount++;
        }
      });

      // Process episodes
      playedEpisodes.Items.forEach((episode) => {
        if (episode.RunTimeTicks) {
          totalWatchTimeTicks += episode.RunTimeTicks * (episode.UserData?.PlayCount || 1);
        }
        episode.Genres?.forEach((genre) => {
          genreCount[genre] = (genreCount[genre] || 0) + 1;
        });
      });

      // Sort genres and studios
      const favoriteGenres = Object.entries(genreCount)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const favoriteStudios = Object.entries(studioCount)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Get most watched (by play count)
      const allItems = [...playedMovies.Items, ...playedEpisodes.Items];
      const mostWatched = allItems
        .filter((item) => (item.UserData?.PlayCount || 0) > 1)
        .sort((a, b) => (b.UserData?.PlayCount || 0) - (a.UserData?.PlayCount || 0))
        .slice(0, 10);

      // Find oldest and newest watched movies
      const moviesWithYear = playedMovies.Items.filter((m) => m.ProductionYear);
      const oldestWatched = moviesWithYear.length > 0
        ? moviesWithYear.reduce((a, b) => (a.ProductionYear! < b.ProductionYear! ? a : b))
        : null;
      const newestWatched = moviesWithYear.length > 0
        ? moviesWithYear.reduce((a, b) => (a.ProductionYear! > b.ProductionYear! ? a : b))
        : null;

      setStats({
        totalMovies: playedMovies.TotalRecordCount,
        totalEpisodes: playedEpisodes.TotalRecordCount,
        totalSeries: playedSeries.TotalRecordCount,
        totalWatchTimeTicks,
        favoriteGenres,
        favoriteStudios,
        recentlyWatched: [],
        mostWatched,
        oldestWatched,
        newestWatched,
        averageRating: ratedCount > 0 ? totalRating / ratedCount : 0,
        totalItems: playedMovies.TotalRecordCount + playedEpisodes.TotalRecordCount,
        activeSessions,
        nowPlaying,
        sessions: sessionsSnapshot,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatWatchTime = (ticks: number) => {
    const totalMinutes = Math.floor(ticks / 600000000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    return parts.join(' ') || '0m';
  };

  const formatWatchTimeDetailed = (ticks: number) => {
    const totalMinutes = Math.floor(ticks / 600000000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    const parts = [];
    if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
    return parts.join(', ') || '0 minutes';
  };

  const inlineStyles = (source: HTMLElement, target: HTMLElement) => {
    const computed = window.getComputedStyle(source);
    let cssText = '';
    for (const prop of computed) {
      // Avoid embedding external images that can taint the canvas
      if (prop === 'background-image' || prop === 'mask-image') continue;
      cssText += `${prop}:${computed.getPropertyValue(prop)};`;
    }
    target.setAttribute('style', cssText);
    const sourceChildren = Array.from(source.children) as HTMLElement[];
    const targetChildren = Array.from(target.children) as HTMLElement[];
    for (let i = 0; i < sourceChildren.length; i += 1) {
      if (targetChildren[i]) inlineStyles(sourceChildren[i], targetChildren[i]);
    }
  };

  const sanitizeClone = (root: HTMLElement) => {
    root.style.fontFamily = 'system-ui, -apple-system, Segoe UI, sans-serif';
    const imgs = Array.from(root.querySelectorAll('img'));
    imgs.forEach((img) => {
      const placeholder = document.createElement('div');
      placeholder.style.width = `${img.width || img.clientWidth}px`;
      placeholder.style.height = `${img.height || img.clientHeight}px`;
      placeholder.style.background = 'linear-gradient(135deg, rgba(55,65,81,0.6), rgba(31,41,55,0.9))';
      placeholder.style.borderRadius = window.getComputedStyle(img).borderRadius || '0px';
      placeholder.style.display = 'block';
      img.replaceWith(placeholder);
    });

    const withBackgrounds = Array.from(root.querySelectorAll<HTMLElement>('*'));
    withBackgrounds.forEach((el) => {
      const bg = window.getComputedStyle(el).backgroundImage;
      if (bg && bg !== 'none' && bg.includes('url(')) {
        el.style.backgroundImage = 'none';
      }
      el.style.fontFamily = 'system-ui, -apple-system, Segoe UI, sans-serif';
      if (el.style.filter) el.style.filter = 'none';
      if ((el.style as any).backdropFilter) (el.style as any).backdropFilter = 'none';
    });
  };

  const captureStatsPng = async (element: HTMLElement): Promise<Blob> => {
    const rect = element.getBoundingClientRect();
    const clone = element.cloneNode(true) as HTMLElement;
    inlineStyles(element, clone);
    sanitizeClone(clone);
    const wrapper = document.createElement('div');
    wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    wrapper.appendChild(clone);

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}">
        <foreignObject width="100%" height="100%">${new XMLSerializer().serializeToString(wrapper)}</foreignObject>
      </svg>
    `;

    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    try {
      const img = new Image();
      const pngBlob = await new Promise<Blob>((resolve, reject) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = rect.width;
          canvas.height = rect.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas unavailable'));
            return;
          }
          ctx.drawImage(img, 0, 0);
          try {
            canvas.toBlob((blob) => {
              if (!blob) {
                reject(new Error('Failed to create PNG'));
                return;
              }
              resolve(blob);
            }, 'image/png');
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = url;
      });
      return pngBlob;
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const renderFallbackPng = async (payload: WatchStats): Promise<Blob> => {
    const width = 1280;
    const height = 720;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');

    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, '#0b1020');
    bg.addColorStop(0.45, '#11182b');
    bg.addColorStop(1, '#0a0f1d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // soft glow blobs
    const glow1 = ctx.createRadialGradient(250, 180, 0, 250, 180, 320);
    glow1.addColorStop(0, 'rgba(56,189,248,0.25)');
    glow1.addColorStop(1, 'rgba(56,189,248,0)');
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, 600, 500);

    const glow2 = ctx.createRadialGradient(width - 220, 140, 0, width - 220, 140, 360);
    glow2.addColorStop(0, 'rgba(168,85,247,0.22)');
    glow2.addColorStop(1, 'rgba(168,85,247,0)');
    ctx.fillStyle = glow2;
    ctx.fillRect(width - 700, 0, 700, 520);

    // frosted card background
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(40, 40, width - 80, height - 80);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(40.5, 40.5, width - 81, height - 81);

    ctx.fillStyle = '#E5E7EB';
    ctx.font = '700 44px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText('Watch Statistics', 90, 120);
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '400 18px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText('Your viewing history at a glance', 90, 150);

    // accent pill
    ctx.fillStyle = 'rgba(59,130,246,0.18)';
    ctx.fillRect(90, 170, 140, 30);
    ctx.fillStyle = '#93C5FD';
    ctx.font = '600 12px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText('AETHER STATS', 102, 190);

    // top divider
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.moveTo(90, 215);
    ctx.lineTo(width - 90, 215);
    ctx.stroke();

    const drawStatCard = (label: string, value: string, x: number, y: number, w: number, h: number, accent: string) => {
      ctx.fillStyle = 'rgba(17,24,39,0.55)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      ctx.fillStyle = accent;
      ctx.fillRect(x, y, 4, h);
      ctx.fillStyle = '#9CA3AF';
      ctx.font = '500 14px system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.fillText(label, x + 16, y + 26);
      ctx.fillStyle = '#F9FAFB';
      ctx.font = '700 30px system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.fillText(value, x + 16, y + 62);
    };

    // Fancy top line for total watch time
    const watchTimeText = formatWatchTime(payload.totalWatchTimeTicks);
    const sectionGap = 22;
    const topY = 210;
    const topH = 96;
    ctx.fillStyle = 'rgba(30,41,59,0.7)';
    ctx.fillRect(70, topY, 1140, topH);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.strokeRect(70.5, topY + 0.5, 1139, topH - 1);
    const shine = ctx.createLinearGradient(70, topY, 1210, topY + topH);
    shine.addColorStop(0, 'rgba(56,189,248,0.18)');
    shine.addColorStop(1, 'rgba(168,85,247,0.18)');
    ctx.fillStyle = shine;
    ctx.fillRect(70, topY, 1140, topH);
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '600 14px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText('Total Watch Time', 95, topY + 28);
    ctx.fillStyle = '#F9FAFB';
    ctx.font = '800 36px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(watchTimeText, 95, topY + 68);
    // (Removed) detailed watch time line to avoid duplicate display

    // Second line: Movies watched + Avg rating + series info (equal widths)
    const rowY = topY + topH + sectionGap;
    const rowGap = 20;
    const rowWidth = width - 140;
    const cardW = Math.floor((rowWidth - rowGap * 3) / 4);
    const cardH = 88;
    drawStatCard('Movies Watched', String(payload.totalMovies), 70, rowY, cardW, cardH, '#22C55E');
    drawStatCard('Avg Movie Rating', payload.averageRating.toFixed(1), 70 + cardW + rowGap, rowY, cardW, cardH, '#FBBF24');
    drawStatCard('Episodes Watched', String(payload.totalEpisodes), 70 + (cardW + rowGap) * 2, rowY, cardW, cardH, '#A855F7');
    drawStatCard('Series Watched', String(payload.totalSeries), 70 + (cardW + rowGap) * 3, rowY, cardW, cardH, '#F59E0B');

    // Bottom line: Top Genres / Studios
    const topGenres = payload.favoriteGenres.slice(0, 5).map(g => g.name).join(' • ');
    const topStudios = payload.favoriteStudios.slice(0, 5).map(s => s.name).join(' • ');
    ctx.fillStyle = 'rgba(17,24,39,0.55)';
    const bottomY = rowY + cardH + sectionGap;
    const bottomH = 130;
    ctx.fillRect(70, bottomY, width - 140, bottomH);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.strokeRect(70.5, bottomY + 0.5, width - 141, bottomH - 1);

    ctx.fillStyle = '#A5B4FC';
    ctx.font = '600 16px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText('Top Genres', 95, bottomY + 32);
    ctx.fillStyle = '#CBD5F5';
    ctx.font = '400 16px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(topGenres || '-', 95, bottomY + 56);
    ctx.fillStyle = '#C4B5FD';
    ctx.font = '600 16px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText('Top Studios', 95, bottomY + 96);
    ctx.fillStyle = '#E0E7FF';
    ctx.font = '400 16px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(topStudios || '-', 95, bottomY + 120);

    // subtle footer
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '500 12px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText('Aether • Stats Snapshot', 70, height - 55);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create PNG'));
          return;
        }
        resolve(blob);
      }, 'image/png');
    });
  };

  const handleShare = async () => {
    if (!statsRef.current || isSharing || !stats) return;
    setIsSharing(true);
    try {
      let blob: Blob;
      try {
        blob = await captureStatsPng(statsRef.current);
      } catch (err) {
        blob = await renderFallbackPng(stats);
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setShareToast('Copied stats as PNG');
    } catch (error) {
      console.error('Failed to share stats:', error);
      setShareToast('Could not copy PNG');
    } finally {
      setIsSharing(false);
      setTimeout(() => setShareToast(null), 2200);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black">
        <Header transparent={false} />
        <main className="max-w-7xl mx-auto px-6 pt-24 pb-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">Watch Statistics</h1>
            <p className="text-gray-400">Your viewing history at a glance</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-gray-900 rounded-2xl p-6 border border-white/10">
                <div className="h-6 w-32 bg-white/10 rounded mb-4 animate-pulse" />
                <div className="h-8 w-24 bg-white/10 rounded mb-2 animate-pulse" />
                <div className="h-3 w-40 bg-white/10 rounded animate-pulse" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="bg-gray-900 rounded-2xl p-6 border border-white/10">
                <div className="h-6 w-40 bg-white/10 rounded mb-4 animate-pulse" />
                {Array.from({ length: 5 }).map((__, j) => (
                  <div key={j} className="h-4 w-full bg-white/10 rounded mb-3 animate-pulse" />
                ))}
              </div>
            ))}
          </div>
          <div className="mt-8 bg-gray-900 rounded-2xl p-6 border border-white/10">
            <div className="h-6 w-40 bg-white/10 rounded mb-4 animate-pulse" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i}>
                  <div className="aspect-[2/3] rounded-lg bg-gray-800 animate-pulse mb-2" />
                  <div className="h-4 bg-white/10 rounded w-10/12 mb-1 animate-pulse" />
                  <div className="h-3 bg-white/10 rounded w-8/12 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-black">
        <Header transparent={false} />
        <div className="flex items-center justify-center pt-32">
          <p className="text-gray-400">Failed to load statistics</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Header transparent={false} />

      <main className="max-w-7xl mx-auto px-6 pt-24 pb-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Watch Statistics</h1>
            <p className="text-gray-400">Your viewing history at a glance</p>
          </div>
          <div className="flex items-center gap-3">
            {shareToast && (
              <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 text-xs">
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M5 11l3 3L15 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{shareToast}</span>
              </div>
            )}
            <button
              onClick={handleShare}
              tabIndex={0}
              disabled={isSharing}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all focusable-item flex items-center gap-2 border ${
                isSharing
                  ? 'bg-white/10 text-gray-400 border-white/10 cursor-wait'
                  : 'bg-white text-black border-white hover:bg-gray-200'
              }`}
            >
              {isSharing ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4m4-4v14" />
                </svg>
              )}
              Share PNG
            </button>
          </div>
        </div>
        {shareToast && (
          <div className="mb-4 sm:hidden inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 text-xs">
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M5 11l3 3L15 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{shareToast}</span>
          </div>
        )}
        <div ref={statsRef}>
        {/* Main Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {/* Total Watch Time */}
          <div className="col-span-2 bg-gray-900 rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Total Watch Time</p>
                <p className="text-3xl font-bold text-white">{formatWatchTime(stats.totalWatchTimeTicks)}</p>
              </div>
            </div>
            <p className="text-gray-500 text-sm">{formatWatchTimeDetailed(stats.totalWatchTimeTicks)}</p>
          </div>

          {/* Movies Watched */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-white/10">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
              </svg>
            </div>
            <p className="text-gray-400 text-sm">Movies Watched</p>
            <p className="text-2xl font-bold text-white">{stats.totalMovies}</p>
          </div>

          {/* Episodes Watched */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-white/10">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/>
              </svg>
            </div>
            <p className="text-gray-400 text-sm">Episodes Watched</p>
            <p className="text-2xl font-bold text-white">{stats.totalEpisodes}</p>
          </div>
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {/* Series Completed */}
          <div className="bg-gray-900 rounded-xl p-4 border border-white/10">
            <p className="text-gray-400 text-xs mb-1">Series Watched</p>
            <p className="text-xl font-bold text-white">{stats.totalSeries}</p>
          </div>

          {/* Average Rating */}
          <div className="bg-gray-900 rounded-xl p-4 border border-white/10">
            <p className="text-gray-400 text-xs mb-1">Avg Movie Rating</p>
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
              </svg>
              <p className="text-xl font-bold text-white">{stats.averageRating.toFixed(1)}</p>
            </div>
          </div>

          {/* Oldest Watched */}
          <div className="bg-gray-900 rounded-xl p-4 border border-white/10">
            <p className="text-gray-400 text-xs mb-1">Oldest Movie</p>
            <p className="text-xl font-bold text-white">{stats.oldestWatched?.ProductionYear || '-'}</p>
            {stats.oldestWatched && (
              <p className="text-xs text-gray-500 truncate">{stats.oldestWatched.Name}</p>
            )}
          </div>

          {/* Newest Watched */}
          <div className="bg-gray-900 rounded-xl p-4 border border-white/10">
            <p className="text-gray-400 text-xs mb-1">Newest Movie</p>
            <p className="text-xl font-bold text-white">{stats.newestWatched?.ProductionYear || '-'}</p>
            {stats.newestWatched && (
              <p className="text-xs text-gray-500 truncate">{stats.newestWatched.Name}</p>
            )}
          </div>
        </div>

        {/* Genres & Studios */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Favorite Genres */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Top Genres
            </h3>
            <div className="space-y-3">
              {stats.favoriteGenres.slice(0, 5).map((genre, index) => (
                <div key={genre.name} className="flex items-center gap-3">
                  <span className="text-gray-500 text-sm w-5">{index + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-white text-sm">{genre.name}</span>
                      <span className="text-gray-400 text-xs">{genre.count} items</span>
                    </div>
                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-white to-gray-400 rounded-full"
                        style={{ width: `${(genre.count / stats.favoriteGenres[0].count) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Favorite Studios */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Top Studios
            </h3>
            <div className="space-y-3">
              {stats.favoriteStudios.slice(0, 5).map((studio, index) => (
                <div key={studio.name} className="flex items-center gap-3">
                  <span className="text-gray-500 text-sm w-5">{index + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-white text-sm truncate">{studio.name}</span>
                      <span className="text-gray-400 text-xs">{studio.count} movies</span>
                    </div>
                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-white to-gray-400 rounded-full"
                        style={{ width: `${(studio.count / stats.favoriteStudios[0].count) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live Sessions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-900 rounded-xl p-4 border border-white/10">
            <p className="text-gray-400 text-xs mb-1">Active Sessions</p>
            <p className="text-xl font-bold text-white">{stats.activeSessions}</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 border border-white/10">
            <p className="text-gray-400 text-xs mb-1">Now Playing</p>
            <p className="text-xl font-bold text-white">{stats.nowPlaying}</p>
          </div>
        </div>

        {/* Now Playing Details */}
        {stats.sessions.filter((s) => s.NowPlayingItem).length > 0 && (
          <div className="bg-gray-900 rounded-2xl p-6 border border-white/10 mb-8">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5v14l11-7z" />
              </svg>
              Now Playing
            </h3>
            <div className="space-y-4">
              {stats.sessions
                .filter((s) => s.NowPlayingItem)
                .map((s) => {
                  const item = s.NowPlayingItem;
                  const positionTicks = s.PlayState?.PositionTicks || 0;
                  const runtimeTicks = item?.RunTimeTicks || 0;
                  const position = runtimeTicks > 0 ? formatWatchTime(positionTicks) : '';
                  const duration = runtimeTicks > 0 ? formatWatchTime(runtimeTicks) : '';
                  const stream = item?.MediaSources?.[0];
                  return (
                    <div key={s.Id} className="rounded-xl border border-white/10 bg-black/40 p-4">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <p className="text-white font-semibold">
                            {item?.Name || 'Unknown Item'}
                          </p>
                          <p className="text-sm text-gray-400">
                            {item?.ProductionYear ? `${item.ProductionYear} · ` : ''}
                            {position && duration ? `${position} / ${duration}` : 'Playback in progress'}
                          </p>
                        </div>
                        <div className="text-sm text-gray-400">
                          {s.Client || 'Client'} {s.AppVersion ? `· ${s.AppVersion}` : ''} {s.DeviceName ? `· ${s.DeviceName}` : ''}
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-400">
                        {(s.RemoteEndPoint || s.RemoteAddress || s.Protocol) && (
                          <div>
                            <p className="text-gray-500">Connection</p>
                            <p className="text-gray-300">
                              {s.RemoteEndPoint || s.RemoteAddress}
                              {s.Protocol ? ` · ${s.Protocol}` : ''}
                            </p>
                          </div>
                        )}
                        {(stream?.Container || stream?.Bitrate) && (
                          <div>
                            <p className="text-gray-500">Stream</p>
                            <p className="text-gray-300">
                              {stream?.Container ? stream.Container.toUpperCase() : ''}
                              {stream?.Bitrate ? ` · ${(stream.Bitrate / 1000000).toFixed(1)} mbps` : ''}
                            </p>
                          </div>
                        )}
                        {(stream?.VideoCodec || (stream?.Width && stream?.Height) || stream?.VideoRange) && (
                          <div>
                            <p className="text-gray-500">Video</p>
                            <p className="text-gray-300">
                              {stream?.VideoCodec ? stream.VideoCodec.toUpperCase() : ''}
                              {stream?.Width && stream?.Height ? ` · ${stream.Width}x${stream.Height}` : ''}
                              {stream?.VideoRange ? ` · ${stream.VideoRange}` : ''}
                            </p>
                          </div>
                        )}
                        {(stream?.AudioCodec || stream?.AudioChannels || stream?.AudioLanguage) && (
                          <div>
                            <p className="text-gray-500">Audio</p>
                            <p className="text-gray-300">
                              {stream?.AudioCodec ? stream.AudioCodec.toUpperCase() : ''}
                              {stream?.AudioChannels ? ` · ${stream.AudioChannels}ch` : ''}
                              {stream?.AudioLanguage ? ` · ${stream.AudioLanguage}` : ''}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Most Rewatched */}
        {stats.mostWatched.length > 0 && (
          <div className="bg-gray-900 rounded-2xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Most Rewatched
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {stats.mostWatched.slice(0, 5).map((item) => {
                const imageUrl = item.ImageTags?.Primary
                  ? embyApi.getImageUrl(item.Id, 'Primary', { maxWidth: 200, tag: item.ImageTags.Primary })
                  : '';
                return (
                  <button
                    key={item.Id}
                    onClick={() => navigate(`/details/${item.Id}`, { state: { mediaType: item.Type } })}
                    className="cursor-pointer group text-left focusable-card"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/details/${item.Id}`, { state: { mediaType: item.Type } });
                      }
                    }}
                  >
                    <div className="relative aspect-[2/3] bg-gray-700 rounded-lg overflow-hidden mb-2">
                      {imageUrl ? (
                        <img src={imageUrl} alt={item.Name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600">
                          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
                          </svg>
                        </div>
                      )}
                      <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">
                        {item.UserData?.PlayCount}x
                      </div>
                    </div>
                    <p className="text-white text-sm font-medium truncate group-hover:text-gray-300 transition-colors">
                      {item.Name}
                    </p>
                    {item.Type === 'Episode' && item.SeriesName && (
                      <p className="text-gray-500 text-xs truncate">{item.SeriesName}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
