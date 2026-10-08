import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedRef,
  useAnimatedStyle,
  useReducedMotion,
  useScrollOffset,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { FadeInView } from "@/components/ui/FadeInView";
import { TopBar } from "@/components/layout/TopBar";
import {
  GLASS_BAR_ROW,
  GlassBarBackground,
  GlassTarget,
  useGlassBar,
} from "@/components/layout/GlassBar";
import { Chip } from "@/components/common/Chip";
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
  type RatingFloor,
  type SeriesFilters,
  type YearPreset,
} from "@/components/search/filters";
import { useCategories } from "@/hooks/useCategories";
import { useMovieFacets, useMovies } from "@/hooks/useMovies";
import { useSeriesFacets, useSeriesList } from "@/hooks/useSeries";
import { useDockClearance } from "@/hooks/useDockClearance";
import { useSearchFiltersStore } from "@/store/searchFiltersStore";
import { useLanguage } from "@/localization/LanguageProvider";
import type { TranslationShape } from "@/localization/translations";
import { theme, withAlpha } from "@/theme";
import type { SearchStackParamList } from "@/navigation/types";
import type { FacetValue } from "@/types/movie";

type Props = NativeStackScreenProps<SearchStackParamList, "SearchFilters">;

/** The fade that lets the last section slide under the footer. */
const FOOTER_FADE = 32;
/** 20pt under the bar + the large title block's 8pt = the board's 28pt under the context line. */
const CONTENT_TOP = 20;
/**
 * The floating bar's height under the inset before it is measured: the
 * control row and the large title block (title + context line).
 */
const BAR_ROWS_ESTIMATE = GLASS_BAR_ROW + 80;
const FADE_COLORS = [withAlpha(theme.colors.background, 0), theme.colors.background] as const;

/**
 * The Media tab's ONE filter surface — a full page. It edits a DRAFT copy of
 * the shared store: nothing the user taps here reaches the results until
 * "Show N results" writes the draft back and pops the page, and Reset (now in
 * the top bar, the Marquee board) only resets the draft. The count on that
 * button is the backend total for the draft plus the committed term — the
 * same list query the results use, at `limit: 1`.
 *
 * Marquee layout: a large "Filters" title with a context line, Sort as a
 * radio list, Genre and Language as multi-select chips with a "n selected"
 * note, Year and Duration as single-select chips, Rating as a 4-way segmented
 * control, and the crimson "Show N results" button in a footer above the dock.
 *
 * Since the Netflix-style Media page (2026-10-05) this is the SECOND
 * surface: the Sort & filter sheet is the primary control, and its "All
 * filters" link opens this page for what the sheet keeps simple (several
 * genres or languages at once). The sort list uses the same names as the
 * sheet (Popular, Trending now, New releases…) plus Oldest and Most purchased.
 *
 * Free only (accessType=FREE) and the admin category (categoryId — picked in
 * the Media page's Categories overlay) have no control here: they are set
 * elsewhere (the sheet, the overlay, a shelf's See all; removed by their
 * chips). The context line names them, the draft carries them, and the
 * count includes them.
 *
 * Reset means what the sheet's Reset means (clearMovieRefinements /
 * clearSeriesRefinements), so the two in one flow — sheet → All filters →
 * Reset — never disagree: every refinement goes back to its default (sort,
 * language, year, length, rating, and Free only — the context line drops
 * it), and the SELECTION stays: the genre(s) and category being browsed. A
 * genre is taken off here by tapping it, or on the Media page by its ✕.
 *
 * The two tabs' editors are separate components rather than one with a
 * `tab` switch: MovieFilters and SeriesFilters are different shapes with
 * different sort types, and keeping each draft concretely typed is what lets
 * the controls write to it without a cast.
 */
export function SearchFiltersScreen({ route, navigation }: Props) {
  const { tab, term } = route.params;
  const close = () => navigation.goBack();

  return (
    <View style={styles.container}>
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
  /** Both Back and a successful apply pop the page. */
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

  // The category is named in the context line (the page has no control for it).
  const categoriesQuery = useCategories();
  const categoryName = draft.categoryId
    ? (categoriesQuery.data?.find((category) => category.id === draft.categoryId)?.name ?? t.browse.categoryOverline)
    : null;
  const trending = draft.sort === "trending";

  return (
    <FiltersLayout
      kind={categoryName ? `${t.search.movies} · ${categoryName}` : t.search.movies}
      term={term}
      freeOnly={draft.freeOnly}
      onBack={onDone}
      // The sheet's Reset: the refinements (Free only included) go, the genre(s) and category stay.
      onReset={() => setDraft(clearMovieRefinements)}
      footer={<FiltersFooter t={t} total={countQuery.data?.total} counting={countQuery.isLoading} onApply={apply} />}
    >
      <FadeInView from="bottom" duration={300} style={styles.sections}>
        <FilterSection label={t.search.filterSort}>
          <RadioList
            options={movieSortChoices(t, term.length > 0, { full: true })}
            value={draft.sort}
            // Trending now owns the years: picking it lets go of a year preset.
            onChange={(sort) => patch(sort === "trending" ? { sort, yearPreset: "any" } : { sort })}
          />
          {/* Honesty hint: this option is the frozen pre-subscription table. */}
          {draft.sort === "mostPurchased" && (
            <View style={styles.hintLine}>
              <Ionicons name="information-circle-outline" size={16} color={theme.colors.info} />
              <ThemedText variant="caption" weight="regular" style={styles.hintText}>
                {t.search.sortMostPurchasedHint}
              </ThemedText>
            </View>
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

        <YearSection t={t} trending={trending} value={draft.yearPreset} onChange={(yearPreset) => patch({ yearPreset })} />

        <FilterSection label={t.search.filterDuration}>
          <View style={styles.chipRow}>
            {DURATION_BUCKETS.map((bucket) => (
              <Chip
                key={bucket}
                label={durationBucketLabel(t, bucket)}
                selected={draft.durationBucket === bucket}
                onPress={() => patch({ durationBucket: bucket })}
              />
            ))}
          </View>
        </FilterSection>

        <FilterSection label={t.search.filterRating}>
          <RatingSegments t={t} value={draft.ratingMin} onChange={(ratingMin) => patch({ ratingMin })} />
        </FilterSection>
      </FadeInView>
    </FiltersLayout>
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
    <FiltersLayout
      kind={t.search.series}
      term={term}
      freeOnly={draft.freeOnly}
      onBack={onDone}
      // The sheet's Reset: the refinements (Free only included) go, the genre(s) stay.
      onReset={() => setDraft(clearSeriesRefinements)}
      footer={<FiltersFooter t={t} total={countQuery.data?.total} counting={countQuery.isLoading} onApply={apply} />}
    >
      <FadeInView from="bottom" duration={300} style={styles.sections}>
        <FilterSection label={t.search.filterSort}>
          <RadioList options={seriesSortChoices(t, term.length > 0)} value={draft.sort} onChange={(sort) => patch({ sort })} />
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

        <YearSection t={t} trending={false} value={draft.yearPreset} onChange={(yearPreset) => patch({ yearPreset })} />
      </FadeInView>
    </FiltersLayout>
  );
}

/**
 * Year: the presets — or, while Trending now is the sort (it owns the
 * years), a line saying which years it covers.
 */
function YearSection({
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
    <FilterSection label={t.search.filterYear}>
      {trending ? (
        <ThemedText variant="caption" weight="regular" color={theme.colors.textFaint}>
          {t.search.trendingYearNote.replace("{year}", String(trendingFromYear()))}
        </ThemedText>
      ) : (
        <View style={styles.chipRow}>
          {YEAR_PRESETS.map((preset) => (
            <Chip
              key={preset}
              label={yearPresetLabel(t, preset)}
              selected={value === preset}
              onPress={() => onChange(preset)}
            />
          ))}
        </View>
      )}
    </FilterSection>
  );
}

/**
 * The page both editors share: the sections scroll up under the floating
 * Filters bar into its glass (components/layout/GlassBar) — transparent at
 * the top, frosted once they pass beneath it — with the "Show N results"
 * footer pinned below.
 */
function FiltersLayout({
  kind,
  term,
  freeOnly,
  onBack,
  onReset,
  footer,
  children,
}: {
  kind: string;
  term: string;
  /** Free only is on: named in the context line (the page has no control for it). */
  freeOnly: boolean;
  onBack: () => void;
  onReset: () => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  const glass = useGlassBar(BAR_ROWS_ESTIMATE);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  useScrollOffset(scrollRef, glass.scrollY);
  return (
    <>
      <GlassTarget targetRef={glass.blurTarget}>
        <Animated.ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.content, { paddingTop: glass.barHeight + CONTENT_TOP }]}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
        >
          {children}
        </Animated.ScrollView>
      </GlassTarget>

      {footer}

      <GlassBarBackground scrollY={glass.scrollY} height={glass.barHeight} blurTarget={glass.blurTarget} />
      <FiltersTopBar
        kind={kind}
        term={term}
        freeOnly={freeOnly}
        onBack={onBack}
        onReset={onReset}
        onLayout={glass.onBarLayout}
      />
    </>
  );
}

/**
 * Back on the left, Reset on the right (it moved up from the footer), then the
 * large "Filters" title and what is being filtered: "Movies · results for
 * “river”", or just "Movies" with no term. Free only joins the kind —
 * "Movies · Free only · results for “river”" — early in the line, so the
 * line's two-line cap (large text, Burmese, a long term) cuts the term first.
 */
function FiltersTopBar({
  kind,
  term,
  freeOnly,
  onBack,
  onReset,
  onLayout,
}: {
  kind: string;
  term: string;
  freeOnly: boolean;
  onBack: () => void;
  onReset: () => void;
  /** The floating bar's box — FiltersLayout pads the page and sizes the glass from it. */
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  const { t } = useLanguage();
  const scope = freeOnly ? `${kind} · ${t.search.freeOnly}` : kind;
  const context = term ? t.search.filtersContext.replace("{kind}", scope).replace("{term}", term) : scope;
  return (
    <TopBar
      large
      floating
      touchThrough
      onLayout={onLayout}
      title={t.search.filters}
      subtitle={context}
      onBack={onBack}
      backAccessibilityLabel={t.common.back}
      trailing={
        <Pressable
          onPress={onReset}
          accessibilityRole="button"
          accessibilityLabel={t.search.reset}
          style={({ pressed }) => [styles.reset, pressed && styles.pressed]}
        >
          <Ionicons name="refresh" size={18} color={theme.colors.text} />
          {/* Grows with the reader's text size up to 2×, where the Burmese
              "Reset" (~225pt with its icon) still fits the ~250pt the large
              bar leaves beside Back on a 320pt screen; capped there so the
              very largest sizes cannot push it off the edge. */}
          <ThemedText weight="extrabold" numberOfLines={1} maxFontSizeMultiplier={2}>
            {t.search.reset}
          </ThemedText>
        </Pressable>
      }
    />
  );
}

/**
 * The sort options as a radio list — full-width 52pt rows with a hairline
 * under each, the label on the left and the radio on the right.
 */
function RadioList<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (next: V) => void;
}) {
  return (
    <View accessibilityRole="radiogroup">
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked }}
            accessibilityLabel={option.label}
            style={({ pressed }) => [styles.radioRow, pressed && styles.radioPressed]}
          >
            <ThemedText
              weight={checked ? "extrabold" : "medium"}
              color={checked ? theme.colors.text : theme.colors.textBody}
              style={styles.radioLabel}
            >
              {option.label}
            </ThemedText>
            <View style={[styles.radio, checked && styles.radioOn]}>
              {checked ? <View style={styles.radioDot} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Rating as a 4-way segmented control: Any, ★7+, ★8+, ★9+. A radio group
 * (one floor at a time); the selected segment is the white fill. Segments
 * grow taller rather than cut a long Burmese label.
 */
function RatingSegments({
  t,
  value,
  onChange,
}: {
  t: TranslationShape;
  value: RatingFloor;
  onChange: (next: RatingFloor) => void;
}) {
  return (
    <View style={styles.segments} accessibilityRole="radiogroup">
      {RATING_FLOORS.map((floor) => {
        const checked = floor === value;
        const ink = checked ? theme.colors.onPlay : theme.colors.text;
        return (
          <Pressable
            key={floor}
            onPress={() => onChange(floor)}
            accessibilityRole="radio"
            accessibilityState={{ checked }}
            accessibilityLabel={
              floor === 0 ? t.search.ratingAnyA11y : t.search.ratingFloorA11y.replace("{n}", String(floor))
            }
            style={({ pressed }) => [styles.segment, checked && styles.segmentOn, pressed && styles.pressed]}
          >
            {floor > 0 ? (
              <Ionicons name="star" size={14} color={checked ? theme.colors.onPlay : theme.colors.premium} />
            ) : null}
            <ThemedText
              weight={checked ? "extrabold" : "semibold"}
              tabular
              color={ink}
              style={styles.segmentLabel}
            >
              {ratingFloorLabel(t, floor)}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * A multi-select facet section. Options come from GET /movies/facets (or
 * /series/facets), so only values that exist in the catalogue are offered,
 * and a facet with no values hides its whole section rather than showing an
 * empty heading. A selected chip carries a check.
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
  const { t } = useLanguage();
  if (!options || options.length === 0) return null;
  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  const note = selected.length === 0 ? t.search.facetAny : t.search.selectedCount.replace("{n}", String(selected.length));
  return (
    <FilterSection label={label} note={note}>
      <View style={styles.chipRow}>
        {options.map((facet) => {
          const on = selected.includes(facet.value);
          return (
            <Chip
              key={facet.value}
              label={facet.value}
              icon={on ? "checkmark" : undefined}
              selected={on}
              onPress={() => toggle(facet.value)}
            />
          );
        })}
      </View>
    </FilterSection>
  );
}

/** One section — a 19pt heading (with an optional note on its right) over its control. */
function FilterSection({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <ThemedText variant="section" accessibilityRole="header" style={styles.sectionTitle}>
          {label}
        </ThemedText>
        {note ? (
          <ThemedText variant="caption" weight="regular" tabular color={theme.colors.textFaint}>
            {note}
          </ThemedText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Three pulsing dots — the "counting" state, never a spinner. Still under reduce motion. */
function CountingDots() {
  return (
    <View style={styles.dots}>
      <Dot index={0} />
      <Dot index={1} />
      <Dot index={2} />
    </View>
  );
}

function Dot({ index }: { index: number }) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(reduceMotion ? 1 : 0.35);
  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(opacity);
      opacity.value = 1;
      return;
    }
    opacity.value = 0.35;
    opacity.value = withDelay(
      index * 150,
      withRepeat(withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
    return () => cancelAnimation(opacity);
  }, [opacity, index, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.dot, style]} />;
}

/**
 * The footer: "Show N results" alone (Reset moved to the top bar). It sits
 * BELOW the scroll in the layout (not over it), so the last section can
 * always be scrolled clear of it, with a short fade above it. This route is
 * pushed inside the Search tab, where the floating dock covers the bottom
 * band, so the footer pads by the device's exact dock clearance.
 */
function FiltersFooter({
  t,
  total,
  counting,
  onApply,
}: {
  t: TranslationShape;
  total: number | undefined;
  counting: boolean;
  onApply: () => void;
}) {
  const dockClearance = useDockClearance();
  const reduceMotion = useReducedMotion();
  // `isLoading`, never `isFetching`: every chip tap starts a NEW count, and
  // showing the counting state on each refetch made the button flicker. The
  // stale count stays on the label for the moment it takes to refresh —
  // applying the draft is what the button does, the number is only a preview,
  // so the button stays pressable while the first count is on its way.
  const title =
    total === undefined
      ? t.search.showResultsUnknown
      : total === 1
        ? t.search.showResultsOne
        : t.search.showResults.replace("{n}", String(total));
  return (
    <View style={[styles.footer, { paddingBottom: dockClearance }]}>
      <LinearGradient colors={FADE_COLORS} style={styles.fade} pointerEvents="none" />
      <Pressable
        onPress={onApply}
        accessibilityRole="button"
        accessibilityLabel={counting ? `${t.search.showResultsUnknown}, ${t.common.loading}` : title}
        accessibilityState={{ busy: counting }}
        style={({ pressed }) => [
          styles.apply,
          pressed && (reduceMotion ? styles.applyPressedStill : styles.applyPressed),
        ]}
      >
        {counting ? (
          <>
            <ThemedText weight="extrabold" color={theme.colors.onPrimary} numberOfLines={1} style={styles.counting}>
              {t.search.showResultsUnknown}
            </ThemedText>
            <CountingDots />
          </>
        ) : (
          <ThemedText
            weight="extrabold"
            tabular
            color={theme.colors.onPrimary}
            numberOfLines={2}
            accessibilityLiveRegion="polite"
            style={styles.applyLabel}
          >
            {title}
          </ThemedText>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  /** The top padding is FiltersLayout's: the bar's height + CONTENT_TOP. */
  content: { paddingBottom: theme.spacing.lg },
  sections: { gap: theme.spacing.xl },
  section: { paddingHorizontal: theme.layout.screenPadding, gap: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  sectionTitle: { flexShrink: 1 },
  /** The chip rows wrap: 14pt between 34pt chips leaves 4pt between their 44pt targets. */
  chipRow: { flexDirection: "row", flexWrap: "wrap", columnGap: theme.spacing.sm, rowGap: 14 },
  hintLine: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm, marginTop: 2 },
  hintText: { flex: 1 },
  reset: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: theme.layout.minTouch,
    paddingHorizontal: 10,
  },
  pressed: { opacity: 0.7 },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    minHeight: 52,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  radioPressed: { opacity: 0.7 },
  radioLabel: { flex: 1, fontSize: 16 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.colors.textFaint,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: theme.colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.primary },
  segments: {
    flexDirection: "row",
    gap: 2,
    padding: 2,
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.surfaceElevated,
  },
  /** Equal quarters; a minimum height so a wrapped label grows the control. */
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs,
    minHeight: theme.layout.minTouch,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radius.md,
  },
  segmentOn: { backgroundColor: theme.colors.play },
  segmentLabel: { flexShrink: 1, textAlign: "center" },
  footer: {
    paddingTop: 12,
    paddingHorizontal: theme.layout.screenPadding,
    backgroundColor: theme.colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  fade: { position: "absolute", left: 0, right: 0, top: -FOOTER_FADE, height: FOOTER_FADE },
  apply: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 20,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.primary,
  },
  applyPressed: { transform: [{ scale: 0.96 }] },
  applyPressedStill: { opacity: 0.8 },
  applyLabel: { fontSize: 16, textAlign: "center", flexShrink: 1 },
  counting: { fontSize: 16, opacity: 0.75, flexShrink: 1 },
  dots: { flexDirection: "row", gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.onPrimary },
});
