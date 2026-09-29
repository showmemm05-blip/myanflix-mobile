import { useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Button } from "@/components/ui/Button";
import { ThemedText } from "@/components/ui/ThemedText";
import { TopBar } from "@/components/layout/TopBar";
import { Chip } from "@/components/common/Chip";
import {
  DURATION_BUCKETS,
  RATING_FLOORS,
  YEAR_PRESETS,
  createMovieFilters,
  createSeriesFilters,
  durationBucketLabel,
  movieFiltersToQuery,
  movieSortOptions,
  ratingFloorLabel,
  seriesFiltersToQuery,
  seriesSortOptions,
  yearPresetLabel,
  type MovieFilters,
  type SeriesFilters,
} from "@/components/search/filters";
import { useMovieFacets, useMovies } from "@/hooks/useMovies";
import { useSeriesFacets, useSeriesList } from "@/hooks/useSeries";
import { useSearchFiltersStore } from "@/store/searchFiltersStore";
import { useLanguage } from "@/localization/LanguageProvider";
import type { TranslationShape } from "@/localization/translations";
import { theme } from "@/theme";
import type { SearchStackParamList } from "@/navigation/types";
import type { FacetValue } from "@/types/movie";

type Props = NativeStackScreenProps<SearchStackParamList, "SearchFilters">;

/**
 * The Media tab's ONE filter surface — a full page, one scroll of chip rows,
 * no sliders, no nested search. It edits a DRAFT copy of the shared store:
 * nothing the user taps here reaches the results list until "Show N results"
 * writes the draft back and pops the page, and Reset only resets the draft.
 * The count on that button is the backend total for the draft plus the
 * committed term — the same list query the results use, at `limit: 1`.
 *
 * The two tabs' editors are separate components rather than one with a
 * `tab` switch: MovieFilters and SeriesFilters are different shapes with
 * different sort types, and keeping each draft concretely typed is what lets
 * the chips write to it without a cast.
 */
export function SearchFiltersScreen({ route, navigation }: Props) {
  const { tab, term } = route.params;
  const { t } = useLanguage();
  const close = () => navigation.goBack();

  return (
    <View style={styles.container}>
      <TopBar title={t.search.filters} onBack={close} backAccessibilityLabel={t.common.back} />
      {tab === "series" ? (
        <SeriesFiltersEditor term={term} onDone={close} />
      ) : (
        <MovieFiltersEditor term={term} onDone={close} />
      )}
    </View>
  );
}

interface EditorProps {
  /** The committed search term — in the count query, and what makes "Relevance" honest. */
  term: string;
  onDone: () => void;
}

function MovieFiltersEditor({ term, onDone }: EditorProps) {
  const { t } = useLanguage();
  const stored = useSearchFiltersStore((state) => state.movieFilters);
  const setMovieFilters = useSearchFiltersStore((state) => state.setMovieFilters);
  const [draft, setDraft] = useState<MovieFilters>(() => ({ ...stored }));
  const patch = (partial: Partial<MovieFilters>) => setDraft((current) => ({ ...current, ...partial }));

  const facets = useMovieFacets();
  const countQuery = useMovies({ search: term || undefined, ...movieFiltersToQuery(draft), limit: 1 });

  const apply = () => {
    setMovieFilters(draft);
    onDone();
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FilterSection label={t.search.filterSort}>
          {movieSortOptions(t, term.length > 0).map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={draft.sort === option.value}
              onPress={() => patch({ sort: option.value })}
            />
          ))}
          {/* Honesty hint: this option is the frozen pre-subscription table. */}
          {draft.sort === "mostPurchased" && (
            <ThemedText variant="caption" style={styles.hintLine}>
              {t.search.sortMostPurchasedHint}
            </ThemedText>
          )}
        </FilterSection>

        <FacetSection
          label={t.search.filterGenre}
          options={facets.data?.genres}
          selected={draft.genres}
          onChange={(genres) => patch({ genres })}
        />
        <FacetSection
          label={t.search.filterLanguage}
          options={facets.data?.languages}
          selected={draft.languages}
          onChange={(languages) => patch({ languages })}
        />

        <FilterSection label={t.search.filterYear}>
          {YEAR_PRESETS.map((preset) => (
            <Chip
              key={preset}
              label={yearPresetLabel(t, preset)}
              selected={draft.yearPreset === preset}
              onPress={() => patch({ yearPreset: preset })}
            />
          ))}
        </FilterSection>

        <FilterSection label={t.search.filterDuration}>
          {DURATION_BUCKETS.map((bucket) => (
            <Chip
              key={bucket}
              label={durationBucketLabel(t, bucket)}
              selected={draft.durationBucket === bucket}
              onPress={() => patch({ durationBucket: bucket })}
            />
          ))}
        </FilterSection>

        <FilterSection label={t.search.filterRating}>
          {RATING_FLOORS.map((floor) => (
            <Chip
              key={floor}
              label={ratingFloorLabel(t, floor)}
              selected={draft.ratingMin === floor}
              onPress={() => patch({ ratingMin: floor })}
            />
          ))}
        </FilterSection>
      </ScrollView>

      <FiltersFooter
        t={t}
        total={countQuery.data?.total}
        counting={countQuery.isLoading}
        onReset={() => setDraft(createMovieFilters())}
        onApply={apply}
      />
    </>
  );
}

function SeriesFiltersEditor({ term, onDone }: EditorProps) {
  const { t } = useLanguage();
  const stored = useSearchFiltersStore((state) => state.seriesFilters);
  const setSeriesFilters = useSearchFiltersStore((state) => state.setSeriesFilters);
  const [draft, setDraft] = useState<SeriesFilters>(() => ({ ...stored }));
  const patch = (partial: Partial<SeriesFilters>) => setDraft((current) => ({ ...current, ...partial }));

  const facets = useSeriesFacets();
  const countQuery = useSeriesList({ search: term || undefined, ...seriesFiltersToQuery(draft), limit: 1 });

  const apply = () => {
    setSeriesFilters(draft);
    onDone();
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FilterSection label={t.search.filterSort}>
          {seriesSortOptions(t, term.length > 0).map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={draft.sort === option.value}
              onPress={() => patch({ sort: option.value })}
            />
          ))}
        </FilterSection>

        <FacetSection
          label={t.search.filterGenre}
          options={facets.data?.genres}
          selected={draft.genres}
          onChange={(genres) => patch({ genres })}
        />
        <FacetSection
          label={t.search.filterLanguage}
          options={facets.data?.languages}
          selected={draft.languages}
          onChange={(languages) => patch({ languages })}
        />

        <FilterSection label={t.search.filterYear}>
          {YEAR_PRESETS.map((preset) => (
            <Chip
              key={preset}
              label={yearPresetLabel(t, preset)}
              selected={draft.yearPreset === preset}
              onPress={() => patch({ yearPreset: preset })}
            />
          ))}
        </FilterSection>
      </ScrollView>

      <FiltersFooter
        t={t}
        total={countQuery.data?.total}
        counting={countQuery.isLoading}
        onReset={() => setDraft(createSeriesFilters())}
        onApply={apply}
      />
    </>
  );
}

/**
 * A multi-select facet row. Options come from GET /movies/facets (or
 * /series/facets), so only values that exist in the catalogue are offered,
 * and a facet with no values hides its whole section rather than showing an
 * empty label.
 */
function FacetSection({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: FacetValue[] | undefined;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  if (!options || options.length === 0) return null;
  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  return (
    <FilterSection label={label}>
      {options.map((facet) => (
        <Chip
          key={facet.value}
          label={facet.value}
          selected={selected.includes(facet.value)}
          onPress={() => toggle(facet.value)}
        />
      ))}
    </FilterSection>
  );
}

/** One labelled block — an overline over a wrapping row of chips. */
function FilterSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText variant="overline">{label.toUpperCase()}</ThemedText>
      <View style={styles.chipRow}>{children}</View>
    </View>
  );
}

/**
 * The sticky footer: Reset on the left, "Show N results" on the right. It
 * sits BELOW the scroll in the layout (not over it), so the last chip row can
 * always be scrolled clear of it. This route is pushed inside the Search tab,
 * where the floating glass TabBar (absolute, over every nested screen) covers
 * the bottom band, so the footer pads by theme.layout.tabBarClearance like
 * every other pushed screen — not by the safe-area inset alone, which would
 * leave both buttons under the bar.
 */
function FiltersFooter({
  t,
  total,
  counting,
  onReset,
  onApply,
}: {
  t: TranslationShape;
  total: number | undefined;
  counting: boolean;
  onReset: () => void;
  onApply: () => void;
}) {
  // `isLoading`, never `isFetching`: every chip tap starts a NEW count, and
  // disabling the primary button on each refetch made it dead on a slow link.
  // The stale count stays on the label for the moment it takes to refresh —
  // applying the draft is what the button does, the number is only a preview.
  const title =
    total === undefined
      ? t.search.showResultsUnknown
      : total === 1
        ? t.search.showResultsOne
        : t.search.showResults.replace("{n}", String(total));
  return (
    <View style={styles.footer}>
      <Button title={t.search.reset} onPress={onReset} variant="soft" icon="refresh-outline" />
      <Button title={title} onPress={onApply} loading={counting} style={styles.apply} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  section: { gap: theme.spacing.sm, marginBottom: theme.spacing.lg },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  hintLine: { width: "100%" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.layout.tabBarClearance,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  apply: { flex: 1 },
});
