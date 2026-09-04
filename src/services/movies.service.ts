import { moviesApi, type BackendMovie } from "@/api/movies.api";
import type { Movie, MovieFacets, MovieQuery, PurchaseEntry } from "@/types/movie";
import type { PaginatedResponse, PaginationParams, RequestSignalOptions } from "@/types/api";

export function mapMovie(raw: BackendMovie): Movie {
  return raw;
}

export const moviesService = {
  async getMovies(query: MovieQuery = {}, options: RequestSignalOptions = {}): Promise<PaginatedResponse<Movie>> {
    const res = await moviesApi.getMovies(query, options);
    return { ...res, items: res.items.map(mapMovie) };
  },

  async getFacets(): Promise<MovieFacets> {
    return moviesApi.getFacets();
  },

  async getMovieById(id: string): Promise<Movie> {
    const raw = await moviesApi.getMovieById(id);
    return mapMovie(raw);
  },

  async getMostPurchased(): Promise<Movie[]> {
    const raw = await moviesApi.getMostPurchased();
    return raw.map(mapMovie);
  },

  async getMyPurchases(pagination: PaginationParams = {}): Promise<PaginatedResponse<PurchaseEntry>> {
    const res = await moviesApi.getMyPurchases(pagination);
    return {
      ...res,
      items: res.items.map((p) => ({
        id: p.id,
        movieId: p.movieId,
        movieTitle: p.movieTitle,
        posterUrl: p.posterUrl,
        price: p.amount,
        purchasedAt: p.createdAt,
      })),
    };
  },
};
