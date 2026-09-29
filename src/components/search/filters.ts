import type { TranslationShape } from "@/localization/translations";
import type { MovieQuery, MovieSort } from "@/types/movie";
import type { SeriesQuery, SeriesSort } from "@/types/series";

/*
 * THE search filter vocabulary on mobile — the types, the defaults, and the
 * pure functions between them and the wire. The Search screen and the
 * SearchFilters page both read the shared store (searchFiltersStore) and both
 * translate through here, so a filter can never reach the backend in two
 * different spellings. The server does ALL filtering/sorting/counting; this
 * file only maps UI state to query params and back to labels.
 *
 * Deliberately SMALL: presets only. The old sheet's custom year/duration
 * sliders, cast/director/country/age-rating pickers and the access toggle are
 * gone with it — a filter that needs a slider is a filter nobody used.
 */

/** Release-year presets — sugar over yearFrom/yearTo. */
export type YearPreset = "any" | "this" | "last5" | "2010s" | "2000s" | "older";

/** Runtime buckets — pure UI presets over durationMin/durationMax (minutes). */
export type DurationBucket = "any" | "short" | "medium" | "long";

/** Minimum rating; 0 means "any" and sends nothing. */
export type RatingFloor = 0 | 7 | 8 | 9;

export interface MovieFilters {
  sort: MovieSort;
  /** OR within the facet, AND across facets — the backend's rule. */
  genres: string[];
  languages: string[];
  yearPreset: YearPreset;
  durationBucket: DurationBucket;
  ratingMin: RatingFloor;
}

/** The series tab's subset — no duration or rating filters on series. */
export interface SeriesFilters {
  sort: SeriesSort;
  genres: string[];
  languages: string[];
  yearPreset: YearPreset;
}

export const DEFAULT_MOVIE_SORT: MovieSort = "recentlyAdded";
export const DEFAULT_SERIES_SORT: SeriesSort = "recentlyAdded";

/** The chip rows' order, spelled once so the page and the summary agree. */
export const YEAR_PRESETS: readonly YearPreset[] = ["any", "this", "last5", "2010s", "2000s", "older"];
export const DURATION_BUCKETS: readonly DurationBucket[] = ["any", "short", "medium", "long"];
export const RATING_FLOORS: readonly RatingFloor[] = [0, 7, 8, 9];

/** Fresh objects on purpose — shared array instances would alias state. */
export function createMovieFilters(): MovieFilters {
  return {
    sort: DEFAULT_MOVIE_SORT,
    genres: [],
    languages: [],
    yearPreset: "any",
    durationBucket: "any",
    ratingMin: 0,
  };
}

export function createSeriesFilters(): SeriesFilters {
  return {
    sort: DEFAULT_SERIES_SORT,
    genres: [],
    languages: [],
    yearPreset: "any",
  };
}

function yearBounds(preset: YearPreset): Pick<MovieQuery, "yearFrom" | "yearTo"> {
  const thisYear = new Date().getFullYear();
  switch (preset) {
    case "this":
      return { yearFrom: thisYear, yearTo: thisYear };
    case "last5":
      return { yearFrom: thisYear - 4 };
    case "2010s":
      return { yearFrom: 2010, yearTo: 2019 };
    case "2000s":
      return { yearFrom: 2000, yearTo: 2009 };
    case "older":
      return { yearTo: 1999 };
    default:
      return {};
  }
}

function durationBounds(bucket: DurationBucket): Pick<MovieQuery, "durationMin" | "durationMax"> {
  switch (bucket) {
    case "short":
      return { durationMax: 90 };
    case "medium":
      return { durationMin: 91, durationMax: 120 };
    case "long":
      return { durationMin: 121 };
    default:
      return {};
  }
}

/**
 * UI state → wire params. Defaults are OMITTED, not sent: untouched filters
 * produce the exact same query (and React Query key) as no filters at all.
 * The relevance guard lives in the Search screen (sort resets when the term
 * clears), so this stays a pure translation.
 */
export function movieFiltersToQuery(f: MovieFilters): Partial<MovieQuery> {
  const query: Partial<MovieQuery> = {};
  if (f.sort !== DEFAULT_MOVIE_SORT) query.sort = f.sort;
  if (f.genres.length > 0) query.genres = f.genres;
  if (f.languages.length > 0) query.languages = f.languages;
  Object.assign(query, yearBounds(f.yearPreset));
  if (f.ratingMin > 0) query.ratingMin = f.ratingMin;
  Object.assign(query, durationBounds(f.durationBucket));
  return query;
}

export function seriesFiltersToQuery(f: SeriesFilters): Partial<SeriesQuery> {
  const query: Partial<SeriesQuery> = {};
  if (f.sort !== DEFAULT_SERIES_SORT) query.sort = f.sort;
  if (f.genres.length > 0) query.genres = f.genres;
  if (f.languages.length > 0) query.languages = f.languages;
  Object.assign(query, yearBounds(f.yearPreset));
  return query;
}

/** Badge count: one per active value, one per active preset; the sort only when it is not the default. */
export function countMovieFilters(f: MovieFilters): number {
  return (
    f.genres.length +
    f.languages.length +
    (f.yearPreset !== "any" ? 1 : 0) +
    (f.durationBucket !== "any" ? 1 : 0) +
    (f.ratingMin > 0 ? 1 : 0) +
    (f.sort !== DEFAULT_MOVIE_SORT ? 1 : 0)
  );
}

export function countSeriesFilters(f: SeriesFilters): number {
  return (
    f.genres.length +
    f.languages.length +
    (f.yearPreset !== "any" ? 1 : 0) +
    (f.sort !== DEFAULT_SERIES_SORT ? 1 : 0)
  );
}

/**
 * The sort vocabularies, spelled ONCE. Relevance is only honest while a term
 * is in the query — without one the server falls back to recentlyAdded.
 */
export function movieSortOptions(t: TranslationShape, hasSearchTerm: boolean): { value: MovieSort; label: string }[] {
  return [
    ...(hasSearchTerm ? [{ value: "relevance" as const, label: t.search.sortRelevance }] : []),
    { value: "recentlyAdded", label: t.search.sortRecentlyAdded },
    { value: "newest", label: t.search.sortNewest },
    { value: "oldest", label: t.search.sortOldest },
    { value: "rating", label: t.search.sortRating },
    { value: "title", label: t.search.sortTitle },
    { value: "mostViewed", label: t.search.sortMostViewed },
    { value: "mostPurchased", label: t.search.sortMostPurchased },
  ];
}

export function seriesSortOptions(t: TranslationShape, hasSearchTerm: boolean): { value: SeriesSort; label: string }[] {
  return [
    ...(hasSearchTerm ? [{ value: "relevance" as const, label: t.search.sortRelevance }] : []),
    { value: "recentlyAdded", label: t.search.sortRecentlyAdded },
    { value: "newest", label: t.search.sortNewest },
    { value: "oldest", label: t.search.sortOldest },
    { value: "title", label: t.search.sortTitle },
  ];
}

/** The CURRENT sort's own label — what the summary line names. */
export function sortLabel(t: TranslationShape, sort: MovieSort | SeriesSort): string {
  switch (sort) {
    case "relevance":
      return t.search.sortRelevance;
    case "newest":
      return t.search.sortNewest;
    case "oldest":
      return t.search.sortOldest;
    case "rating":
      return t.search.sortRating;
    case "title":
      return t.search.sortTitle;
    case "mostViewed":
      return t.search.sortMostViewed;
    case "mostPurchased":
      return t.search.sortMostPurchased;
    default:
      return t.search.sortRecentlyAdded;
  }
}

export function yearPresetLabel(t: TranslationShape, preset: YearPreset): string {
  switch (preset) {
    case "this":
      return t.search.yearPresetThis;
    case "last5":
      return t.search.yearPresetLast5;
    case "2010s":
      return "2010s";
    case "2000s":
      return "2000s";
    case "older":
      return t.search.yearPresetOlder;
    default:
      return t.search.allYears;
  }
}

export function durationBucketLabel(t: TranslationShape, bucket: DurationBucket): string {
  switch (bucket) {
    case "short":
      return t.search.durationShort;
    case "medium":
      return t.search.durationMedium;
    case "long":
      return t.search.durationLong;
    default:
      return t.search.durationAny;
  }
}

export function ratingFloorLabel(t: TranslationShape, floor: RatingFloor): string {
  return floor === 0 ? t.search.ratingAny : t.search.ratingFloor.replace("{n}", String(floor));
}

/** The pieces every summary shares — genres, languages, a non-default sort, a year preset. */
function summarizeCommon(
  t: TranslationShape,
  f: MovieFilters | SeriesFilters,
  defaultSort: MovieSort | SeriesSort,
): string[] {
  const parts: string[] = [];
  if (f.genres.length > 0) parts.push(f.genres.join(", "));
  if (f.languages.length > 0) parts.push(f.languages.join(", "));
  if (f.sort !== defaultSort) parts.push(sortLabel(t, f.sort));
  if (f.yearPreset !== "any") parts.push(yearPresetLabel(t, f.yearPreset));
  return parts;
}

/**
 * One short line under the tabs — "Action, Comedy · Top rated · 2010s" — or
 * null when nothing is active, so the caller can drop the row entirely.
 */
export function summarizeMovieFilters(t: TranslationShape, f: MovieFilters): string | null {
  const parts = summarizeCommon(t, f, DEFAULT_MOVIE_SORT);
  if (f.durationBucket !== "any") parts.push(durationBucketLabel(t, f.durationBucket));
  if (f.ratingMin > 0) parts.push(ratingFloorLabel(t, f.ratingMin));
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function summarizeSeriesFilters(t: TranslationShape, f: SeriesFilters): string | null {
  const parts = summarizeCommon(t, f, DEFAULT_SERIES_SORT);
  return parts.length > 0 ? parts.join(" · ") : null;
}
