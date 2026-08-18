import { useQuery } from "@tanstack/react-query";
import { moviesService } from "@/services/movies.service";
import type { MovieQuery } from "@/types/movie";
import type { PaginationParams } from "@/types/api";

export function useMovies(query: MovieQuery = {}) {
  return useQuery({
    queryKey: ["movies", query],
    queryFn: () => moviesService.getMovies(query),
  });
}

export function useMovie(id: string | undefined) {
  return useQuery({
    queryKey: ["movie", id],
    queryFn: () => moviesService.getMovieById(id as string),
    enabled: !!id,
  });
}

export function useMostPurchased() {
  return useQuery({
    queryKey: ["movies", "most-purchased"],
    queryFn: () => moviesService.getMostPurchased(),
  });
}

export function useMyPurchases(pagination: PaginationParams = {}) {
  return useQuery({
    queryKey: ["purchases", "me", pagination],
    queryFn: () => moviesService.getMyPurchases(pagination),
  });
}
