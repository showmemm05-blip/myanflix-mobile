import { useQuery } from "@tanstack/react-query";
import { seriesService } from "@/services/series.service";
import type { PaginationParams } from "@/types/api";
import type { SeriesQuery } from "@/types/series";

export function useSeriesList(query: SeriesQuery = {}) {
  return useQuery({
    queryKey: ["series", query],
    // Forward React Query's abort handle so leaving the screen (or changing the
    // access filter) cancels the in-flight page instead of letting it finish.
    // No `placeholderData`/`staleTime` tuning here: the backend has no `search`
    // param for series, so this key does not change as the user types.
    queryFn: ({ signal }) => seriesService.getSeries(query, { signal }),
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
