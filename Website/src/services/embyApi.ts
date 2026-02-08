import type {
  EmbyUser,
  AuthResponse,
  ItemsResponse,
  PlaybackInfoResponse,
  ServerInfo,
  StoredAuth,
  ConnectAuthResponse,
  ConnectServer,
  ConnectExchangeResponse,
} from '../types/emby.types';

class EmbyApiService {
  private baseUrl: string = '';
  private accessToken: string = '';
  private userId: string = '';
  private deviceId: string = '';
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes cache
  private connectBaseUrl: string = 'https://connect.emby.media/service';

  constructor() {
    // Generate or retrieve device ID
    this.deviceId = this.getDeviceId();
  }

  private getDeviceId(): string {
    let deviceId = localStorage.getItem('emby_device_id');
    if (!deviceId) {
      deviceId = this.generateDeviceId();
      localStorage.setItem('emby_device_id', deviceId);
    }
    return deviceId;
  }

  private generateDeviceId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  setCredentials(auth: StoredAuth) {
    this.baseUrl = auth.serverUrl;
    this.accessToken = auth.accessToken;
    this.userId = auth.userId;
  }

  private getCacheKey(endpoint: string, params?: any): string {
    return `${endpoint}:${JSON.stringify(params || {})}`;
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    const now = Date.now();
    if (now - cached.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data as T;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private getAuthHeaders(includeToken: boolean = true): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: this.getEmbyAuthorizationHeaderValue(this.userId),
    };

    if (includeToken && this.accessToken) {
      headers['X-Emby-Token'] = this.accessToken;
    }

    return headers;
  }

  private getEmbyAuthorizationHeaderValue(userId: string): string {
    return `Emby UserId="${userId}", Client="Web", Device="Chrome", DeviceId="${this.deviceId}", Version="1.0.0"`;
  }

  private async connectRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.connectBaseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Application': 'Aether/1.0.0',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Connect request failed: ${response.statusText}`);
    }

    return response.json();
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    includeToken: boolean = true
  ): Promise<T> {
    const url = `${this.baseUrl}/emby${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getAuthHeaders(includeToken),
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('emby_auth');
        window.location.href = '/login';
      }
      throw new Error(`API request failed: ${response.statusText}`);
    }

    // Handle empty responses (204 No Content)
    const text = await response.text();
    if (!text) {
      return {} as T;
    }
    return JSON.parse(text);
  }

  private normalizeServerUrl(serverUrl: string): string {
    const trimmed = serverUrl.replace(/\/+$/, '');
    if (trimmed.toLowerCase().endsWith('/emby')) {
      return trimmed.slice(0, -5);
    }
    return trimmed;
  }

  // Authentication methods
  async getPublicUsers(serverUrl: string): Promise<EmbyUser[]> {
    this.baseUrl = serverUrl;
    this.userId = '';
    return this.request<EmbyUser[]>('/Users/Public', {}, false);
  }

  async authenticateByName(
    serverUrl: string,
    username: string,
    password: string
  ): Promise<AuthResponse> {
    this.baseUrl = serverUrl;
    this.userId = '';
    
    const response = await this.request<AuthResponse>(
      `/Users/AuthenticateByName`,
      {
        method: 'POST',
        body: JSON.stringify({
          Username: username,
          Pw: password,
        }),
      },
      false
    );

    this.accessToken = response.AccessToken;
    this.userId = response.User.Id;

    return response;
  }

  async connectAuthenticate(
    usernameOrEmail: string,
    password: string
  ): Promise<ConnectAuthResponse> {
    return this.connectRequest<ConnectAuthResponse>('/user/authenticate', {
      method: 'POST',
      body: JSON.stringify({
        nameOrEmail: usernameOrEmail,
        rawpw: password,
      }),
    });
  }

  async connectGetServers(
    connectUserId: string,
    connectAccessToken: string
  ): Promise<ConnectServer[]> {
    return this.connectRequest<ConnectServer[]>(`/servers?userId=${encodeURIComponent(connectUserId)}`, {
      headers: {
        'X-Connect-UserToken': connectAccessToken,
      },
    });
  }

  async exchangeConnectForLocalAccessToken(
    serverUrl: string,
    connectUserId: string,
    serverAccessKey: string
  ): Promise<ConnectExchangeResponse> {
    const baseUrl = this.normalizeServerUrl(serverUrl);
    const response = await fetch(
      `${baseUrl}/Connect/Exchange?format=json&ConnectUserId=${encodeURIComponent(connectUserId)}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Emby-Token': serverAccessKey,
          'X-Emby-Authorization': this.getEmbyAuthorizationHeaderValue(''),
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `Connect exchange failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`
      );
    }

    return response.json();
  }

  async logout(): Promise<void> {
    await this.request('/Sessions/Logout', { method: 'POST' });
    this.accessToken = '';
    this.userId = '';
  }

  async getServerInfo(): Promise<ServerInfo> {
    return this.request<ServerInfo>('/System/Info');
  }

  // Library methods
  async getUserViews(): Promise<ItemsResponse> {
    return this.request<ItemsResponse>(`/Users/${this.userId}/Views`);
  }

  async getLatestItems(params: {
    includeItemTypes?: string;
    limit?: number;
    isPlayed?: boolean;
    groupItems?: boolean;
    parentId?: string;
  } = {}): Promise<any[]> {
    const queryParams = new URLSearchParams();
    if (params.includeItemTypes) queryParams.append('IncludeItemTypes', params.includeItemTypes);
    if (params.limit) queryParams.append('Limit', params.limit.toString());
    if (params.isPlayed !== undefined) queryParams.append('IsPlayed', params.isPlayed.toString());
    if (params.groupItems) queryParams.append('GroupItems', 'true');
    if (params.parentId) queryParams.append('ParentId', params.parentId);
    // Include essential fields
    queryParams.append('Fields', 'Genres,Overview,CommunityRating,OfficialRating,RunTimeTicks,ProductionYear,PremiereDate,ProviderIds,Path,MediaSources');

    return this.request<any[]>(`/Users/${this.userId}/Items/Latest?${queryParams.toString()}`);
  }

  async getItems(params: {
    parentId?: string;
    recursive?: boolean;
    includeItemTypes?: string;
    filters?: string;
    sortBy?: string;
    sortOrder?: string;
    limit?: number;
    startIndex?: number;
    searchTerm?: string;
    genres?: string;
    years?: string;
    fields?: string;
    anyProviderIdEquals?: string;
  } = {}): Promise<ItemsResponse> {
    // Don't cache resume/continue watching or recently played items - they need to be fresh
    const isResumeOrPlayedQuery = params.filters?.includes('IsResumable') || params.filters?.includes('IsPlayed');
    
    if (!isResumeOrPlayedQuery) {
      const cacheKey = this.getCacheKey('getItems', params);
      const cached = this.getFromCache<ItemsResponse>(cacheKey);
      if (cached) {
        return cached;
      }
    }
    
    const queryParams = new URLSearchParams();
    if (params.parentId) queryParams.append('ParentId', params.parentId);
    if (params.recursive) queryParams.append('Recursive', 'true');
    if (params.includeItemTypes) queryParams.append('IncludeItemTypes', params.includeItemTypes);
    if (params.filters) queryParams.append('Filters', params.filters);
    if (params.sortBy) queryParams.append('SortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('SortOrder', params.sortOrder);
    if (params.limit) queryParams.append('Limit', params.limit.toString());
    if (params.startIndex) queryParams.append('StartIndex', params.startIndex.toString());
    if (params.searchTerm) queryParams.append('SearchTerm', params.searchTerm);
    if (params.genres) queryParams.append('Genres', params.genres);
    if (params.years) queryParams.append('Years', params.years);
    if (params.anyProviderIdEquals) queryParams.append('AnyProviderIdEquals', params.anyProviderIdEquals);
    // Always include essential fields for display (include UserData so client can show favorites)
    queryParams.append('Fields', params.fields || 'Genres,Overview,CommunityRating,OfficialRating,RunTimeTicks,ProductionYear,PremiereDate,Studios,ChildCount,ProviderIds,Path,MediaSources,UserData');

    const result = await this.request<ItemsResponse>(`/Users/${this.userId}/Items?${queryParams.toString()}`);
    
    // Cache the result if it's not a resume or played query
    if (!isResumeOrPlayedQuery) {
      const cacheKey = this.getCacheKey('getItems', params);
      this.setCache(cacheKey, result);
    }
    
    return result;
  }

  async getItem(itemId: string): Promise<any> {
    return this.request<any>(`/Users/${this.userId}/Items/${itemId}`);
  }

  async getGenres(params: { includeItemTypes?: string } = {}): Promise<{ Items: { Name: string; Id: string }[] }> {
    const queryParams = new URLSearchParams();
    if (params.includeItemTypes) queryParams.append('IncludeItemTypes', params.includeItemTypes);
    queryParams.append('SortBy', 'SortName');
    queryParams.append('SortOrder', 'Ascending');
    return this.request<{ Items: { Name: string; Id: string }[] }>(`/Genres?${queryParams.toString()}`);
  }

  async getYears(params: { includeItemTypes?: string } = {}): Promise<{ Items: { Name: string; Id: string }[] }> {
    const queryParams = new URLSearchParams();
    if (params.includeItemTypes) queryParams.append('IncludeItemTypes', params.includeItemTypes);
    queryParams.append('SortBy', 'SortName');
    queryParams.append('SortOrder', 'Descending');
    return this.request<{ Items: { Name: string; Id: string }[] }>(`/Years?${queryParams.toString()}`);
  }

  async getSimilarItems(itemId: string, limit: number = 12): Promise<any[]> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('UserId', this.userId);
      queryParams.append('Limit', limit.toString());
      queryParams.append('Fields', 'PrimaryImageAspectRatio,ProductionYear,CommunityRating');
      const response = await this.request<ItemsResponse>(`/Items/${itemId}/Similar?${queryParams.toString()}`);
      return response.Items || [];
    } catch (error) {
      // Similar items endpoint may not be supported or available for all items
      console.warn('Similar items not available for this item:', error);
      return [];
    }
  }

  async getPlaybackInfo(itemId: string): Promise<PlaybackInfoResponse> {
    return this.request<PlaybackInfoResponse>(`/Items/${itemId}/PlaybackInfo`, {
      method: 'POST',
      body: JSON.stringify({
        UserId: this.userId,
        EnableDirectPlay: true,
        EnableDirectStream: true,
        EnableTranscoding: true,
      }),
    });
  }

  // Image URL builders
  getImageUrl(itemId: string, imageType: string = 'Primary', params: {
    maxWidth?: number;
    maxHeight?: number;
    tag?: string;
    quality?: number;
  } = {}): string {
    const queryParams = new URLSearchParams();
    if (params.maxWidth) queryParams.append('MaxWidth', params.maxWidth.toString());
    if (params.maxHeight) queryParams.append('MaxHeight', params.maxHeight.toString());
    if (params.tag) queryParams.append('Tag', params.tag);
    if (params.quality) queryParams.append('Quality', params.quality.toString());
    
    const query = queryParams.toString();
    return `${this.baseUrl}/emby/Items/${itemId}/Images/${imageType}${query ? '?' + query : ''}`;
  }

  getStreamUrl(itemId: string, mediaSourceId: string, playSessionId: string, _container?: string, audioStreamIndex?: number, _transcodeAudio?: boolean): string {
    const params = new URLSearchParams({
      MediaSourceId: mediaSourceId,
      PlaySessionId: playSessionId,
      api_key: this.accessToken,
    });
    
    if (audioStreamIndex !== undefined) {
      params.append('AudioStreamIndex', audioStreamIndex.toString());
    }
    
    // Always transcode to HLS for browser compatibility
    params.append('Container', 'ts');
    params.append('VideoCodec', 'h264');
    params.append('AudioCodec', 'aac');
    params.append('MaxAudioChannels', '2');
    params.append('TranscodingMaxAudioChannels', '2');
    params.append('SegmentContainer', 'ts');
    params.append('MinSegments', '1');
    params.append('BreakOnNonKeyFrames', 'true');
    
    return `${this.baseUrl}/emby/Videos/${itemId}/master.m3u8?${params.toString()}`;
  }

  getSubtitleUrl(
    itemId: string,
    mediaSourceId: string,
    subtitleIndex: number,
    options?: {
      format?: string;
      startPositionTicks?: number;
      endPositionTicks?: number;
      copyTimestamps?: boolean;
      useProxy?: boolean;
    }
  ): string {
    const format = options?.format || 'vtt';
    const params = new URLSearchParams();
    if (options?.startPositionTicks !== undefined) {
      params.set('StartPositionTicks', String(Math.max(0, Math.floor(options.startPositionTicks))));
    }
    if (options?.endPositionTicks !== undefined) {
      params.set('EndPositionTicks', String(Math.max(0, Math.floor(options.endPositionTicks))));
    }
    if (options?.copyTimestamps !== undefined) {
      params.set('CopyTimestamps', options.copyTimestamps ? 'true' : 'false');
    }
    const query = params.toString();
    const url = `${this.baseUrl}/emby/Videos/${itemId}/${mediaSourceId}/Subtitles/${subtitleIndex}/Stream.${format}${query ? `?${query}` : ''}`;
  
    // Dev server proxy to avoid CORS on subtitle track requests
    if (import.meta.env.DEV && options?.useProxy !== false) {
      return `/emby-proxy?url=${encodeURIComponent(url)}`;
    }

    return url;
  }

  // Playback reporting methods
  async reportPlaybackStart(params: {
    ItemId: string;
    MediaSourceId: string;
    PlaySessionId: string;
    PositionTicks?: number;
    AudioStreamIndex?: number;
    SubtitleStreamIndex?: number;
    IsPaused?: boolean;
    PlayMethod?: 'Transcode' | 'DirectStream' | 'DirectPlay';
  }): Promise<void> {
    await this.request('/Sessions/Playing', {
      method: 'POST',
      body: JSON.stringify({
        ...params,
        CanSeek: true,
        QueueableMediaTypes: ['Video'],
        IsMuted: false,
        PlayMethod: params.PlayMethod || 'Transcode',
      }),
    });
  }

  async reportPlaybackProgress(params: {
    ItemId: string;
    MediaSourceId: string;
    PlaySessionId: string;
    PositionTicks: number;
    AudioStreamIndex?: number;
    SubtitleStreamIndex?: number;
    IsPaused?: boolean;
    EventName?: 'TimeUpdate' | 'Pause' | 'Unpause' | 'VolumeChange' | 'AudioTrackChange' | 'SubtitleTrackChange';
    PlayMethod?: 'Transcode' | 'DirectStream' | 'DirectPlay';
  }): Promise<void> {
    await this.request('/Sessions/Playing/Progress', {
      method: 'POST',
      body: JSON.stringify({
        ...params,
        CanSeek: true,
        IsMuted: false,
        PlayMethod: params.PlayMethod || 'Transcode',
      }),
    });
  }

  async reportPlaybackStopped(params: {
    ItemId: string;
    MediaSourceId: string;
    PlaySessionId: string;
    PositionTicks: number;
  }): Promise<void> {
    await this.request('/Sessions/Playing/Stopped', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async markPlayed(itemId: string): Promise<void> {
    await this.request(`/Users/${this.userId}/PlayedItems/${itemId}`, {
      method: 'POST',
    });
  }

  async markUnplayed(itemId: string): Promise<void> {
    await this.request(`/Users/${this.userId}/PlayedItems/${itemId}`, {
      method: 'DELETE',
    });
  }

  // Mark or unmark an item as favorite for the current user
  async markFavorite(itemId: string): Promise<any> {
    return this.request(`/Users/${this.userId}/FavoriteItems/${itemId}`, {
      method: 'POST',
    });
  }

  async unmarkFavorite(itemId: string): Promise<void> {
    return this.request(`/Users/${this.userId}/FavoriteItems/${itemId}`, {
      method: 'DELETE',
    });
  }

  // Get next up episodes for continue watching - this uses the series' last played date
  async getNextUp(params: {
    limit?: number;
    fields?: string;
  } = {}): Promise<ItemsResponse> {
    const queryParams = new URLSearchParams();
    queryParams.append('UserId', this.userId);
    if (params.limit) queryParams.append('Limit', params.limit.toString());
    queryParams.append('Fields', params.fields || 'Genres,Overview,CommunityRating,OfficialRating,RunTimeTicks,ProductionYear,PremiereDate,SeriesPrimaryImage');
    // EnableTotalRecordCount helps with pagination if needed
    queryParams.append('EnableTotalRecordCount', 'true');
    
    return this.request<ItemsResponse>(`/Shows/NextUp?${queryParams.toString()}`);
  }

  // Get series items with their last played date
  async getRecentlyPlayedSeries(params: {
    limit?: number;
  } = {}): Promise<ItemsResponse> {
    const queryParams = new URLSearchParams();
    queryParams.append('Recursive', 'true');
    queryParams.append('IncludeItemTypes', 'Series');
    queryParams.append('Filters', 'IsPlayed');
    queryParams.append('SortBy', 'DatePlayed');
    queryParams.append('SortOrder', 'Descending');
    if (params.limit) queryParams.append('Limit', params.limit.toString());
    // Include UserData to get LastPlayedDate
    queryParams.append('Fields', 'Genres,Overview,CommunityRating,OfficialRating,ProductionYear,DateLastMediaAdded,UserData');
    
    return this.request<ItemsResponse>(`/Users/${this.userId}/Items?${queryParams.toString()}`);
  }

  async getSessions(): Promise<any[]> {
    return this.request<any[]>('/Sessions');
  }
}

export const embyApi = new EmbyApiService();
