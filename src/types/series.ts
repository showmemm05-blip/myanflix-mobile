import type { AccessType, FacetValue, MovieActorRef } from "@/types/movie";
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
  /** Admin-set 0–10, same meaning as Movie.rating: 0 = not rated, shown as nothing. */
  rating: number;
  accessType: AccessType;
  categories: MovieCategoryRef[];
  /**
   * The show-level cast (2026-09-24) — the same `{id,name,imageUrl}` ref a
   * movie carries, so the series page draws the movie page's cast row
   * unchanged. Optional only so an older backend row still type-checks; the
   * server always sends it (possibly `[]`).
   */
  actors?: MovieActorRef[];
  createdAt: string;
  updatedAt: string;
}

export type SeriesListItem = Series & { episodeCount: number };

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
 * mostPurchased in v1 (the API offers no series sort by rating — the column
 * only arrived on 2026-09-21 — and there is no per-series watch aggregate),
 * so the UI simply doesn't offer them on the series tab.
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
  /**
   * OR within the facet, like MovieQuery.actorIds. A series matches when any
   * of these people is on the show itself OR on any of its episodes — so an
   * actor credited only on an episode still lists the show on their page.
   */
  actorIds?: string[];
  sort?: SeriesSort;
}

/** GET /series/facets — genres/languages/years over published series only. */
export interface SeriesFacets {
  genres: FacetValue[];
  languages: FacetValue[];
  years: { min: number; max: number } | null;
}
