import { apiClient, csvParams } from "@/api/client";
import type { BackendMovie } from "@/api/movies.api";
import type { PaginatedResponse, PaginationParams, RequestSignalOptions } from "@/types/api";
import type {
  PlayerEpisodesResponse,
  SeasonSummary,
  Series,
  SeriesFacets,
  SeriesListItem,
  SeriesPurchaseEntry,
  SeriesQuery,
} from "@/types/series";

export const seriesApi = {
  /** `options.signal` is the search's abort handle — see RequestSignalOptions. */
  getSeries(query: SeriesQuery = {}, options: RequestSignalOptions = {}) {
    return apiClient.get<PaginatedResponse<SeriesListItem>>("/series", { params: csvParams(query), ...options });
  },

  /** DB-derived filter vocabulary for the series tab — genres/languages/years only. */
  getFacets() {
    return apiClient.get<SeriesFacets>("/series/facets");
  },

  getSeriesById(id: string) {
    return apiClient.get<Series>(`/series/${id}`);
  },

  getSeasons(id: string) {
    return apiClient.get<SeasonSummary[]>(`/series/${id}/seasons`);
  },

  getEpisodes(id: string, seasonNumber?: number) {
    return apiClient.get<BackendMovie[]>(`/series/${id}/episodes`, {
      params: seasonNumber !== undefined ? { seasonNumber } : undefined,
    });
  },

  getPlayerEpisodes(id: string) {
    return apiClient.get<PlayerEpisodesResponse>(`/series/${id}/player-episodes`);
  },

  getMySeriesPurchases(pagination: PaginationParams = {}) {
    return apiClient.get<PaginatedResponse<SeriesPurchaseEntry>>("/series/me/purchases", { params: pagination });
  },
};
