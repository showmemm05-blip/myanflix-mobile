import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { moviesService } from "@/services/movies.service";
import { SEARCH_STALE_TIME_MS } from "@/hooks/useSearchTerm";
import type { MovieQuery } from "@/types/movie";
import type { PaginationParams } from "@/types/api";

/**
 * The catalogue query, and the one the search field drives.
 *
 * A late response can never overwrite a newer one, for two independent
 * reasons. React Query keys every result by `["movies", query]`, so a slow
 * "avengers" response resolves into the "avengers" cache entry — never into
 * the "avatar" one the user is now looking at. And the `signal` below means
 * that superseded request is aborted before it can resolve at all. Belt and
 * braces; there is deliberately no hand-rolled request-id guard on top,
 * because there would be nothing left for it to catch.
 */
export function useMovies(query: MovieQuery = {}) {
  return useQuery({
    queryKey: ["movies", query],
    // React Query gives each fetch its own AbortSignal and aborts it when the
    // key changes or the observer goes away — forwarding it is what actually
    // cancels the request instead of just ignoring its result.
    queryFn: ({ signal }) => moviesService.getMovies(query, { signal }),
    // Keep the previous term's results on screen while the next term loads, so
    // the grid never flashes empty between keystrokes.
    placeholderData: keepPreviousData,
    // Retyping a term searched in the last 30s is served from cache rather
    // than re-requested.
    staleTime: SEARCH_STALE_TIME_MS,
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
