import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { seriesService } from "@/services/series.service";
import { SEARCH_MIN_LENGTH, SEARCH_STALE_TIME_MS, SUGGEST_LIMIT } from "@/hooks/useSearchTerm";
import type { SeriesQuery } from "@/types/series";

/** THE infinite series key — spelled here and nowhere else (see booksInfiniteKey). */
export const seriesInfiniteKey = (query: SeriesQuery) => ["series", "infinite", query] as const;
/**
 * THE series suggestion key. Spelled as a factory next to the one above for the
 * same reason: a hand-written copy elsewhere would split the cache in two.
 * Provably distinct from every other series key — `["series", query]` and
 * `["series", id]` are length 2, `["series", "infinite", query]` differs at
 * index 1, and no series id is the literal string "suggest" — so React Query
 * caches, dedupes and aborts the panel and the grid independently.
 */
export const seriesSuggestKey = (term: string) => ["series", "suggest", term] as const;

const MINUTE_MS = 60_000;

/**
 * `options.enabled` has the same shape useBooksList already uses, and exists
 * for the same reason: CategoryDetail and Favorites open on their MOVIES tab,
 * so without it both pulled a speculative 100-row series page for a tab the
 * user may never select.
 */
export function useSeriesList(query: SeriesQuery = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["series", query],
    // Forward React Query's abort handle so leaving the screen (or changing a
    // filter) cancels the in-flight page instead of letting it finish.
    queryFn: ({ signal }) => seriesService.getSeries(query, { signal }),
    enabled: options.enabled ?? true,
    // The one catalogue hook that used to set no window, while its twins all
    // do (useBooksList a minute, useMovies and useSeriesInfinite 30s). Search,
    // Favorites and CategoryDetail all mount the identical
    // ["series",{limit:100}] key, so each open re-downloaded 100 rows already
    // in hand.
    staleTime: MINUTE_MS,
  });
}

/**
 * The series search grid's endless scroll — same pattern as useMoviesInfinite;
 * the backend now filters and searches series server-side, so this key changes
 * as the user types and `pages[0].total` is the honest match count.
 *
 * `options.enabled` has the shape useSeriesList's does and exists for the same
 * reason: CategoryDetail opens on its MOVIES tab, and without it the series
 * pages would be pulled for a tab the user may never select.
 */
export function useSeriesInfinite(query: SeriesQuery = {}, options: { enabled?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: seriesInfiniteKey(query),
    queryFn: ({ pageParam, signal }) => seriesService.getSeries({ ...query, page: pageParam }, { signal }),
    enabled: options.enabled ?? true,
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
 * The series tab's suggestion rows — the series twin of useMovieSuggestions,
 * deliberately identical in every knob so the two panels feel like one feature.
 *
 * The grid answers "what matched?" over the full filter set, thirty posters at
 * a time, on a term the user has COMMITTED. This answers "which of these is the
 * one I mean?": eight rows, relevance order, search + limit + sort and nothing
 * else, on the panel's own 150ms debounce. `sort: "relevance"` is honest here —
 * the backend orders a searched series page title-matches-first.
 *
 * `enabled` is the panel's visibility: a closed panel must not keep a request
 * on the wire for a field nobody is looking at. A late response can never land
 * on the wrong term — the term is in the key, and the forwarded `signal` aborts
 * the superseded request.
 */
export function useSeriesSuggestions(term: string, enabled: boolean) {
  return useQuery({
    queryKey: seriesSuggestKey(term),
    queryFn: ({ signal }) =>
      seriesService.getSeries({ search: term, limit: SUGGEST_LIMIT, sort: "relevance" }, { signal }),
    enabled: enabled && term.length >= SEARCH_MIN_LENGTH,
    // Holds the previous term's rows while the next term loads, so the list
    // morphs instead of flashing back to skeletons on every keystroke.
    placeholderData: keepPreviousData,
    staleTime: SEARCH_STALE_TIME_MS,
  });
}

/** Series filter vocabulary — genres/languages/years only (see SeriesFacets). */
export function useSeriesFacets() {
  return useQuery({
    queryKey: ["series", "facets"],
    queryFn: () => seriesService.getFacets(),
    staleTime: 5 * 60_000,
  });
}

export function useSeries(id: string | undefined) {
  return useQuery({
    queryKey: ["series", id],
    queryFn: ({ signal }) => seriesService.getSeriesById(id as string, { signal }),
    enabled: !!id,
  });
}

export function useEpisodes(id: string | undefined, seasonNumber?: number) {
  return useQuery({
    queryKey: ["series", id, "episodes", seasonNumber],
    // Worth forwarding more than most: the episode list is an unbounded array,
    // so tapping a series and going straight back used to leave the whole thing
    // downloading for a screen nobody is looking at.
    queryFn: ({ signal }) => seriesService.getEpisodes(id as string, seasonNumber, { signal }),
    enabled: !!id,
  });
}

export function usePlayerEpisodes(id: string | undefined) {
  return useQuery({
    queryKey: ["series", id, "player-episodes"],
    queryFn: ({ signal }) => seriesService.getPlayerEpisodes(id as string, { signal }),
    enabled: !!id,
  });
}
