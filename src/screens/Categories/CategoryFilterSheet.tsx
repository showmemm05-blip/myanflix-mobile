import { useEffect, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { ThemedText } from "@/components/ui/ThemedText";
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
import { useMovies } from "@/hooks/useMovies";
import { useSeriesList } from "@/hooks/useSeries";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

type Tab = "movies" | "series";

interface Props {
  visible: boolean;
  tab: Tab;
  categoryId: string;
  movieFilters: MovieFilters;
  seriesFilters: SeriesFilters;
  onApplyMovies: (filters: MovieFilters) => void;
  onApplySeries: (filters: SeriesFilters) => void;
  onClose: () => void;
}

/**
 * The category page's Filters sheet (CategoryDetail.dc.html, "sheet"): Sort
 * by, Year, and — movies only — Rating and Duration, as chip rows over the
 * Search screen's own filter vocabulary (components/search/filters), so a
 * preset means the same query params everywhere.
 *
 * It edits a DRAFT. "Show {n} results" commits it; closing throws it away.
 * {n} is the backend total for the draft inside this category (the same list
 * query at limit 1, as SearchFilters counts) — for movies and, since GET
 * /series learnt `categoryId`, for series too. Until it answers: "Show results".
 */
export function CategoryFilterSheet({
  visible,
  tab,
  categoryId,
  movieFilters,
  seriesFilters,
  onApplyMovies,
  onApplySeries,
  onClose,
}: Props) {
  const { t } = useLanguage();
  const { height } = useWindowDimensions();
  const [movieDraft, setMovieDraft] = useState<MovieFilters>(movieFilters);
  const [seriesDraft, setSeriesDraft] = useState<SeriesFilters>(seriesFilters);

  // Every opening starts from what is applied, never from an abandoned draft.
  useEffect(() => {
    if (visible) {
      setMovieDraft(movieFilters);
      setSeriesDraft(seriesFilters);
    }
  }, [visible, movieFilters, seriesFilters]);

  const isMovies = tab === "movies";
  const countQuery = useMovies(
    { categoryId, ...movieFiltersToQuery(movieDraft), limit: 1 },
    { enabled: visible && isMovies },
  );
  const seriesCountQuery = useSeriesList(
    { categoryId, ...seriesFiltersToQuery(seriesDraft), limit: 1 },
    { enabled: visible && !isMovies },
  );
  const total = isMovies
    ? countQuery.isPlaceholderData
      ? undefined
      : countQuery.data?.total
    : seriesCountQuery.data?.total;
  const showLabel =
    total === undefined
      ? t.search.showResultsUnknown
      : total === 1
        ? t.search.showResultsOne
        : t.search.showResults.replace("{n}", String(total));

  const apply = () => {
    if (isMovies) onApplyMovies(movieDraft);
    else onApplySeries(seriesDraft);
    onClose();
  };
  const reset = () => {
    if (isMovies) setMovieDraft(createMovieFilters());
    else setSeriesDraft(createSeriesFilters());
  };

  const sortOptions = isMovies ? movieSortOptions(t, false) : seriesSortOptions(t, false);
  const activeSort = isMovies ? movieDraft.sort : seriesDraft.sort;
  const activeYear = isMovies ? movieDraft.yearPreset : seriesDraft.yearPreset;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t.search.filters}
      showClose
      snapHeight={height * 0.86}
      footer={
        <View style={styles.footer}>
          {/* Two lines each: at 2.0 text on a 320pt phone the Burmese "Reset"
              outgrows even its own full-width row. */}
          <Button
            title={t.search.reset}
            variant="secondary"
            size="lg"
            onPress={reset}
            style={styles.reset}
            labelLines={2}
          />
          <Button title={showLabel} size="lg" onPress={apply} style={styles.apply} labelLines={2} />
        </View>
      }
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <Group title={t.search.filterSort}>
          {sortOptions.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              labelLines={2}
              style={styles.chipMax}
              selected={option.value === activeSort}
              onPress={() =>
                isMovies
                  ? setMovieDraft((d) => ({ ...d, sort: option.value as MovieFilters["sort"] }))
                  : setSeriesDraft((d) => ({ ...d, sort: option.value as SeriesFilters["sort"] }))
              }
            />
          ))}
        </Group>
        {isMovies && (
          <ThemedText variant="label" weight="regular" color={theme.colors.textFaint} style={styles.hint}>
            {`${t.search.sortMostPurchased}: ${t.search.sortMostPurchasedHint}`}
          </ThemedText>
        )}

        <Group title={t.search.filterYear}>
          {YEAR_PRESETS.map((preset) => (
            <Chip
              key={preset}
              label={yearPresetLabel(t, preset)}
              labelLines={2}
              style={styles.chipMax}
              selected={preset === activeYear}
              onPress={() =>
                isMovies
                  ? setMovieDraft((d) => ({ ...d, yearPreset: preset }))
                  : setSeriesDraft((d) => ({ ...d, yearPreset: preset }))
              }
            />
          ))}
        </Group>

        {isMovies && (
          <>
            <Group title={t.search.filterRating}>
              {RATING_FLOORS.map((floor) => (
                <Chip
                  key={floor}
                  label={ratingFloorLabel(t, floor)}
                  selected={floor === movieDraft.ratingMin}
                  onPress={() => setMovieDraft((d) => ({ ...d, ratingMin: floor }))}
                />
              ))}
            </Group>
            <Group title={t.search.filterDuration}>
              {DURATION_BUCKETS.map((bucket) => (
                <Chip
                  key={bucket}
                  label={durationBucketLabel(t, bucket)}
                  labelLines={2}
                  style={styles.chipMax}
                  selected={bucket === movieDraft.durationBucket}
                  onPress={() => setMovieDraft((d) => ({ ...d, durationBucket: bucket }))}
                />
              ))}
            </Group>
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <ThemedText variant="caption" weight="bold" color={theme.colors.textMuted} accessibilityRole="header">
        {title}
      </ThemedText>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: theme.spacing.lg },
  group: { marginTop: theme.spacing.lg, gap: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  /** A long Burmese label wraps inside the row instead of running off it. */
  chipMax: { maxWidth: "100%" },
  hint: { marginTop: theme.spacing.sm },
  /**
   * The board's row — Reset at its natural width, the commit filling the
   * rest — WRAPS when Reset is wider than ~40% of the row (the long Burmese
   * "Reset", a 320pt phone, large text). Each button then gets a full-width
   * row of its own, the commit at the bottom, so its result count is not
   * ellipsized away. The commit's basis is a fixed share, not its own label,
   * so a count that changes as chips are tapped never flips the layout.
   * (`flex: 1` sets flexBasis 0, which can never wrap.)
   */
  footer: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingTop: theme.spacing.md },
  reset: { flexGrow: 1 },
  apply: { flexGrow: 1000, flexShrink: 1, flexBasis: "60%" },
});
