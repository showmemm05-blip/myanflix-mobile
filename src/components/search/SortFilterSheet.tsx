import { useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, View, useWindowDimensions } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { ThemedText } from "@/components/ui/ThemedText";
import { Chip } from "@/components/common/Chip";
import { Skeleton } from "@/components/common/Skeleton";
import {
  DURATION_BUCKETS,
  RATING_FLOORS,
  YEAR_PRESETS,
  clearMovieRefinements,
  clearSeriesRefinements,
  durationBucketLabel,
  movieFiltersToQuery,
  movieSortChoices,
  ratingFloorLabel,
  seriesFiltersToQuery,
  seriesSortChoices,
  trendingFromYear,
  yearPresetLabel,
  type MovieFilters,
  type SeriesFilters,
  type YearPreset,
} from "@/components/search/filters";
import { useMovieFacets, useMovies } from "@/hooks/useMovies";
import { useSeriesFacets, useSeriesList } from "@/hooks/useSeries";
import { useSearchFiltersStore } from "@/store/searchFiltersStore";
import { useLanguage } from "@/localization/LanguageProvider";
import type { TranslationShape } from "@/localization/translations";
import { theme } from "@/theme";
import type { FacetValue } from "@/types/movie";

interface Props {
  visible: boolean;
  onClose: () => void;
  kind: "movies" | "series";
  /**
   * The committed search term (the search screen) — part of the count, and
   * what makes "Relevance" honest. "" on the Media page.
   */
  term: string;
  /**
   * "All filters": the full SearchFilters page (several genres or languages
   * at once). The sheet's choices are applied first, so nothing picked here
   * is lost on the way. Omitted, the link is not drawn.
   */
  onOpenAllFilters?: () => void;
  /**
   * The server's total is this page's count. False while the page narrows
   * the list further on the client (a Series category on the Media page —
   * GET /series has no category filter): the total would count series
   * outside it, so no count is asked and the button says "Show results".
   * Defaults to true.
   */
  countable?: boolean;
}

/**
 * THE Sort & filter control of the Media page and the search screen — one
 * small sheet, Netflix-simple, over the shared filter store
 * (searchFiltersStore):
 *
 *   Sort by     Movies: Popular · Trending now · New releases · Top rated ·
 *               Recently added · A–Z (Relevance first while a term is
 *               searched). Series: Recently added · Newest · Oldest · A–Z
 *               — series have no popularity or rating sort.
 *   Year        the presets; while Trending now is the sort it owns the
 *               years, so a line says which instead.
 *   Language    "Any" + the catalogue's own languages (its facets).
 *   Free only   on / off.
 *   More filters  movies only, folded: Rating and Length.
 *
 * It edits a DRAFT of the REFINEMENTS — never the genre or category the page
 * is showing (the Categories overlay picks those). "Show N results" (the
 * backend total for the draft, the same list query at limit 1) applies it;
 * Reset puts the draft back to the defaults; closing throws it away.
 */
export function SortFilterSheet(props: Props) {
  return props.kind === "series" ? <SeriesSheet {...props} /> : <MovieSheet {...props} />;
}

function MovieSheet({ visible, onClose, term, onOpenAllFilters }: Props) {
  const { t } = useLanguage();
  const stored = useSearchFiltersStore((state) => state.movieFilters);
  const setStored = useSearchFiltersStore((state) => state.setMovieFilters);
  const [draft, setDraft] = useState<MovieFilters>(stored);
  const [moreOpen, setMoreOpen] = useState(false);
  // Every opening starts from what is applied, never from an abandoned draft —
  // with "More filters" unfolded when something in it is already on.
  useEffect(() => {
    if (!visible) return;
    setDraft(stored);
    setMoreOpen(stored.ratingMin > 0 || stored.durationBucket !== "any");
  }, [visible, stored]);
  const patch = (partial: Partial<MovieFilters>) => setDraft((current) => ({ ...current, ...partial }));

  const facetsQuery = useMovieFacets();
  const countQuery = useMovies(
    { search: term || undefined, ...movieFiltersToQuery(draft), limit: 1 },
    { enabled: visible },
  );
  const total = countQuery.isPlaceholderData ? undefined : countQuery.data?.total;

  const apply = () => {
    setStored(draft);
    onClose();
  };
  const openAll = onOpenAllFilters
    ? () => {
        setStored(draft);
        onClose();
        onOpenAllFilters();
      }
    : undefined;
  const moreCount = (draft.ratingMin > 0 ? 1 : 0) + (draft.durationBucket !== "any" ? 1 : 0);
  const trending = draft.sort === "trending";

  return (
    <SheetFrame
      visible={visible}
      onClose={onClose}
      total={total}
      counting={countQuery.isFetching && total === undefined}
      onApply={apply}
      onReset={() => setDraft((current) => clearMovieRefinements(current))}
    >
      <Group title={t.search.filterSort}>
        <ChoiceChips
          options={movieSortChoices(t, term.length > 0, { current: draft.sort })}
          value={draft.sort}
          // Trending now owns the years: picking it lets go of a year preset.
          onChange={(sort) => patch(sort === "trending" ? { sort, yearPreset: "any" } : { sort })}
          groupLabel={t.search.filterSort}
        />
      </Group>

      <YearGroup t={t} trending={trending} value={draft.yearPreset} onChange={(yearPreset) => patch({ yearPreset })} />

      <LanguageGroup
        t={t}
        options={facetsQuery.data?.languages}
        loading={facetsQuery.isLoading}
        selected={draft.languages}
        onChange={(languages) => patch({ languages })}
      />

      <FreeOnlyRow t={t} value={draft.freeOnly} onChange={(freeOnly) => patch({ freeOnly })} />

      <Pressable
        onPress={() => setMoreOpen((open) => !open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: moreOpen }}
        accessibilityLabel={moreCount > 0 ? `${t.search.moreFilters}, ${moreCount}` : t.search.moreFilters}
        style={({ pressed }) => [styles.disclosure, pressed && styles.pressed]}
      >
        <ThemedText weight="bold" color={theme.colors.text} style={styles.flexShrink}>
          {moreCount > 0 ? `${t.search.moreFilters} · ${moreCount}` : t.search.moreFilters}
        </ThemedText>
        <Ionicons name={moreOpen ? "chevron-up" : "chevron-down"} size={18} color={theme.colors.textMuted} />
      </Pressable>
      {moreOpen ? (
        <View>
          <Group title={t.search.filterRating}>
            <ChoiceChips
              options={RATING_FLOORS.map((floor) => ({
                value: String(floor),
                label: ratingFloorLabel(t, floor),
                accessibilityLabel:
                  floor === 0 ? t.search.ratingAnyA11y : t.search.ratingFloorA11y.replace("{n}", String(floor)),
              }))}
              value={String(draft.ratingMin)}
              onChange={(value) => patch({ ratingMin: Number(value) as MovieFilters["ratingMin"] })}
              groupLabel={t.search.filterRating}
            />
          </Group>
          <Group title={t.search.filterDuration}>
            <ChoiceChips
              options={DURATION_BUCKETS.map((bucket) => ({ value: bucket, label: durationBucketLabel(t, bucket) }))}
              value={draft.durationBucket}
              onChange={(durationBucket) => patch({ durationBucket })}
              groupLabel={t.search.filterDuration}
            />
          </Group>
        </View>
      ) : null}

      {openAll ? <AllFiltersLink t={t} onPress={openAll} /> : null}
    </SheetFrame>
  );
}

function SeriesSheet({ visible, onClose, term, onOpenAllFilters, countable = true }: Props) {
  const { t } = useLanguage();
  const stored = useSearchFiltersStore((state) => state.seriesFilters);
  const setStored = useSearchFiltersStore((state) => state.setSeriesFilters);
  const [draft, setDraft] = useState<SeriesFilters>(stored);
  useEffect(() => {
    if (visible) setDraft(stored);
  }, [visible, stored]);
  const patch = (partial: Partial<SeriesFilters>) => setDraft((current) => ({ ...current, ...partial }));

  const facetsQuery = useSeriesFacets();
  const countQuery = useSeriesList(
    { search: term || undefined, ...seriesFiltersToQuery(draft), limit: 1 },
    { enabled: visible && countable },
  );
  // useSeriesList holds no placeholder: while a new count loads there is none.
  const total = !countable || countQuery.isFetching ? undefined : countQuery.data?.total;

  const apply = () => {
    setStored(draft);
    onClose();
  };
  const openAll = onOpenAllFilters
    ? () => {
        setStored(draft);
        onClose();
        onOpenAllFilters();
      }
    : undefined;

  return (
    <SheetFrame
      visible={visible}
      onClose={onClose}
      total={total}
      counting={countable && countQuery.isFetching}
      onApply={apply}
      onReset={() => setDraft((current) => clearSeriesRefinements(current))}
    >
      <Group title={t.search.filterSort}>
        <ChoiceChips
          options={seriesSortChoices(t, term.length > 0)}
          value={draft.sort}
          onChange={(sort) => patch({ sort })}
          groupLabel={t.search.filterSort}
        />
      </Group>

      <YearGroup t={t} trending={false} value={draft.yearPreset} onChange={(yearPreset) => patch({ yearPreset })} />

      <LanguageGroup
        t={t}
        options={facetsQuery.data?.languages}
        loading={facetsQuery.isLoading}
        selected={draft.languages}
        onChange={(languages) => patch({ languages })}
      />

      <FreeOnlyRow t={t} value={draft.freeOnly} onChange={(freeOnly) => patch({ freeOnly })} />

      {openAll ? <AllFiltersLink t={t} onPress={openAll} /> : null}
    </SheetFrame>
  );
}

/* ------------------------------------------------------------------ */
/* The shared frame and groups.                                        */
/* ------------------------------------------------------------------ */

/**
 * The sheet itself: its own header (the grabber, then a title that wraps —
 * the Burmese "Sort & filter" at 2× text would not fit one line beside the
 * close button), the scrolling groups, and the Reset / "Show N results"
 * footer, which wraps to two rows on a narrow phone at a large text size.
 */
function SheetFrame({
  visible,
  onClose,
  total,
  counting,
  onApply,
  onReset,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  total: number | undefined;
  counting: boolean;
  onApply: () => void;
  onReset: () => void;
  children: ReactNode;
}) {
  const { t } = useLanguage();
  const { height } = useWindowDimensions();
  const showLabel =
    total === undefined
      ? t.search.showResultsUnknown
      : total === 1
        ? t.search.showResultsOne
        : t.search.showResults.replace("{n}", String(total));

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snapHeight={height * 0.86}
      header={
        <View style={styles.header}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <ThemedText variant="section" accessibilityRole="header" style={styles.headerTitle}>
              {t.search.sortAndFilter}
            </ThemedText>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t.common.close}
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={18} color={theme.colors.text} />
            </Pressable>
          </View>
        </View>
      }
      footer={
        <View style={styles.footer}>
          <Button title={t.search.reset} variant="secondary" size="lg" onPress={onReset} style={styles.reset} labelLines={2} />
          <Button
            title={showLabel}
            size="lg"
            onPress={onApply}
            style={styles.apply}
            labelLines={2}
            accessibilityLabel={counting ? `${t.search.showResultsUnknown}, ${t.common.loading}` : showLabel}
          />
        </View>
      }
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        {children}
      </ScrollView>
    </BottomSheet>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <View style={styles.groupHeader}>
        <ThemedText variant="caption" weight="bold" color={theme.colors.textMuted} accessibilityRole="header" style={styles.flexShrink}>
          {title}
        </ThemedText>
        {note ? (
          <ThemedText variant="caption" weight="regular" color={theme.colors.textFaint}>
            {note}
          </ThemedText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** A single-select chip row that wraps; each chip is spoken as a radio. */
function ChoiceChips<V extends string>({
  options,
  value,
  onChange,
  groupLabel,
}: {
  options: { value: V; label: string; accessibilityLabel?: string }[];
  value: V;
  onChange: (next: V) => void;
  groupLabel: string;
}) {
  return (
    <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={groupLabel}>
      {options.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          labelLines={2}
          style={styles.chipMax}
          selected={option.value === value}
          onPress={() => onChange(option.value)}
          accessibilityLabel={option.accessibilityLabel ?? option.label}
        />
      ))}
    </View>
  );
}

function YearGroup({
  t,
  trending,
  value,
  onChange,
}: {
  t: TranslationShape;
  trending: boolean;
  value: YearPreset;
  onChange: (next: YearPreset) => void;
}) {
  return (
    <Group title={t.search.filterYear}>
      {trending ? (
        <ThemedText variant="caption" weight="regular" color={theme.colors.textFaint}>
          {t.search.trendingYearNote.replace("{year}", String(trendingFromYear()))}
        </ThemedText>
      ) : (
        <ChoiceChips
          options={YEAR_PRESETS.map((preset) => ({ value: preset, label: yearPresetLabel(t, preset) }))}
          value={value}
          onChange={onChange}
          groupLabel={t.search.filterYear}
        />
      )}
    </Group>
  );
}

/**
 * The catalogue's languages, one at a time ("Any" clears). Several picked on
 * the full Filters page all show selected; a tap narrows to the one tapped.
 * No languages in the catalogue: no group.
 */
function LanguageGroup({
  t,
  options,
  loading,
  selected,
  onChange,
}: {
  t: TranslationShape;
  options: FacetValue[] | undefined;
  loading: boolean;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  if (loading && !options) {
    return (
      <Group title={t.search.filterLanguage}>
        <View style={styles.chips} accessible accessibilityRole="progressbar" accessibilityLabel={t.common.loading}>
          {[64, 88, 76].map((width, i) => (
            <Skeleton key={i} width={width} height={34} radius="xl" />
          ))}
        </View>
      </Group>
    );
  }
  if (!options || options.length === 0) return null;
  return (
    <Group title={t.search.filterLanguage}>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t.search.filterLanguage}>
        <Chip
          label={t.search.facetAny}
          selected={selected.length === 0}
          onPress={() => onChange([])}
          accessibilityLabel={`${t.search.filterLanguage}, ${t.search.facetAny}`}
        />
        {options.map((facet) => (
          <Chip
            key={facet.value}
            label={facet.value}
            labelLines={2}
            style={styles.chipMax}
            selected={selected.includes(facet.value)}
            onPress={() => onChange([facet.value])}
          />
        ))}
      </View>
    </Group>
  );
}

/** Free only — the whole row toggles; spoken as one switch. */
function FreeOnlyRow({ t, value, onChange }: { t: TranslationShape; value: boolean; onChange: (next: boolean) => void }) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={`${t.search.freeOnly}, ${t.hub.freeSubtitle}`}
      style={({ pressed }) => [styles.switchRow, pressed && styles.pressed]}
    >
      <View style={styles.switchText}>
        <ThemedText weight="bold" color={theme.colors.text}>
          {t.search.freeOnly}
        </ThemedText>
        <ThemedText variant="caption" weight="regular" color={theme.colors.textFaint}>
          {t.hub.freeSubtitle}
        </ThemedText>
      </View>
      {/* Drawn only: the row is the control (one target, one toggle per tap). */}
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Switch
          value={value}
          trackColor={{ false: theme.colors.tonalStrong, true: theme.colors.primary }}
          thumbColor={theme.colors.play}
          ios_backgroundColor={theme.colors.tonalStrong}
        />
      </View>
    </Pressable>
  );
}

function AllFiltersLink({ t, onPress }: { t: TranslationShape; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t.search.allFiltersA11y}
      style={({ pressed }) => [styles.allFilters, pressed && styles.pressed]}
    >
      <ThemedText variant="muted" weight="extrabold" color={theme.colors.link} style={styles.flexShrink}>
        {t.search.allFilters}
      </ThemedText>
      <Ionicons name="chevron-forward" size={16} color={theme.colors.link} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.sm },
  /** BottomSheet's grabber: 36×4, white at 24%. */
  handle: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: theme.colors.grabber },
  headerRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, minHeight: theme.layout.minTouch, marginTop: 12 },
  headerTitle: { flex: 1 },
  close: {
    width: theme.layout.minTouch,
    height: theme.layout.minTouch,
    borderRadius: theme.layout.minTouch / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.tonalSoft,
  },
  body: { paddingBottom: theme.spacing.lg },
  group: { marginTop: theme.spacing.lg, gap: 10 },
  groupHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  /** The chips wrap; 14pt between rows keeps their 44pt targets apart. */
  chips: { flexDirection: "row", flexWrap: "wrap", columnGap: theme.spacing.sm, rowGap: 14 },
  /** A long Burmese label wraps inside the row instead of running off it. */
  chipMax: { maxWidth: "100%" },
  flexShrink: { flexShrink: 1 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    minHeight: 56,
    marginTop: theme.spacing.lg,
  },
  switchText: { flex: 1, gap: 2 },
  disclosure: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    minHeight: theme.layout.minTouch,
    marginTop: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
  },
  allFilters: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    minHeight: theme.layout.minTouch,
    marginTop: theme.spacing.lg,
  },
  pressed: { opacity: 0.7 },
  /** CategoryFilterSheet's footer: wraps to two rows when Reset outgrows ~40% of it. */
  footer: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingTop: theme.spacing.md },
  reset: { flexGrow: 1 },
  apply: { flexGrow: 1000, flexShrink: 1, flexBasis: "60%" },
});
