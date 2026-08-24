import { apiClient } from "@/api/client";
import type { PaginatedResponse, PaginationParams, RequestSignalOptions } from "@/types/api";
import type { Movie, MovieQuery } from "@/types/movie";
import type { MovieCategoryRef } from "@/types/category";

export interface BackendMovie extends Omit<Movie, "categories"> {
  categories: MovieCategoryRef[];
}

export interface BackendPurchaseEntry {
  id: string;
  movieId: string;
  movieTitle: string;
  posterUrl: string | null;
  amount: number;
  createdAt: string;
}

export const moviesApi = {
  /** `options.signal` is the search's abort handle — see RequestSignalOptions. */
  getMovies(query: MovieQuery = {}, options: RequestSignalOptions = {}) {
    return apiClient.get<PaginatedResponse<BackendMovie>>("/movies", { params: query, ...options });
  },

  getMovieById(id: string) {
    return apiClient.get<BackendMovie>(`/movies/${id}`);
  },

  getMostPurchased() {
    return apiClient.get<BackendMovie[]>("/movies/most-purchased");
  },

  getMyPurchases(pagination: PaginationParams = {}) {
    return apiClient.get<PaginatedResponse<BackendPurchaseEntry>>("/movies/me/purchases", { params: pagination });
  },
};
