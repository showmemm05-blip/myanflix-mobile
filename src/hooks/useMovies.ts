import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { moviesService } from "@/services/movies.service";
import { SEARCH_MIN_LENGTH, SEARCH_STALE_TIME_MS, SUGGEST_LIMIT } from "@/hooks/useSearchTerm";
import type { MovieQuery } from "@/types/movie";

/** THE infinite movies key — spelled here and nowhere else (see booksInfiniteKey). */
export const moviesInfiniteKey = (query: MovieQuery) => ["movies", "infinite", query] as const;

/**
 * What a caller may tune on the catalogue list queries. Both are optional and
 * fall back to today's behaviour when left out.
 *
 * `staleTime` exists for the browse shelves: App.tsx makes "app came back to
 * the foreground" count as a window focus, and the Media tab keeps every
 * visited shelf mounted, so a 30s window re-asked every shelf at once each
 * time the phone came out of a pocket. The hubs pass 5 minutes; search keeps
 * its 30s (BROWSE_STALE_TIME_MS below is the hubs' value). Pull-to-refresh and Retry still force fresh data (they refetch or
 * invalidate, which ignores staleTime).
 */
export const BROWSE_STALE_TIME_MS = 5 * 60_000;

export interface CatalogListOptions {
  enabled?: boolean;
  staleTime?: number;
  refetchOnWindowFocus?: boolean;
}

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
export function useMovies(query: MovieQuery = {}, options: CatalogListOptions = {}) {
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
    // than re-requested. The browse shelves pass a longer window.
    staleTime: options.staleTime ?? SEARCH_STALE_TIME_MS,
    // Only when the caller says so — otherwise the app-wide default applies.
    ...(options.refetchOnWindowFocus !== undefined && { refetchOnWindowFocus: options.refetchOnWindowFocus }),
    // Same option shape as useBooksList/useSeriesList: a caller states when it
    // may ask at all. MovieDetails uses it to wait for the movie's category
    // instead of spending a request on a key it has already decided to discard.
    enabled: options.enabled ?? true,
  });
}

/**
 * The search grid's endless scroll — the filtered catalog query. Cloned from
 * useBooksInfinite: `pages[0].total` is the BACKEND total for the filtered
 * query and is the only honest match count (never items.length of one page).
 */
export function useMoviesInfinite(query: MovieQuery = {}, options: CatalogListOptions = {}) {
  return useInfiniteQuery({
    queryKey: moviesInfiniteKey(query),
    // The siblings' option: the search screen only asks once a term is committed.
    enabled: options.enabled ?? true,
    queryFn: ({ pageParam, signal }) => moviesService.getMovies({ ...query, page: pageParam }, { signal }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((count, page) => count + page.items.length, 0);
      return loaded < lastPage.total ? lastPage.page + 1 : undefined;
    },
    placeholderData: keepPreviousData,
    staleTime: options.staleTime ?? SEARCH_STALE_TIME_MS,
    // Only when the caller says so — otherwise the app-wide default applies.
    ...(options.refetchOnWindowFocus !== undefined && { refetchOnWindowFocus: options.refetchOnWindowFocus }),
  });
}

/**
 * The search field's suggestion rows — a DIFFERENT question from the grid's.
 *
 * The grid answers "what matched?" over the full filter set, thirty posters at
 * a time, on a term the user has COMMITTED — it does not follow the typing at
 * all. This answers "which of these is the one I mean?": eight text rows,
 * relevance order, search + limit + sort and nothing else, on the panel's own
 * 150ms debounce. Between commits the panel is the only live half of the
 * search screen, which is exactly why it exists. Its key is
 * `["movies", "suggest", term]` — provably none of `moviesInfiniteKey`'s, so
 * React Query caches, dedupes and aborts the two independently and the grid's
 * timing is not touched by anything typed into the panel.
 *
 * `enabled` is the panel's visibility: a closed panel must not keep a request
 * on the wire for a field nobody is looking at. A late response can never land
 * on the wrong term for the same two reasons useMovies documents above — the
 * term is in the key, and the forwarded `signal` aborts the superseded request.
 */
export function useMovieSuggestions(term: string, enabled: boolean) {
  return useQuery({
    queryKey: ["movies", "suggest", term],
    queryFn: ({ signal }) =>
      moviesService.getMovies({ search: term, limit: SUGGEST_LIMIT, sort: "relevance" }, { signal }),
    enabled: enabled && term.length >= SEARCH_MIN_LENGTH,
    // Holds the previous term's rows while the next term loads, so the list
    // morphs instead of flashing back to skeletons on every keystroke.
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
    // The same abort handle the two catalogue queries above already forward —
    // leaving a screen mid-flight cancels the request instead of letting it run
    // to completion on the radio.
    queryFn: ({ signal }) => moviesService.getFacets({ signal }),
    staleTime: 5 * 60_000,
  });
}

export function useMovie(id: string | undefined) {
  return useQuery({
    queryKey: ["movie", id],
    queryFn: ({ signal }) => moviesService.getMovieById(id as string, { signal }),
    enabled: !!id,
  });
}
