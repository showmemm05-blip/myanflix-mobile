import type { AccessType } from "@/types/movie";
import type { MovieCategoryRef } from "@/types/category";

export interface Series {
  id: string;
  title: string;
  description: string;
  posterUrl: string | null;
  coverUrl: string | null;
  genre: string;
  language: string;
  releaseYear: number;
  accessType: AccessType;
  categories: MovieCategoryRef[];
  createdAt: string;
  updatedAt: string;
}

export type SeriesListItem = Series & { episodeCount: number };

export interface SeasonSummary {
  seasonNumber: number;
  episodeCount: number;
}

export interface SeriesPurchaseEntry {
  id: string;
  seriesId: string;
  seriesTitle: string;
  posterUrl: string | null;
  amount: number;
  createdAt: string;
}

export interface PlayerEpisodeProgress {
  progressPercent: number;
  lastPositionSeconds: number;
}

export interface PlayerEpisode {
  id: string;
  title: string;
  episodeNumber: number | null;
  duration: number; // minutes
  thumbnailUrl: string | null;
  posterUrl: string | null;
  watchProgress: PlayerEpisodeProgress | null;
}

export interface PlayerSeasonGroup {
  seasonNumber: number;
  episodes: PlayerEpisode[];
}

export interface PlayerEpisodesResponse {
  seasons: PlayerSeasonGroup[];
}

export interface SeriesQuery {
  page?: number;
  limit?: number;
  accessType?: AccessType;
}
