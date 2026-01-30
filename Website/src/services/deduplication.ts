import type { EmbyItem } from '../types/emby.types';

/**
 * Generates a unique key for an item based on provider IDs or name+year.
 * Used to identify duplicate entries across different libraries.
 */
function getItemUniqueKey(item: EmbyItem): string {
  // Prefer IMDB ID as it's the most reliable
  if (item.ProviderIds?.Imdb) {
    return `imdb:${item.ProviderIds.Imdb}`;
  }
  
  // Fall back to TMDB ID
  if (item.ProviderIds?.Tmdb) {
    return `tmdb:${item.ProviderIds.Tmdb}`;
  }
  
  // For TV shows, also try TVDB
  if (item.Type === 'Series' && item.ProviderIds?.Tvdb) {
    return `tvdb:${item.ProviderIds.Tvdb}`;
  }
  
  // Fall back to name + year (normalized)
  const normalizedName = item.Name.toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove special characters
    .replace(/\s+/g, ''); // Remove spaces
  const year = item.ProductionYear || 'unknown';
  return `name:${normalizedName}:${year}`;
}

/**
 * Get a display label for a version (e.g., "4K", "1080p", "HDR")
 */
export function getVersionLabel(item: EmbyItem): string {
  const labels: string[] = [];
  
  // Try to get quality info from MediaSources
  const mediaSource = item.MediaSources?.[0];
  if (mediaSource) {
    // Check video stream for resolution
    const videoStream = mediaSource.MediaStreams?.find(s => s.Type === 'Video');
    if (videoStream) {
      const height = videoStream.Height || 0;
      if (height >= 2160) {
        labels.push('4K');
      } else if (height >= 1080) {
        labels.push('1080p');
      } else if (height >= 720) {
        labels.push('720p');
      } else if (height > 0) {
        labels.push(`${height}p`);
      }
      
      // Check for HDR
      if (videoStream.VideoRange === 'HDR' || videoStream.VideoRange === 'HDR10') {
        labels.push('HDR');
      }
      
      // Check for codec
      if (videoStream.Codec?.toLowerCase().includes('hevc') || videoStream.Codec?.toLowerCase().includes('h265')) {
        labels.push('HEVC');
      }
    }
    
    // Add container if useful
    if (mediaSource.Container) {
      const container = mediaSource.Container.toUpperCase();
      if (['MKV', 'MP4', 'AVI', 'REMUX'].includes(container)) {
        // Only add if not already implied
      }
    }
    
    // Add bitrate info if available
    if (mediaSource.Bitrate) {
      const mbps = mediaSource.Bitrate / 1000000;
      if (mbps >= 20) {
        labels.push(`${mbps.toFixed(0)}Mbps`);
      }
    }
    
    // Add file size if available
    if (mediaSource.Size) {
      const gb = mediaSource.Size / (1024 * 1024 * 1024);
      if (gb >= 1) {
        labels.push(`${gb.toFixed(1)}GB`);
      } else {
        const mb = mediaSource.Size / (1024 * 1024);
        labels.push(`${mb.toFixed(0)}MB`);
      }
    }
  }
  
  // If we couldn't get any labels, try to extract from path
  if (labels.length === 0 && item.Path) {
    const path = item.Path.toLowerCase();
    if (path.includes('4k') || path.includes('2160p')) {
      labels.push('4K');
    } else if (path.includes('1080p')) {
      labels.push('1080p');
    } else if (path.includes('720p')) {
      labels.push('720p');
    }
    
    if (path.includes('hdr')) {
      labels.push('HDR');
    }
    
    if (path.includes('remux')) {
      labels.push('REMUX');
    }
  }
  
  // Default label
  if (labels.length === 0) {
    return 'Version';
  }
  
  return labels.join(' ');
}

/**
 * Deduplicates items by grouping them based on provider IDs or name+year.
 * Returns items with alternate versions attached.
 */
export function deduplicateItems(items: EmbyItem[]): EmbyItem[] {
  const itemMap = new Map<string, EmbyItem>();
  
  for (const item of items) {
    const key = getItemUniqueKey(item);
    
    const existing = itemMap.get(key);
    if (existing) {
      // Add as alternate version
      if (!existing.AlternateVersions) {
        existing.AlternateVersions = [];
      }
      existing.AlternateVersions.push(item);
    } else {
      // First occurrence - create a copy to avoid mutating the original
      itemMap.set(key, { ...item, AlternateVersions: [] });
    }
  }
  
  // Convert map back to array, maintaining original order
  const result: EmbyItem[] = [];
  const seenKeys = new Set<string>();
  
  for (const item of items) {
    const key = getItemUniqueKey(item);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      const deduped = itemMap.get(key);
      if (deduped) {
        result.push(deduped);
      }
    }
  }
  
  return result;
}

/**
 * Get all versions of an item (including the main item)
 */
export function getAllVersions(item: EmbyItem): EmbyItem[] {
  const versions = [item];
  if (item.AlternateVersions && item.AlternateVersions.length > 0) {
    versions.push(...item.AlternateVersions);
  }
  return versions;
}

/**
 * Check if an item has multiple versions
 */
export function hasMultipleVersions(item: EmbyItem): boolean {
  return (item.AlternateVersions?.length ?? 0) > 0;
}
