import { seriesApi } from "@/api/series.api";
import { mapMovie } from "@/services/movies.service";
import type { PaginatedResponse, RequestSignalOptions } from "@/types/api";
import type { Movie } from "@/types/movie";
import type {
  PlayerEpisodesResponse,
  Series,
  SeriesFacets,
  SeriesListItem,
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

  async getSeriesById(id: string, options: RequestSignalOptions = {}): Promise<Series> {
    return seriesApi.getSeriesById(id, options);
  },

  async getEpisodes(
    id: string,
    seasonNumber?: number,
    options: RequestSignalOptions = {},
  ): Promise<Movie[]> {
    const raw = await seriesApi.getEpisodes(id, seasonNumber, options);
    return raw.map(mapMovie);
  },

  async getPlayerEpisodes(
    id: string,
    options: RequestSignalOptions = {},
  ): Promise<PlayerEpisodesResponse> {
    return seriesApi.getPlayerEpisodes(id, options);
  },
};
