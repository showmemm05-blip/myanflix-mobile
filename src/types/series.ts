import type { AccessType, FacetValue } from "@/types/movie";
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

/**
 * The series subset of the canonical sort vocabulary — no rating/mostViewed/
 * mostPurchased in v1 (Series has no rating column and no per-series watch
 * aggregate), so the UI simply doesn't offer them on the series tab.
 */
export type SeriesSort = "relevance" | "recentlyAdded" | "newest" | "oldest" | "title";

/** Same wire format as MovieQuery: arrays travel as CSV, OR within a facet. */
export interface SeriesQuery {
  page?: number;
  limit?: number;
  accessType?: AccessType;
  search?: string;
  genres?: string[];
  languages?: string[];
  yearFrom?: number;
  yearTo?: number;
  sort?: SeriesSort;
}

/** GET /series/facets — genres/languages/years over published series only. */
export interface SeriesFacets {
  genres: FacetValue[];
  languages: FacetValue[];
  years: { min: number; max: number } | null;
}
