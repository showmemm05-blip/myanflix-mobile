import { apiClient } from "@/api/client";
import type { BackendMovie } from "@/api/movies.api";
import type { PaginatedResponse, PaginationParams } from "@/types/api";
import type {
  PlayerEpisodesResponse,
  SeasonSummary,
  Series,
  SeriesListItem,
  SeriesPurchaseEntry,
  SeriesQuery,
} from "@/types/series";

export const seriesApi = {
  getSeries(query: SeriesQuery = {}) {
    return apiClient.get<PaginatedResponse<SeriesListItem>>("/series", { params: query });
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
