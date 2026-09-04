import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { moviesService } from "@/services/movies.service";
import { SEARCH_STALE_TIME_MS } from "@/hooks/useSearchTerm";
import type { MovieQuery } from "@/types/movie";
import type { PaginationParams } from "@/types/api";

/** THE infinite movies key — spelled here and nowhere else (see booksInfiniteKey). */
export const moviesInfiniteKey = (query: MovieQuery) => ["movies", "infinite", query] as const;

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

/**
 * The search grid's endless scroll — the filtered catalog query. Cloned from
 * useBooksInfinite: `pages[0].total` is the BACKEND total for the filtered
 * query and is the only honest match count (never items.length of one page).
 */
export function useMoviesInfinite(query: MovieQuery = {}) {
  return useInfiniteQuery({
    queryKey: moviesInfiniteKey(query),
    queryFn: ({ pageParam, signal }) => moviesService.getMovies({ ...query, page: pageParam }, { signal }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((count, page) => count + page.items.length, 0);
      return loaded < lastPage.total ? lastPage.page + 1 : undefined;
    },
    placeholderData: keepPreviousData,
    staleTime: SEARCH_STALE_TIME_MS,
  });
}

/**
 * The filter vocabulary. 5-minute staleTime on top of the server's own 60s
 * cache — facet values change only when the admin edits metadata.
 */
export function useMovieFacets() {
  return useQuery({
    queryKey: ["movies", "facets"],
    queryFn: () => moviesService.getFacets(),
    staleTime: 5 * 60_000,
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
