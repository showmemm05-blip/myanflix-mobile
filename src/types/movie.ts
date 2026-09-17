import type { MovieCategoryRef } from "@/types/category";

export type MovieStatus = "DRAFT" | "PROCESSING" | "PUBLISHED" | "ARCHIVED";

export type AccessType = "FREE" | "SUBSCRIPTION";

/** Backend enum values — display as G / PG / PG-13 / R / NC-17 (see AGE_RATING_LABELS). */
export type AgeRating = "G" | "PG" | "PG13" | "R" | "NC17";

/**
 * The canonical sort vocabulary — mirrors the backend's MovieSort enum.
 * Every option maps to an honest data source server-side; "relevance" is only
 * offered while a search term is active (without one the server falls back to
 * recentlyAdded), and "mostPurchased" is the frozen pre-subscription purchase
 * table, labeled honestly with an era hint.
 */
export type MovieSort =
  | "relevance"
  | "recentlyAdded"
  | "newest"
  | "oldest"
  | "rating"
  | "title"
  | "mostViewed"
  | "mostPurchased";

export interface Movie {
  id: string;
  title: string;
  description: string;
  posterUrl: string | null;
  coverUrl: string | null;
  genre: string;
  language: string;
  releaseYear: number;
  duration: number; // minutes
  rating: number;
  accessType: AccessType;
  status: MovieStatus;
  seriesId: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  /** Nullable — new metadata the admin backfills over time. */
  director: string | null;
  country: string | null;
  ageRating: AgeRating | null;
  categories: MovieCategoryRef[];
  /**
   * Highest transcoded rendition the catalogue reports for this title, e.g.
   * "720p" — the source of the card's quality badge. Null until a video has
   * finished transcoding, which is most of the catalogue on a fresh install.
   *
   * Still optional on the type: an older backend simply omits the key, and a
   * missing badge is the correct outcome there rather than a crash.
   */
  maxQuality?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The canonical catalog query — the SAME param names as the backend DTO and
 * the web URL. Multi-value facets are OR within the facet, AND across facets;
 * arrays travel as CSV on the wire (see api/client.ts#csvParams).
 */
export interface MovieQuery {
  page?: number;
  limit?: number;
  /** LEGACY single-genre param (deep links) — prefer `genres`. */
  genre?: string;
  categoryId?: string;
  search?: string;
  genres?: string[];
  languages?: string[];
  actorIds?: string[];
  directors?: string[];
  countries?: string[];
  ageRatings?: AgeRating[];
  yearFrom?: number;
  yearTo?: number;
  ratingMin?: number;
  ratingMax?: number;
  /** Minutes — the short/medium/long buckets are pure UI presets over these. */
  durationMin?: number;
  durationMax?: number;
  sort?: MovieSort;
  accessType?: AccessType;
}

/** One offered value of one facet, with how many public movies carry it. */
export interface FacetValue {
  value: string;
  count: number;
}

/**
 * GET /movies/facets — DB-derived distincts over the public catalog. A facet
 * with no values HIDES its filter control (directors/countries/ageRatings
 * until the admin backfills them) — nothing fake is ever offered.
 */
export interface MovieFacets {
  genres: FacetValue[];
  languages: FacetValue[];
  countries: FacetValue[];
  ageRatings: FacetValue[];
  directors: FacetValue[];
  years: { min: number; max: number } | null;
}
