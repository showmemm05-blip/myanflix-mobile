import { moviesApi, type BackendMovie } from "@/api/movies.api";
import type { Movie, MovieFacets, MovieQuery } from "@/types/movie";
import type { PaginatedResponse, RequestSignalOptions } from "@/types/api";

export function mapMovie(raw: BackendMovie): Movie {
  return raw;
}

export const moviesService = {
  async getMovies(query: MovieQuery = {}, options: RequestSignalOptions = {}): Promise<PaginatedResponse<Movie>> {
    const res = await moviesApi.getMovies(query, options);
    return { ...res, items: res.items.map(mapMovie) };
  },

  async getFacets(options: RequestSignalOptions = {}): Promise<MovieFacets> {
    return moviesApi.getFacets(options);
  },

  async getMovieById(id: string, options: RequestSignalOptions = {}): Promise<Movie> {
    const raw = await moviesApi.getMovieById(id, options);
    return mapMovie(raw);
  },
};
