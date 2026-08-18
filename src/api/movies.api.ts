import { apiClient } from "@/api/client";
import type { PaginatedResponse, PaginationParams } from "@/types/api";
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
  getMovies(query: MovieQuery = {}) {
    return apiClient.get<PaginatedResponse<BackendMovie>>("/movies", { params: query });
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
