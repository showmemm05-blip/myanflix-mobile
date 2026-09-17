import { apiClient, csvParams } from "@/api/client";
import type { BackendMovie } from "@/api/movies.api";
import type { PaginatedResponse, RequestSignalOptions } from "@/types/api";
import type {
  PlayerEpisodesResponse,
  Series,
  SeriesFacets,
  SeriesListItem,
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

  getSeriesById(id: string, options: RequestSignalOptions = {}) {
    return apiClient.get<Series>(`/series/${id}`, options);
  },

  /** An unbounded array — one of the two the abort handle matters most for. */
  getEpisodes(id: string, seasonNumber?: number, options: RequestSignalOptions = {}) {
    return apiClient.get<BackendMovie[]>(`/series/${id}/episodes`, {
      params: seasonNumber !== undefined ? { seasonNumber } : undefined,
      ...options,
    });
  },

  getPlayerEpisodes(id: string, options: RequestSignalOptions = {}) {
    return apiClient.get<PlayerEpisodesResponse>(`/series/${id}/player-episodes`, options);
  },
};
