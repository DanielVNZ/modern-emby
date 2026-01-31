// TMDB API Service
// Documentation: https://developer.themoviedb.org/docs/append-to-response

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export interface TMDBMovie {
  id: number;
  title: string;
  original_title: string;
  release_date: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  popularity: number;
}

export interface TMDBTVShow {
  id: number;
  name: string;
  original_name: string;
  first_air_date: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  popularity: number;
}

export interface TMDBResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

class TMDBApi {
  private getApiKey(): string | null {
    return localStorage.getItem('tmdb_apiKey');
  }

  isConfigured(): boolean {
    const apiKey = this.getApiKey();
    return !!apiKey && apiKey.trim().length > 0;
  }

  async getPopularMovies(page: number = 1): Promise<TMDBResponse<TMDBMovie>> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('TMDB API key not configured');
    }

    const response = await fetch(
      `${TMDB_BASE_URL}/movie/popular?api_key=${apiKey}&language=en-US&page=${page}`
    );

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`);
    }

    return response.json();
  }

  // Fetch multiple pages of popular movies
  async getPopularMoviesMultiPage(pages: number = 3): Promise<TMDBMovie[]> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('TMDB API key not configured');
    }

    const requests = [];
    for (let i = 1; i <= pages; i++) {
      requests.push(
        fetch(`${TMDB_BASE_URL}/movie/popular?api_key=${apiKey}&language=en-US&page=${i}`)
          .then(r => r.ok ? r.json() : { results: [] })
      );
    }

    const responses = await Promise.all(requests);
    return responses.flatMap((r: TMDBResponse<TMDBMovie>) => r.results || []);
  }

  // Fetch multiple pages of top rated movies (better for matching existing libraries)
  async getTopRatedMoviesMultiPage(pages: number = 5): Promise<TMDBMovie[]> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('TMDB API key not configured');
    }

    const requests = [];
    for (let i = 1; i <= pages; i++) {
      requests.push(
        fetch(`${TMDB_BASE_URL}/movie/top_rated?api_key=${apiKey}&language=en-US&page=${i}`)
          .then(r => r.ok ? r.json() : { results: [] })
      );
    }

    const responses = await Promise.all(requests);
    return responses.flatMap((r: TMDBResponse<TMDBMovie>) => r.results || []);
  }

  // Fetch multiple pages of trending movies (week timeframe)
  async getTrendingMoviesMultiPage(pages: number = 5): Promise<TMDBMovie[]> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('TMDB API key not configured');
    }

    const requests = [];
    for (let i = 1; i <= pages; i++) {
      requests.push(
        fetch(`${TMDB_BASE_URL}/trending/movie/week?api_key=${apiKey}&language=en-US&page=${i}`)
          .then(r => r.ok ? r.json() : { results: [] })
      );
    }

    const responses = await Promise.all(requests);
    return responses.flatMap((r: TMDBResponse<TMDBMovie>) => r.results || []);
  }

  // Fetch multiple pages of popular TV shows
  async getPopularTVShowsMultiPage(pages: number = 3): Promise<TMDBTVShow[]> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('TMDB API key not configured');
    }

    const requests = [];
    for (let i = 1; i <= pages; i++) {
      requests.push(
        fetch(`${TMDB_BASE_URL}/tv/popular?api_key=${apiKey}&language=en-US&page=${i}`)
          .then(r => r.ok ? r.json() : { results: [] })
      );
    }

    const responses = await Promise.all(requests);
    return responses.flatMap((r: TMDBResponse<TMDBTVShow>) => r.results || []);
  }

  async getPopularTVShows(page: number = 1): Promise<TMDBResponse<TMDBTVShow>> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('TMDB API key not configured');
    }

    const response = await fetch(
      `${TMDB_BASE_URL}/tv/popular?api_key=${apiKey}&language=en-US&page=${page}`
    );

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`);
    }

    return response.json();
  }

  // Get image URL for posters/backdrops
  getImageUrl(path: string | null, size: 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w342'): string | null {
    if (!path) return null;
    return `https://image.tmdb.org/t/p/${size}${path}`;
  }
}

export const tmdbApi = new TMDBApi();
