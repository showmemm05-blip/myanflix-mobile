import type { Dispatch, SetStateAction } from "react";
import {
  AGE_RATING_LABELS,
  DEFAULT_MOVIE_SORT,
  DEFAULT_SERIES_SORT,
  DURATION_SLIDER_MAX,
  type MovieFilters,
  type SeriesFilters,
} from "@/components/search/SearchFilterSheet";
import type { TranslationShape } from "@/localization/translations";
import type { MovieSort } from "@/types/movie";
import type { SeriesSort } from "@/types/series";

/*
 * The removable-pill row's vocabulary, kept next to SearchFilterSheet — which
 * declares itself the ONE filter-state owner and already holds MovieFilters,
 * SeriesFilters, countMovieFilters and AGE_RATING_LABELS. The builder was the
 * only piece of that vocabulary that had ended up in the Search screen, which
 * meant a new filter could get a sheet control and a query param but no way to
 * remove it from the pill row. Now the three are edited in one place.
 *
 * Everything here is a pure function of filter state and the translation
 * table: no hooks, no screen state. The screen keeps the useMemo.
 */

/** One removable pill in the active-filters row. */
export interface FilterPill {
  key: string;
  label: string;
  onRemove: () => void;
}

function sortLabel(t: TranslationShape, sort: MovieSort | SeriesSort): string {
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

function yearPillLabel(t: TranslationShape, f: MovieFilters | SeriesFilters): string {
  switch (f.yearPreset) {
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
      return `${f.yearFrom ?? ""}–${f.yearTo ?? ""}`;
  }
}

/** One pill per active value — tap removes exactly that value. */
export function buildFilterPills(args: {
  tab: string;
  filters: MovieFilters;
  seriesFilters: SeriesFilters;
  setFilters: Dispatch<SetStateAction<MovieFilters>>;
  setSeriesFilters: Dispatch<SetStateAction<SeriesFilters>>;
  t: TranslationShape;
}): FilterPill[] {
  const { tab, filters, seriesFilters, setFilters, setSeriesFilters, t } = args;
  const pills: FilterPill[] = [];
  if (tab === "series") {
    const f = seriesFilters;
    const set = (partial: Partial<SeriesFilters>) => setSeriesFilters((prev) => ({ ...prev, ...partial }));
    if (f.sort !== DEFAULT_SERIES_SORT)
      pills.push({ key: "sort", label: sortLabel(t, f.sort), onRemove: () => set({ sort: DEFAULT_SERIES_SORT }) });
    for (const genre of f.genres)
      pills.push({
        key: `genre:${genre}`,
        label: genre,
        onRemove: () => set({ genres: f.genres.filter((v) => v !== genre) }),
      });
    for (const language of f.languages)
      pills.push({
        key: `language:${language}`,
        label: language,
        onRemove: () => set({ languages: f.languages.filter((v) => v !== language) }),
      });
    if (f.yearPreset !== "any")
      pills.push({
        key: "year",
        label: yearPillLabel(t, f),
        onRemove: () => set({ yearPreset: "any", yearFrom: undefined, yearTo: undefined }),
      });
    if (f.access !== "ALL")
      pills.push({
        key: "access",
        label: f.access === "FREE" ? t.search.accessFree : t.search.accessSubscription,
        onRemove: () => set({ access: "ALL" }),
      });
    return pills;
  }

  const f = filters;
  const set = (partial: Partial<MovieFilters>) => setFilters((prev) => ({ ...prev, ...partial }));
  if (f.sort !== DEFAULT_MOVIE_SORT)
    pills.push({ key: "sort", label: sortLabel(t, f.sort), onRemove: () => set({ sort: DEFAULT_MOVIE_SORT }) });
  for (const genre of f.genres)
    pills.push({
      key: `genre:${genre}`,
      label: genre,
      onRemove: () => set({ genres: f.genres.filter((v) => v !== genre) }),
    });
  for (const language of f.languages)
    pills.push({
      key: `language:${language}`,
      label: language,
      onRemove: () => set({ languages: f.languages.filter((v) => v !== language) }),
    });
  for (const actor of f.actors)
    pills.push({
      key: `actor:${actor.id}`,
      label: actor.name,
      onRemove: () => set({ actors: f.actors.filter((a) => a.id !== actor.id) }),
    });
  for (const director of f.directors)
    pills.push({
      key: `director:${director}`,
      label: director,
      onRemove: () => set({ directors: f.directors.filter((v) => v !== director) }),
    });
  for (const country of f.countries)
    pills.push({
      key: `country:${country}`,
      label: country,
      onRemove: () => set({ countries: f.countries.filter((v) => v !== country) }),
    });
  for (const rating of f.ageRatings)
    pills.push({
      key: `ageRating:${rating}`,
      label: AGE_RATING_LABELS[rating],
      onRemove: () => set({ ageRatings: f.ageRatings.filter((v) => v !== rating) }),
    });
  if (f.yearPreset !== "any")
    pills.push({
      key: "year",
      label: yearPillLabel(t, f),
      onRemove: () => set({ yearPreset: "any", yearFrom: undefined, yearTo: undefined }),
    });
  if (f.ratingMin > 0 || f.ratingMax < 10)
    pills.push({
      key: "rating",
      label: `★ ${f.ratingMin}–${f.ratingMax}`,
      onRemove: () => set({ ratingMin: 0, ratingMax: 10 }),
    });
  if (f.durationBucket !== "any") {
    const label =
      f.durationBucket === "short"
        ? t.search.durationShort
        : f.durationBucket === "medium"
          ? t.search.durationMedium
          : f.durationBucket === "long"
            ? t.search.durationLong
            : `${f.durationMin ?? 0}–${
                (f.durationMax ?? DURATION_SLIDER_MAX) >= DURATION_SLIDER_MAX
                  ? `${DURATION_SLIDER_MAX}+`
                  : f.durationMax
              } min`;
    pills.push({
      key: "duration",
      label,
      onRemove: () => set({ durationBucket: "any", durationMin: undefined, durationMax: undefined }),
    });
  }
  if (f.access !== "ALL")
    pills.push({
      key: "access",
      label: f.access === "FREE" ? t.search.accessFree : t.search.accessSubscription,
      onRemove: () => set({ access: "ALL" }),
    });
  return pills;
}
