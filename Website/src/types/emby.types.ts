// Emby API TypeScript Interfaces

export interface EmbyUser {
  Id: string;
  Name: string;
  HasPassword: boolean;
  HasConfiguredPassword: boolean;
  PrimaryImageTag?: string;
}

export interface AuthResponse {
  User: EmbyUser;
  AccessToken: string;
  ServerId: string;
}

export interface MediaStream {
  Index: number;
  Type: 'Video' | 'Audio' | 'Subtitle';
  Codec: string;
  Language?: string;
  DisplayTitle?: string;
  Width?: number;
  Height?: number;
  BitRate?: number;
  Channels?: number;
  SampleRate?: number;
  Profile?: string;
  Level?: number;
  AverageFrameRate?: number;
  VideoRange?: string;
  ChannelLayout?: string;
  IsDefault?: boolean;
  IsForced?: boolean;
  IsTextSubtitleStream?: boolean;
}

export interface MediaSource {
  Id: string;
  Name: string;
  Container: string;
  Path: string;
  Size: number;
  Bitrate: number;
  RunTimeTicks: number;
  VideoType: string;
  MediaStreams: MediaStream[];
  SupportsDirectPlay: boolean;
  SupportsDirectStream: boolean;
  SupportsTranscoding: boolean;
  IsRemote: boolean;
}

export interface PlaybackInfoResponse {
  MediaSources: MediaSource[];
  PlaySessionId: string;
  ErrorCode?: string;
}

export interface EmbyItem {
  Id: string;
  Name: string;
  Type: string;
  CollectionType?: string;
  IsFolder: boolean;
  ImageTags?: {
    Primary?: string;
    Backdrop?: string;
    Logo?: string;
  };
  BackdropImageTags?: string[];
  ParentBackdropImageTags?: string[];
  ParentBackdropItemId?: string;
  Overview?: string;
  CommunityRating?: number;
  OfficialRating?: string;
  RunTimeTicks?: number;
  ProductionYear?: number;
  IndexNumber?: number;
  ParentIndexNumber?: number;
  SeriesName?: string;
  SeriesId?: string;
  SeriesPrimaryImageTag?: string;
  SeasonName?: string;
  Genres?: string[];
  Studios?: { Name: string; Id?: string }[];
  PremiereDate?: string;
  UserData?: {
    PlaybackPositionTicks: number;
    PlayCount: number;
    IsFavorite: boolean;
    Played: boolean;
    LastPlayedDate?: string;
  };
  // Provider IDs for deduplication (IMDB, TMDB, etc.)
  ProviderIds?: {
    Imdb?: string;
    Tmdb?: string;
    Tvdb?: string;
    [key: string]: string | undefined;
  };
  // Alternate versions from different libraries
  AlternateVersions?: EmbyItem[];
  // Path for version display
  Path?: string;
  // Container for version info
  Container?: string;
  // MediaSources for version quality info
  MediaSources?: Array<{
    Id: string;
    Name: string;
    Path?: string;
    Container?: string;
    Size?: number;
    Bitrate?: number;
    MediaStreams?: MediaStream[];
  }>;
}

export interface ItemsResponse {
  Items: EmbyItem[];
  TotalRecordCount: number;
}

export interface ServerInfo {
  Id: string;
  ServerName: string;
  Version: string;
  LocalAddress: string;
  WanAddress: string;
}

export interface LoginCredentials {
  serverUrl: string;
  username: string;
  password: string;
}

export interface StoredAuth {
  serverUrl: string;
  username: string;
  password: string;
  userId: string;
  accessToken: string;
  deviceId: string;
}
