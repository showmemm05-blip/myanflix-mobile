import { useState, type ReactNode } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ui/ThemedText";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Slider } from "@/components/ui/Slider";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Chip } from "@/components/common/Chip";
import { useMovieFacets } from "@/hooks/useMovies";
import { useSeriesFacets } from "@/hooks/useSeries";
import { useActorSearch } from "@/hooks/useActors";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { AccessType, AgeRating, MovieQuery, MovieSort } from "@/types/movie";
import type { SeriesQuery, SeriesSort } from "@/types/series";

/*
 * The ONE filter-state owner on mobile, together with the Search screen that
 * holds the state. Everything here mirrors the canonical vocabulary the
 * backend DTO speaks: multi-value facets are OR within a facet and AND across
 * facets; the server does ALL filtering/sorting/counting — this file only
 * renders controls and translates UI state into wire params.
 */

export type AccessFilter = "ALL" | AccessType;

/** ids travel to the API; names exist so chips render without a lookup. */
export interface ActorSelection {
  id: string;
  name: string;
}

/**
 * The duration buckets are pure UI presets over the two raw minute bounds —
 * the backend only ever sees durationMin/durationMax.
 */
export type DurationBucket = "any" | "short" | "medium" | "long" | "custom";

/** Year presets, same idea: sugar over yearFrom/yearTo. */
export type YearPreset = "any" | "this" | "last5" | "2010s" | "2000s" | "older" | "custom";

export interface MovieFilters {
  sort: MovieSort;
  genres: string[];
  languages: string[];
  actors: ActorSelection[];
  directors: string[];
  countries: string[];
  ageRatings: AgeRating[];
  yearPreset: YearPreset;
  /** Only meaningful while yearPreset === "custom". */
  yearFrom?: number;
  yearTo?: number;
  /** 0..10; the full 0–10 span means "any" and sends nothing. */
  ratingMin: number;
  ratingMax: number;
  durationBucket: DurationBucket;
  /** Only meaningful while durationBucket === "custom"; max at the right edge (240) means no cap. */
  durationMin?: number;
  durationMax?: number;
  access: AccessFilter;
}

/** The series tab's subset — no cast/director/country/age-rating/rating/duration columns on Series. */
export interface SeriesFilters {
  sort: SeriesSort;
  genres: string[];
  languages: string[];
  yearPreset: YearPreset;
  yearFrom?: number;
  yearTo?: number;
  access: AccessFilter;
}

export const DEFAULT_MOVIE_SORT: MovieSort = "recentlyAdded";
export const DEFAULT_SERIES_SORT: SeriesSort = "recentlyAdded";

const RATING_MIN = 0;
const RATING_MAX = 10;
/** Right edge of the custom duration sliders — sitting on it means "no cap". */
export const DURATION_SLIDER_MAX = 240;

/** Fresh objects on purpose — shared array instances would alias state. */
export function createMovieFilters(): MovieFilters {
  return {
    sort: DEFAULT_MOVIE_SORT,
    genres: [],
    languages: [],
    actors: [],
    directors: [],
    countries: [],
    ageRatings: [],
    yearPreset: "any",
    ratingMin: RATING_MIN,
    ratingMax: RATING_MAX,
    durationBucket: "any",
    access: "ALL",
  };
}

export function createSeriesFilters(): SeriesFilters {
  return {
    sort: DEFAULT_SERIES_SORT,
    genres: [],
    languages: [],
    yearPreset: "any",
    access: "ALL",
  };
}

/** Wire display values for the AgeRating enum — PG13 is spelled PG-13 on screen. */
export const AGE_RATING_LABELS: Record<AgeRating, string> = {
  G: "G",
  PG: "PG",
  PG13: "PG-13",
  R: "R",
  NC17: "NC-17",
};

function yearBounds(preset: YearPreset, from?: number, to?: number): Pick<MovieQuery, "yearFrom" | "yearTo"> {
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
    case "custom":
      return { yearFrom: from, yearTo: to };
    default:
      return {};
  }
}

function durationBounds(
  bucket: DurationBucket,
  min?: number,
  max?: number,
): Pick<MovieQuery, "durationMin" | "durationMax"> {
  switch (bucket) {
    case "short":
      return { durationMax: 90 };
    case "medium":
      return { durationMin: 91, durationMax: 120 };
    case "long":
      return { durationMin: 121 };
    case "custom":
      return {
        durationMin: min && min > 0 ? min : undefined,
        durationMax: max !== undefined && max < DURATION_SLIDER_MAX ? max : undefined,
      };
    default:
      return {};
  }
}

/**
 * UI state → wire params. Defaults are OMITTED, not sent: an untouched sheet
 * produces the exact same query (and React Query key) as no sheet at all.
 * The relevance guard lives in the Search screen (sort resets when the term
 * clears), so this stays a pure translation.
 */
export function movieFiltersToQuery(f: MovieFilters): Partial<MovieQuery> {
  const query: Partial<MovieQuery> = {};
  if (f.sort !== DEFAULT_MOVIE_SORT) query.sort = f.sort;
  if (f.genres.length > 0) query.genres = f.genres;
  if (f.languages.length > 0) query.languages = f.languages;
  if (f.actors.length > 0) query.actorIds = f.actors.map((a) => a.id);
  if (f.directors.length > 0) query.directors = f.directors;
  if (f.countries.length > 0) query.countries = f.countries;
  if (f.ageRatings.length > 0) query.ageRatings = f.ageRatings;
  Object.assign(query, yearBounds(f.yearPreset, f.yearFrom, f.yearTo));
  if (f.ratingMin > RATING_MIN) query.ratingMin = f.ratingMin;
  if (f.ratingMax < RATING_MAX) query.ratingMax = f.ratingMax;
  Object.assign(query, durationBounds(f.durationBucket, f.durationMin, f.durationMax));
  if (f.access !== "ALL") query.accessType = f.access;
  return query;
}

export function seriesFiltersToQuery(f: SeriesFilters): Partial<SeriesQuery> {
  const query: Partial<SeriesQuery> = {};
  if (f.sort !== DEFAULT_SERIES_SORT) query.sort = f.sort;
  if (f.genres.length > 0) query.genres = f.genres;
  if (f.languages.length > 0) query.languages = f.languages;
  Object.assign(query, yearBounds(f.yearPreset, f.yearFrom, f.yearTo));
  if (f.access !== "ALL") query.accessType = f.access;
  return query;
}

/** Badge/chip-row count: one per active value, one per active range/choice. */
export function countMovieFilters(f: MovieFilters): number {
  return (
    f.genres.length +
    f.languages.length +
    f.actors.length +
    f.directors.length +
    f.countries.length +
    f.ageRatings.length +
    (f.yearPreset !== "any" ? 1 : 0) +
    (f.ratingMin > RATING_MIN || f.ratingMax < RATING_MAX ? 1 : 0) +
    (f.durationBucket !== "any" ? 1 : 0) +
    (f.access !== "ALL" ? 1 : 0) +
    (f.sort !== DEFAULT_MOVIE_SORT ? 1 : 0)
  );
}

export function countSeriesFilters(f: SeriesFilters): number {
  return (
    f.genres.length +
    f.languages.length +
    (f.yearPreset !== "any" ? 1 : 0) +
    (f.access !== "ALL" ? 1 : 0) +
    (f.sort !== DEFAULT_SERIES_SORT ? 1 : 0)
  );
}

function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Which tab's filters the sheet is editing — the segments ARE the type control. */
  tab: "movies" | "series";
  filters: MovieFilters;
  onChangeFilters: (next: MovieFilters) => void;
  seriesFilters: SeriesFilters;
  onChangeSeriesFilters: (next: SeriesFilters) => void;
  /** The live backend total for the filtered query — feeds the footer button. */
  total: number | undefined;
  isFetching: boolean;
  /** Whether a search term is active — the relevance sort is only offered then. */
  hasSearchTerm: boolean;
}

/**
 * The search screen's filter drawer. Every control is facet-driven: options
 * come from GET /movies/facets (or /series/facets), so only values that
 * actually exist in the catalog are offered, and a facet with zero values
 * hides its whole section (directors/countries/age ratings at launch).
 */
export function SearchFilterSheet({
  visible,
  onClose,
  tab,
  filters,
  onChangeFilters,
  seriesFilters,
  onChangeSeriesFilters,
  total,
  isFetching,
  hasSearchTerm,
}: Props) {
  const { t } = useLanguage();
  const movieFacets = useMovieFacets();
  const seriesFacets = useSeriesFacets();
  const [actorTerm, setActorTerm] = useState("");
  const actorResults = useActorSearch(actorTerm);

  const isMovies = tab === "movies";
  const facetYears = (isMovies ? movieFacets.data?.years : seriesFacets.data?.years) ?? null;
  const thisYear = new Date().getFullYear();
  const yearMin = facetYears?.min ?? 1950;
  const yearMax = Math.max(facetYears?.max ?? thisYear, yearMin);

  const genreOptions = (isMovies ? movieFacets.data?.genres : seriesFacets.data?.genres) ?? [];
  const languageOptions = (isMovies ? movieFacets.data?.languages : seriesFacets.data?.languages) ?? [];
  const directorOptions = movieFacets.data?.directors ?? [];
  const countryOptions = movieFacets.data?.countries ?? [];
  const ageRatingOptions = movieFacets.data?.ageRatings ?? [];

  const patch = (partial: Partial<MovieFilters>) => onChangeFilters({ ...filters, ...partial });
  const patchSeries = (partial: Partial<SeriesFilters>) => onChangeSeriesFilters({ ...seriesFilters, ...partial });

  const movieSortOptions: { value: MovieSort; label: string }[] = [
    ...(hasSearchTerm ? [{ value: "relevance" as const, label: t.search.sortRelevance }] : []),
    { value: "recentlyAdded", label: t.search.sortRecentlyAdded },
    { value: "newest", label: t.search.sortNewest },
    { value: "oldest", label: t.search.sortOldest },
    { value: "rating", label: t.search.sortRating },
    { value: "title", label: t.search.sortTitle },
    { value: "mostViewed", label: t.search.sortMostViewed },
    { value: "mostPurchased", label: t.search.sortMostPurchased },
  ];
  const seriesSortOptions: { value: SeriesSort; label: string }[] = [
    ...(hasSearchTerm ? [{ value: "relevance" as const, label: t.search.sortRelevance }] : []),
    { value: "recentlyAdded", label: t.search.sortRecentlyAdded },
    { value: "newest", label: t.search.sortNewest },
    { value: "oldest", label: t.search.sortOldest },
    { value: "title", label: t.search.sortTitle },
  ];

  const yearPresetOptions: { value: YearPreset; label: string }[] = [
    { value: "any", label: t.search.allYears },
    { value: "this", label: t.search.yearPresetThis },
    { value: "last5", label: t.search.yearPresetLast5 },
    { value: "2010s", label: "2010s" },
    { value: "2000s", label: "2000s" },
    { value: "older", label: t.search.yearPresetOlder },
    { value: "custom", label: t.search.durationCustom },
  ];

  const yearPreset = isMovies ? filters.yearPreset : seriesFilters.yearPreset;
  const yearFrom = (isMovies ? filters.yearFrom : seriesFilters.yearFrom) ?? yearMin;
  const yearTo = (isMovies ? filters.yearTo : seriesFilters.yearTo) ?? yearMax;
  const setYear = (partial: { yearPreset?: YearPreset; yearFrom?: number; yearTo?: number }) =>
    isMovies ? patch(partial) : patchSeries(partial);

  const selectYearPreset = (value: YearPreset) => {
    if (value === "custom") {
      // Seed the sliders at the full facet span so "custom, untouched" is honest.
      setYear({ yearPreset: "custom", yearFrom: yearMin, yearTo: yearMax });
    } else {
      setYear({ yearPreset: value, yearFrom: undefined, yearTo: undefined });
    }
  };

  const ratingActive = filters.ratingMin > RATING_MIN || filters.ratingMax < RATING_MAX;
  const durationLabelFor = (bucket: DurationBucket): string => {
    switch (bucket) {
      case "short":
        return t.search.durationShort;
      case "medium":
        return t.search.durationMedium;
      case "long":
        return t.search.durationLong;
      case "custom":
        return t.search.durationCustom;
      default:
        return t.common.all;
    }
  };

  const footerTitle =
    total === undefined
      ? t.common.done
      : total === 1
        ? t.search.showResultsOne
        : t.search.showResults.replace("{n}", String(total));

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snapHeight={640}
      title={t.search.filters}
      showClose
      footer={<Button title={footerTitle} onPress={onClose} loading={isFetching && total === undefined} fullWidth />}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Sort — single select. Relevance appears only while a term is active. */}
        <FilterSection label={t.search.filterSort}>
          {(isMovies ? movieSortOptions : seriesSortOptions).map((option) => {
            const selected = (isMovies ? filters.sort : seriesFilters.sort) === option.value;
            return (
              <Chip
                key={option.value}
                label={option.label}
                selected={selected}
                onPress={() =>
                  isMovies
                    ? patch({ sort: option.value as MovieSort })
                    : patchSeries({ sort: option.value as SeriesSort })
                }
              />
            );
          })}
          {/* Honesty hint: this option is the frozen pre-subscription table. */}
          {isMovies && filters.sort === "mostPurchased" && (
            <ThemedText variant="caption" style={styles.hintLine}>
              {t.search.sortMostPurchasedHint}
            </ThemedText>
          )}
        </FilterSection>

        {genreOptions.length > 0 && (
          <FilterSection label={t.search.filterGenre}>
            {genreOptions.map((facet) => {
              const active = isMovies ? filters.genres : seriesFilters.genres;
              return (
                <Chip
                  key={facet.value}
                  label={facet.value}
                  selected={active.includes(facet.value)}
                  onPress={() =>
                    isMovies
                      ? patch({ genres: toggleValue(filters.genres, facet.value) })
                      : patchSeries({ genres: toggleValue(seriesFilters.genres, facet.value) })
                  }
                />
              );
            })}
          </FilterSection>
        )}

        {languageOptions.length > 0 && (
          <FilterSection label={t.search.filterLanguage}>
            {languageOptions.map((facet) => {
              const active = isMovies ? filters.languages : seriesFilters.languages;
              return (
                <Chip
                  key={facet.value}
                  label={facet.value}
                  selected={active.includes(facet.value)}
                  onPress={() =>
                    isMovies
                      ? patch({ languages: toggleValue(filters.languages, facet.value) })
                      : patchSeries({ languages: toggleValue(seriesFilters.languages, facet.value) })
                  }
                />
              );
            })}
          </FilterSection>
        )}

        {/* Cast — async search over GET /actors, movies only. */}
        {isMovies && (
          <FilterSection label={t.search.filterActor} row={false}>
            {filters.actors.length > 0 && (
              <View style={styles.chipRow}>
                {filters.actors.map((actor) => (
                  <Chip
                    key={actor.id}
                    label={actor.name}
                    selected
                    trailingIcon="close"
                    onPress={() => patch({ actors: filters.actors.filter((a) => a.id !== actor.id) })}
                    accessibilityLabel={t.search.removeFilter.replace("{label}", actor.name)}
                  />
                ))}
              </View>
            )}
            <View style={styles.actorSearchBar}>
              <Ionicons name="search" size={16} color={theme.colors.textFaint} />
              <TextInput
                style={styles.actorInput}
                placeholder={t.search.actorSearchPlaceholder}
                placeholderTextColor={theme.colors.textFaint}
                value={actorTerm}
                onChangeText={setActorTerm}
                autoCorrect={false}
              />
              {actorResults.isFetching && <ActivityIndicator size="small" color={theme.colors.primary} />}
            </View>
            {actorTerm.trim().length >= 1 && (
              <View style={styles.chipRow}>
                {(actorResults.data?.items ?? [])
                  .filter((actor) => !filters.actors.some((a) => a.id === actor.id))
                  .map((actor) => (
                    <Chip
                      key={actor.id}
                      label={actor.name}
                      onPress={() => patch({ actors: [...filters.actors, { id: actor.id, name: actor.name }] })}
                    />
                  ))}
                {actorResults.isSuccess && actorResults.data.items.length === 0 && (
                  <ThemedText variant="caption">{t.search.noResults}</ThemedText>
                )}
              </View>
            )}
          </FilterSection>
        )}

        {/* Auto-hidden until the admin backfills these nullable columns. */}
        {isMovies && directorOptions.length > 0 && (
          <FilterSection label={t.search.filterDirector}>
            {directorOptions.map((facet) => (
              <Chip
                key={facet.value}
                label={facet.value}
                selected={filters.directors.includes(facet.value)}
                onPress={() => patch({ directors: toggleValue(filters.directors, facet.value) })}
              />
            ))}
          </FilterSection>
        )}

        {isMovies && countryOptions.length > 0 && (
          <FilterSection label={t.search.filterCountry}>
            {countryOptions.map((facet) => (
              <Chip
                key={facet.value}
                label={facet.value}
                selected={filters.countries.includes(facet.value)}
                onPress={() => patch({ countries: toggleValue(filters.countries, facet.value) })}
              />
            ))}
          </FilterSection>
        )}

        {isMovies && ageRatingOptions.length > 0 && (
          <FilterSection label={t.search.filterAgeRating}>
            {ageRatingOptions.map((facet) => {
              const value = facet.value as AgeRating;
              return (
                <Chip
                  key={facet.value}
                  label={AGE_RATING_LABELS[value] ?? facet.value}
                  selected={filters.ageRatings.includes(value)}
                  onPress={() => patch({ ageRatings: toggleValue(filters.ageRatings, value) })}
                />
              );
            })}
          </FilterSection>
        )}

        {/* Release year — presets, with Custom revealing two single-thumb
            sliders (the kit slider is single-value by law; no native modules). */}
        <FilterSection label={t.search.filterYear} row={false}>
          <View style={styles.chipRow}>
            {yearPresetOptions.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={yearPreset === option.value}
                onPress={() => selectYearPreset(option.value)}
              />
            ))}
          </View>
          {yearPreset === "custom" && (
            <View style={styles.sliderBlock}>
              <SliderRow
                label={String(yearFrom)}
                value={yearFrom}
                min={yearMin}
                max={yearMax}
                step={1}
                onChangeEnd={(value) => setYear({ yearFrom: value, yearTo: Math.max(value, yearTo) })}
              />
              <SliderRow
                label={String(yearTo)}
                value={yearTo}
                min={yearMin}
                max={yearMax}
                step={1}
                onChangeEnd={(value) => setYear({ yearTo: value, yearFrom: Math.min(value, yearFrom) })}
              />
            </View>
          )}
        </FilterSection>

        {/* Rating — the full 0–10 span reads "any" and sends nothing. */}
        {isMovies && (
          <FilterSection label={t.search.filterRating} row={false}>
            <ThemedText variant="caption" tabular>
              {ratingActive ? `${filters.ratingMin} – ${filters.ratingMax}` : t.common.all}
            </ThemedText>
            <View style={styles.sliderBlock}>
              <SliderRow
                label={String(filters.ratingMin)}
                value={filters.ratingMin}
                min={RATING_MIN}
                max={RATING_MAX}
                step={0.5}
                onChangeEnd={(value) =>
                  patch({ ratingMin: value, ratingMax: Math.max(value, filters.ratingMax) })
                }
              />
              <SliderRow
                label={String(filters.ratingMax)}
                value={filters.ratingMax}
                min={RATING_MIN}
                max={RATING_MAX}
                step={0.5}
                onChangeEnd={(value) =>
                  patch({ ratingMax: value, ratingMin: Math.min(value, filters.ratingMin) })
                }
              />
            </View>
          </FilterSection>
        )}

        {/* Duration — buckets are pure presets over the raw minute bounds. */}
        {isMovies && (
          <FilterSection label={t.search.filterDuration} row={false}>
            <SegmentedControl
              scrollable
              options={(["any", "short", "medium", "long", "custom"] as DurationBucket[]).map((bucket) => ({
                value: bucket,
                label: durationLabelFor(bucket),
              }))}
              value={filters.durationBucket}
              onChange={(value) => {
                const bucket = value as DurationBucket;
                patch(
                  bucket === "custom"
                    ? { durationBucket: bucket, durationMin: 0, durationMax: DURATION_SLIDER_MAX }
                    : { durationBucket: bucket, durationMin: undefined, durationMax: undefined },
                );
              }}
            />
            {filters.durationBucket === "custom" && (
              <View style={styles.sliderBlock}>
                <SliderRow
                  label={`${filters.durationMin ?? 0}`}
                  value={filters.durationMin ?? 0}
                  min={0}
                  max={DURATION_SLIDER_MAX}
                  step={5}
                  onChangeEnd={(value) =>
                    patch({
                      durationMin: value,
                      durationMax: Math.max(value, filters.durationMax ?? DURATION_SLIDER_MAX),
                    })
                  }
                />
                <SliderRow
                  label={
                    (filters.durationMax ?? DURATION_SLIDER_MAX) >= DURATION_SLIDER_MAX
                      ? `${DURATION_SLIDER_MAX}+`
                      : `${filters.durationMax}`
                  }
                  value={filters.durationMax ?? DURATION_SLIDER_MAX}
                  min={0}
                  max={DURATION_SLIDER_MAX}
                  step={5}
                  onChangeEnd={(value) =>
                    patch({ durationMax: value, durationMin: Math.min(value, filters.durationMin ?? 0) })
                  }
                />
              </View>
            )}
          </FilterSection>
        )}

        <FilterSection label={t.search.filterAccess}>
          {(
            [
              { value: "ALL", label: t.search.accessAll, tone: undefined, icon: undefined },
              { value: "FREE", label: t.search.accessFree, tone: "finance" as const, icon: undefined },
              {
                value: "SUBSCRIPTION",
                label: t.search.accessSubscription,
                tone: "premium" as const,
                icon: "diamond" as const,
              },
            ] as const
          ).map((option) => {
            const current = isMovies ? filters.access : seriesFilters.access;
            return (
              <Chip
                key={option.value}
                label={option.label}
                tone={option.tone}
                icon={option.icon}
                selected={current === option.value}
                onPress={() =>
                  isMovies ? patch({ access: option.value }) : patchSeries({ access: option.value })
                }
              />
            );
          })}
        </FilterSection>
      </ScrollView>
    </BottomSheet>
  );
}

/** One labelled block inside the sheet — chips wrap by default. */
function FilterSection({ label, children, row = true }: { label: string; children: ReactNode; row?: boolean }) {
  return (
    <View style={styles.section}>
      <ThemedText variant="overline">{label.toUpperCase()}</ThemedText>
      {row ? <View style={styles.chipRow}>{children}</View> : <View style={styles.column}>{children}</View>}
    </View>
  );
}

/** A value readout beside a single-thumb slider — commit-on-release only. */
function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChangeEnd,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChangeEnd: (value: number) => void;
}) {
  return (
    <View style={styles.sliderRow}>
      <ThemedText variant="caption" tabular style={styles.sliderValue}>
        {label}
      </ThemedText>
      <Slider value={value} min={min} max={max} step={step} onChangeEnd={onChangeEnd} style={styles.slider} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: theme.spacing.sm, marginBottom: theme.spacing.lg },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  column: { gap: theme.spacing.sm },
  hintLine: { width: "100%" },
  actorSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    minHeight: theme.layout.minTouch,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
  },
  actorInput: {
    flex: 1,
    color: theme.colors.text,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: theme.font.regular,
  },
  sliderBlock: { gap: theme.spacing.xs },
  sliderRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  sliderValue: { width: 44, textAlign: "right" },
  slider: { flex: 1 },
});
