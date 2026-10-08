import type { TranslationShape } from "@/localization/translations";
import type { MovieQuery, MovieSort } from "@/types/movie";
import type { SeriesQuery, SeriesSort } from "@/types/series";

/*
 * THE search filter vocabulary on mobile — the types, the defaults, and the
 * pure functions between them and the wire. The Media page (its results
 * view, the Sort & filter sheet, the Categories overlay), the search screen
 * and the SearchFilters page all read the shared store (searchFiltersStore)
 * and all translate through here, so a filter can never reach the backend in
 * two different spellings. The server does ALL filtering/sorting/counting;
 * this file only maps UI state to query params and back to labels.
 *
 * Two halves of one filter object, the Netflix way:
 * - the SELECTION — the genre (and, on movies, the admin category) the Media
 *   page is showing. It is picked from the Categories overlay and drawn as
 *   the highlighted chip in the Media chip row.
 * - the REFINEMENTS — sort, year, language, Free only and (movies) rating
 *   and length. They are edited in the Sort & filter sheet and drawn as the
 *   removable chips above the results.
 *
 * Deliberately SMALL: presets only (no sliders).
 */

/** Release-year presets — sugar over yearFrom/yearTo. */
export type YearPreset = "any" | "this" | "last5" | "2010s" | "2000s" | "older";

/** Runtime buckets — pure UI presets over durationMin/durationMax (minutes). */
export type DurationBucket = "any" | "short" | "medium" | "long";

/** Minimum rating; 0 means "any" and sends nothing. */
export type RatingFloor = 0 | 7 | 8 | 9;

/**
 * The movie sorts the UI can hold: every server sort, plus "trending" —
 * Trending now. There is no trend data, so it is spelled honestly as the
 * most-viewed titles among recent releases: sort=mostViewed limited to
 * releaseYear >= this year − 1 (see movieFiltersToQuery). While it is the
 * sort, the year preset is not applied (Trending now owns the years).
 */
export type MovieSortChoice = MovieSort | "trending";

export interface MovieFilters {
  sort: MovieSortChoice;
  /** OR within the facet, AND across facets — the backend's rule. */
  genres: string[];
  /**
   * One admin category (GET /categories), sent as categoryId. Movies only:
   * GET /series has no category filter, so series filters never carry one —
   * the Media page's Series results keep their category beside them and
   * match it on the client (useSeriesResults, SeriesHubContent).
   */
  categoryId: string | null;
  languages: string[];
  yearPreset: YearPreset;
  durationBucket: DurationBucket;
  ratingMin: RatingFloor;
  /** Only titles anyone can watch without a subscription (accessType=FREE). */
  freeOnly: boolean;
}

/** The series tab's subset — no category, duration or rating filters on series. */
export interface SeriesFilters {
  sort: SeriesSort;
  genres: string[];
  languages: string[];
  yearPreset: YearPreset;
  /** Only series anyone can watch without a subscription (accessType=FREE). */
  freeOnly: boolean;
}

export const DEFAULT_MOVIE_SORT: MovieSort = "recentlyAdded";
export const DEFAULT_SERIES_SORT: SeriesSort = "recentlyAdded";

/** The chip rows' order, spelled once so every surface agrees. */
export const YEAR_PRESETS: readonly YearPreset[] = ["any", "this", "last5", "2010s", "2000s", "older"];
export const DURATION_BUCKETS: readonly DurationBucket[] = ["any", "short", "medium", "long"];
export const RATING_FLOORS: readonly RatingFloor[] = [0, 7, 8, 9];

/** Fresh objects on purpose — shared array instances would alias state. */
export function createMovieFilters(): MovieFilters {
  return {
    sort: DEFAULT_MOVIE_SORT,
    genres: [],
    categoryId: null,
    languages: [],
    yearPreset: "any",
    durationBucket: "any",
    ratingMin: 0,
    freeOnly: false,
  };
}

export function createSeriesFilters(): SeriesFilters {
  return {
    sort: DEFAULT_SERIES_SORT,
    genres: [],
    languages: [],
    yearPreset: "any",
    freeOnly: false,
  };
}

/** Trending now's first release year: last year and this one. */
export function trendingFromYear(): number {
  return new Date().getFullYear() - 1;
}

/**
 * Top rated lists RATED titles only. An unrated title is stored as 0 (and
 * so sorts last), and an admin rating has one decimal, so 0.1 is the lowest
 * real rating: sent as ratingMin, it leaves exactly the unrated ones out —
 * the Top rated shelf, its See all, the sheet's sort and its count agree.
 */
const RATED_MIN = 0.1;

/** The year preset that actually applies — none while Trending now owns the years. */
function effectiveYearPreset(f: MovieFilters | SeriesFilters): YearPreset {
  return f.sort === "trending" ? "any" : f.yearPreset;
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
 * UI state → wire params. Two sorts carry a filter with them: Trending now
 * (recent releases) and Top rated (rated titles only, RATED_MIN, unless a
 * higher rating floor is set). Defaults are OMITTED, not sent: untouched
 * filters produce the exact same query (and React Query key) as no filters at all —
 * so a genre view with no refinements shares its first page with the Media
 * page's own genre hero. The relevance guard lives in the search screen (the
 * sort resets when the term clears), so this stays a pure translation.
 */
export function movieFiltersToQuery(f: MovieFilters): Partial<MovieQuery> {
  const query: Partial<MovieQuery> = {};
  if (f.sort === "trending") {
    query.sort = "mostViewed";
    query.yearFrom = trendingFromYear();
  } else {
    if (f.sort !== DEFAULT_MOVIE_SORT) query.sort = f.sort;
    Object.assign(query, yearBounds(f.yearPreset));
  }
  if (f.genres.length > 0) query.genres = f.genres;
  if (f.categoryId) query.categoryId = f.categoryId;
  if (f.languages.length > 0) query.languages = f.languages;
  if (f.ratingMin > 0) query.ratingMin = f.ratingMin;
  else if (f.sort === "rating") query.ratingMin = RATED_MIN;
  Object.assign(query, durationBounds(f.durationBucket));
  if (f.freeOnly) query.accessType = "FREE";
  return query;
}

export function seriesFiltersToQuery(f: SeriesFilters): Partial<SeriesQuery> {
  const query: Partial<SeriesQuery> = {};
  if (f.sort !== DEFAULT_SERIES_SORT) query.sort = f.sort;
  if (f.genres.length > 0) query.genres = f.genres;
  if (f.languages.length > 0) query.languages = f.languages;
  Object.assign(query, yearBounds(f.yearPreset));
  if (f.freeOnly) query.accessType = "FREE";
  return query;
}

/* ---- counts: the selection, the refinements, and both ---- */

/** The genre(s) and category the Media page is showing. */
export function countMovieSelection(f: MovieFilters): number {
  return f.genres.length + (f.categoryId ? 1 : 0);
}

export function countSeriesSelection(f: SeriesFilters): number {
  return f.genres.length;
}

/** One per active refinement value; the sort only when it is not the default. */
export function countMovieRefinements(f: MovieFilters): number {
  return (
    f.languages.length +
    (effectiveYearPreset(f) !== "any" ? 1 : 0) +
    (f.durationBucket !== "any" ? 1 : 0) +
    (f.ratingMin > 0 ? 1 : 0) +
    (f.freeOnly ? 1 : 0) +
    (f.sort !== DEFAULT_MOVIE_SORT ? 1 : 0)
  );
}

export function countSeriesRefinements(f: SeriesFilters): number {
  return (
    f.languages.length +
    (f.yearPreset !== "any" ? 1 : 0) +
    (f.freeOnly ? 1 : 0) +
    (f.sort !== DEFAULT_SERIES_SORT ? 1 : 0)
  );
}

/** Badge count: every active value, selection included. */
export function countMovieFilters(f: MovieFilters): number {
  return countMovieSelection(f) + countMovieRefinements(f);
}

export function countSeriesFilters(f: SeriesFilters): number {
  return countSeriesSelection(f) + countSeriesRefinements(f);
}

/** The refinements back to their defaults; the selection (genre, category) stays. */
export function clearMovieRefinements(f: MovieFilters): MovieFilters {
  return { ...createMovieFilters(), genres: f.genres, categoryId: f.categoryId };
}

export function clearSeriesRefinements(f: SeriesFilters): SeriesFilters {
  return { ...createSeriesFilters(), genres: f.genres };
}

/* ---- sort vocabularies ---- */

/**
 * The CategoryDetail page's sort list (its own sheet) — the full server
 * vocabulary under its original names. Relevance is only honest while a
 * term is in the query — without one the server falls back to recentlyAdded.
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

/**
 * The Media page's movie sorts — Netflix's names over honest sources:
 * Popular = mostViewed, Trending now = mostViewed over recent releases, New
 * releases = newest (release year), Top rated = rating over rated titles,
 * Recently added = recentlyAdded, A–Z = title. `full` (the SearchFilters page) adds the two
 * the sheet leaves out — Oldest and Most purchased; the sheet instead lists
 * one of them only while it is the current sort, so what is applied is
 * always visible.
 */
export function movieSortChoices(
  t: TranslationShape,
  hasSearchTerm: boolean,
  options: { full?: boolean; current?: MovieSortChoice } = {},
): { value: MovieSortChoice; label: string }[] {
  const list: { value: MovieSortChoice; label: string }[] = [
    ...(hasSearchTerm ? [{ value: "relevance" as const, label: t.search.sortRelevance }] : []),
    { value: "mostViewed", label: t.search.sortPopular },
    { value: "trending", label: t.search.sortTrending },
    { value: "newest", label: t.search.sortNewReleases },
    { value: "rating", label: t.search.sortRating },
    { value: "recentlyAdded", label: t.search.sortRecentlyAdded },
    { value: "title", label: t.hub.sortAz },
  ];
  const extras: { value: MovieSortChoice; label: string }[] = [
    { value: "oldest", label: t.search.sortOldest },
    { value: "mostPurchased", label: t.search.sortMostPurchased },
  ];
  for (const extra of extras) {
    if (options.full || options.current === extra.value) list.push(extra);
  }
  return list;
}

/**
 * The Media page's series sorts: Recently added, Newest, Oldest, A–Z — no
 * popularity or rating sort exists for series, so there is nothing to call
 * "New releases" beside "Popular" the way Movies does; the plain pair reads
 * truer here.
 */
export function seriesSortChoices(t: TranslationShape, hasSearchTerm: boolean): { value: SeriesSort; label: string }[] {
  return [
    ...(hasSearchTerm ? [{ value: "relevance" as const, label: t.search.sortRelevance }] : []),
    { value: "recentlyAdded", label: t.search.sortRecentlyAdded },
    { value: "newest", label: t.search.sortNewest },
    { value: "oldest", label: t.search.sortOldest },
    { value: "title", label: t.hub.sortAz },
  ];
}

/** The CURRENT sort under its original name — the CategoryDetail page's chip. */
export function sortLabel(t: TranslationShape, sort: MovieSortChoice | SeriesSort): string {
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
    case "trending":
      return t.search.sortTrending;
    default:
      return t.search.sortRecentlyAdded;
  }
}

/**
 * The current sort under its Media-page name — the filter row's sort chip
 * and the results view's heading, spelled exactly as the sheet lists it
 * (movieSortChoices / seriesSortChoices), so one screen never names one
 * sort two ways.
 */
export function sortChoiceLabel(t: TranslationShape, sort: MovieSortChoice | SeriesSort, kind: "movies" | "series"): string {
  switch (sort) {
    case "mostViewed":
      return t.search.sortPopular;
    case "trending":
      return t.search.sortTrending;
    case "newest":
      return kind === "movies" ? t.search.sortNewReleases : t.search.sortNewest;
    case "title":
      return t.hub.sortAz;
    default:
      return sortLabel(t, sort);
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

/* ---- the removable chips ---- */

/**
 * One chip in a filter row: an active value with its ✕. Pressing it removes
 * THAT value only (FilterBar's FilterRow); the row's Clear all removes them
 * all. `key` is unique within the row — a genre and a language can share a
 * label ("Burmese").
 */
export interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

type Update<F> = (updater: (prev: F) => F) => void;

interface ChipOptions {
  /**
   * Include the selection (category, genres) as chips — the search screen,
   * where nothing else shows it. The Media results view leaves it out: its
   * chip row already shows the picked genre or category.
   */
  selection: boolean;
  /** The category's name (GET /categories), when known. */
  categoryName?: string | null;
}

/**
 * The movie filter row's chips, one per active value: Free only first (it
 * changes WHICH titles can appear at all), then the selection, languages,
 * the sort and the presets. Empty when nothing is active.
 */
export function movieFilterChips(
  t: TranslationShape,
  f: MovieFilters,
  update: Update<MovieFilters>,
  options: ChipOptions,
): FilterChip[] {
  const chips: FilterChip[] = [];
  if (f.freeOnly) chips.push({ key: "free", label: t.search.freeOnly, onRemove: () => update((p) => ({ ...p, freeOnly: false })) });
  if (options.selection) {
    if (f.categoryId) {
      chips.push({
        key: `category:${f.categoryId}`,
        label: options.categoryName || t.browse.categoryOverline,
        onRemove: () => update((p) => ({ ...p, categoryId: null })),
      });
    }
    for (const genre of f.genres) {
      chips.push({
        key: `genre:${genre}`,
        label: genre,
        onRemove: () => update((p) => ({ ...p, genres: p.genres.filter((g) => g !== genre) })),
      });
    }
  }
  for (const language of f.languages) {
    chips.push({
      key: `language:${language}`,
      label: language,
      onRemove: () => update((p) => ({ ...p, languages: p.languages.filter((l) => l !== language) })),
    });
  }
  if (f.sort !== DEFAULT_MOVIE_SORT) {
    chips.push({
      key: "sort",
      label: sortChoiceLabel(t, f.sort, "movies"),
      onRemove: () => update((p) => ({ ...p, sort: DEFAULT_MOVIE_SORT })),
    });
  }
  const year = effectiveYearPreset(f);
  if (year !== "any") {
    chips.push({ key: "year", label: yearPresetLabel(t, year), onRemove: () => update((p) => ({ ...p, yearPreset: "any" })) });
  }
  if (f.durationBucket !== "any") {
    chips.push({
      key: "duration",
      label: durationBucketLabel(t, f.durationBucket),
      onRemove: () => update((p) => ({ ...p, durationBucket: "any" })),
    });
  }
  if (f.ratingMin > 0) {
    chips.push({ key: "rating", label: ratingFloorLabel(t, f.ratingMin), onRemove: () => update((p) => ({ ...p, ratingMin: 0 })) });
  }
  return chips;
}

export function seriesFilterChips(
  t: TranslationShape,
  f: SeriesFilters,
  update: Update<SeriesFilters>,
  options: Pick<ChipOptions, "selection">,
): FilterChip[] {
  const chips: FilterChip[] = [];
  if (f.freeOnly) chips.push({ key: "free", label: t.search.freeOnly, onRemove: () => update((p) => ({ ...p, freeOnly: false })) });
  if (options.selection) {
    for (const genre of f.genres) {
      chips.push({
        key: `genre:${genre}`,
        label: genre,
        onRemove: () => update((p) => ({ ...p, genres: p.genres.filter((g) => g !== genre) })),
      });
    }
  }
  for (const language of f.languages) {
    chips.push({
      key: `language:${language}`,
      label: language,
      onRemove: () => update((p) => ({ ...p, languages: p.languages.filter((l) => l !== language) })),
    });
  }
  if (f.sort !== DEFAULT_SERIES_SORT) {
    chips.push({
      key: "sort",
      label: sortChoiceLabel(t, f.sort, "series"),
      onRemove: () => update((p) => ({ ...p, sort: DEFAULT_SERIES_SORT })),
    });
  }
  if (f.yearPreset !== "any") {
    chips.push({ key: "year", label: yearPresetLabel(t, f.yearPreset), onRemove: () => update((p) => ({ ...p, yearPreset: "any" })) });
  }
  return chips;
}

/**
 * What the Media chip row's highlighted chip (and the results heading) says
 * for the selection: the one name picked, or the first name "+ n" — the
 * category first, then the genres. Several can be on at once only from the
 * SearchFilters page (more genres, or genres on top of an overlay category);
 * the "+ n" keeps every one of them visible. Null when nothing is picked.
 * `category` is the picked category's display name, null when none is picked.
 */
export function selectionLabel(genres: readonly string[], category: string | null): string | null {
  const names = category ? [category, ...genres] : genres;
  if (names.length === 0) return null;
  return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`;
}
