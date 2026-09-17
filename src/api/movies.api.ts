import { apiClient, csvParams } from "@/api/client";
import type { PaginatedResponse, RequestSignalOptions } from "@/types/api";
import type { Movie, MovieFacets, MovieQuery } from "@/types/movie";
import type { MovieCategoryRef } from "@/types/category";

export interface BackendMovie extends Omit<Movie, "categories"> {
  categories: MovieCategoryRef[];
}

export const moviesApi = {
  /** `options.signal` is the search's abort handle — see RequestSignalOptions. */
  getMovies(query: MovieQuery = {}, options: RequestSignalOptions = {}) {
    return apiClient.get<PaginatedResponse<BackendMovie>>("/movies", { params: csvParams(query), ...options });
  },

  /** DB-derived filter vocabulary — empty facets hide their controls. */
  getFacets(options: RequestSignalOptions = {}) {
    return apiClient.get<MovieFacets>("/movies/facets", options);
  },

  getMovieById(id: string, options: RequestSignalOptions = {}) {
    return apiClient.get<BackendMovie>(`/movies/${id}`, options);
  },

  getMostPurchased(options: RequestSignalOptions = {}) {
    return apiClient.get<BackendMovie[]>("/movies/most-purchased", options);
  },
};
