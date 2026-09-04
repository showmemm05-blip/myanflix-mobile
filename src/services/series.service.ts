import { seriesApi } from "@/api/series.api";
import { mapMovie } from "@/services/movies.service";
import type { PaginatedResponse, PaginationParams, RequestSignalOptions } from "@/types/api";
import type { Movie } from "@/types/movie";
import type {
  PlayerEpisodesResponse,
  SeasonSummary,
  Series,
  SeriesFacets,
  SeriesListItem,
  SeriesPurchaseEntry,
  SeriesQuery,
} from "@/types/series";

export const seriesService = {
  async getSeries(
    query: SeriesQuery = {},
    options: RequestSignalOptions = {},
  ): Promise<PaginatedResponse<SeriesListItem>> {
    return seriesApi.getSeries(query, options);
  },

  async getFacets(): Promise<SeriesFacets> {
    return seriesApi.getFacets();
  },

  async getSeriesById(id: string): Promise<Series> {
    return seriesApi.getSeriesById(id);
  },

  async getSeasons(id: string): Promise<SeasonSummary[]> {
    return seriesApi.getSeasons(id);
  },

  async getEpisodes(id: string, seasonNumber?: number): Promise<Movie[]> {
    const raw = await seriesApi.getEpisodes(id, seasonNumber);
    return raw.map(mapMovie);
  },

  async getPlayerEpisodes(id: string): Promise<PlayerEpisodesResponse> {
    return seriesApi.getPlayerEpisodes(id);
  },

  async getMySeriesPurchases(pagination: PaginationParams = {}): Promise<PaginatedResponse<SeriesPurchaseEntry>> {
    return seriesApi.getMySeriesPurchases(pagination);
  },
};
