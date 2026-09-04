import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { seriesService } from "@/services/series.service";
import { SEARCH_STALE_TIME_MS } from "@/hooks/useSearchTerm";
import type { PaginationParams } from "@/types/api";
import type { SeriesQuery } from "@/types/series";

/** THE infinite series key — spelled here and nowhere else (see booksInfiniteKey). */
export const seriesInfiniteKey = (query: SeriesQuery) => ["series", "infinite", query] as const;

export function useSeriesList(query: SeriesQuery = {}) {
  return useQuery({
    queryKey: ["series", query],
    // Forward React Query's abort handle so leaving the screen (or changing a
    // filter) cancels the in-flight page instead of letting it finish.
    queryFn: ({ signal }) => seriesService.getSeries(query, { signal }),
  });
}

/**
 * The series search grid's endless scroll — same pattern as useMoviesInfinite;
 * the backend now filters and searches series server-side, so this key changes
 * as the user types and `pages[0].total` is the honest match count.
 */
export function useSeriesInfinite(query: SeriesQuery = {}) {
  return useInfiniteQuery({
    queryKey: seriesInfiniteKey(query),
    queryFn: ({ pageParam, signal }) => seriesService.getSeries({ ...query, page: pageParam }, { signal }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((count, page) => count + page.items.length, 0);
      return loaded < lastPage.total ? lastPage.page + 1 : undefined;
    },
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
    queryFn: () => seriesService.getSeriesById(id as string),
    enabled: !!id,
  });
}

export function useSeasons(id: string | undefined) {
  return useQuery({
    queryKey: ["series", id, "seasons"],
    queryFn: () => seriesService.getSeasons(id as string),
    enabled: !!id,
  });
}

export function useEpisodes(id: string | undefined, seasonNumber?: number) {
  return useQuery({
    queryKey: ["series", id, "episodes", seasonNumber],
    queryFn: () => seriesService.getEpisodes(id as string, seasonNumber),
    enabled: !!id,
  });
}

export function usePlayerEpisodes(id: string | undefined) {
  return useQuery({
    queryKey: ["series", id, "player-episodes"],
    queryFn: () => seriesService.getPlayerEpisodes(id as string),
    enabled: !!id,
  });
}

export function useMySeriesPurchases(pagination: PaginationParams = {}) {
  return useQuery({
    queryKey: ["series-purchases", "me", pagination],
    queryFn: () => seriesService.getMySeriesPurchases(pagination),
  });
}
