import { useCallback, useEffect, useMemo, useRef, type ReactElement, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type ListRenderItemInfo,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useScrollOffset } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ThemedText } from "@/components/ui/ThemedText";
import { Chip } from "@/components/common/Chip";
import { MediaCardSkeleton } from "@/components/common/MediaCard";
import { NextPageError } from "@/components/search/NextPageFooter";
import { HUB_SECTION_GAP, useHubChromeHeight } from "@/components/hub/hubLayout";
import type { HubScroll } from "@/components/hub/useHubScroll";
import { useDockClearance } from "@/hooks/useDockClearance";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

/** One choice in a chip strip or a radio row. */
export interface HubChoice {
  value: string;
  label: string;
}

/** A single-select control group: the books' category chips, format and language radios. */
export interface HubChoiceGroup {
  /** The group's spoken name ("Category", "Format"). */
  label: string;
  options: HubChoice[];
  value: string;
  onChange: (value: string) => void;
}

/** Layout of the "All …" grid (Main.dc.html: 3 columns, 10pt between columns, 16pt between rows). */
export interface HubGridLayout {
  columns: number;
  columnGap: number;
  rowGap: number;
  cellWidth: number;
}

/** LAYOUT ONLY. A phone always gets three columns (an 89pt poster at 320pt); a tablet four or five. */
export function useHubGrid(): HubGridLayout {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const columns = width >= 900 ? 5 : width >= 600 ? 4 : 3;
  const columnGap = 10;
  const track = width - insets.left - insets.right - 2 * theme.layout.screenPadding;
  const cellWidth = Math.floor((track - (columns - 1) * columnGap) / columns);
  return useMemo(() => ({ columns, columnGap, rowGap: 16, cellWidth }), [columns, cellWidth]);
}

export interface HubAllGridProps<T> {
  /** From useHubScroll(): the list is attached to it and records where "All …" starts. */
  scroll: HubScroll;
  /** Everything above the "All …" section — the hero and the rows. */
  header: ReactElement;
  /** "All movies", "Drama", "Trending now". */
  title: string;
  /**
   * "section" (default) — the 19pt heading under a hero; "title" — the 24pt
   * page title, for a results view with no hero above it.
   */
  titleVariant?: "section" | "title";
  /**
   * The section starts right under `header` (a results view with no hero:
   * the header is just the pinned chrome's clearance) instead of a full
   * section gap below a hero.
   */
  compactTop?: boolean;
  /**
   * The Movies / Series results view: the grid mounts in place of what the
   * reader was on (a pick in the Categories overlay, a shelf's See all, a new
   * genre), so a screen reader's focus moves to its heading — once per mount,
   * after the overlay has faded out. Books' grid is part of its page and
   * leaves focus alone.
   */
  focusTitleOnMount?: boolean;
  /**
   * Under the title: the count (the server's total, never the rows loaded)
   * and its controls — Movies / Series: MediaResultsHeader (Sort & filter,
   * removable chips, Clear all); Books: HubAllToolbar (the Authors pill).
   */
  toolbar?: ReactNode;
  /** The horizontally scrolling single-select chips (book categories). */
  chips?: HubChoiceGroup | null;
  /** The radio row under the chips (sorts; the books' format). */
  radios?: HubChoiceGroup | null;
  /** A quiet note at the end of the radio row (Books: "Newest first" — its only order). */
  note?: string | null;
  /** Further radio rows under the first, one line each (Books: the language). Empty groups are skipped. */
  moreRadios?: HubChoiceGroup[] | null;
  items: T[];
  keyExtractor: (item: T) => string;
  /** One grid cell at the given width. Memoize it — every cell takes it. */
  renderCell: (item: T, width: number) => ReactElement;
  /** A placeholder cell of the same height. Defaults to the poster MediaCardSkeleton. */
  renderSkeletonCell?: (width: number, index: number) => ReactElement;
  /** The first page of the CURRENT filter is on its way (count placeholder data as loading). */
  loading: boolean;
  /**
   * The cells on screen are the PREVIOUS filter's, held while this one's
   * first page loads (React Query's keepPreviousData): they stay, dimmed and
   * tappable, instead of blanking to skeletons.
   */
  stale?: boolean;
  /**
   * A first-page fetch or a refresh is in flight (not a next page). The
   * list never asks for the next page meanwhile — together with the
   * fetching-next-page guard this is what keeps a page from being asked twice.
   */
  refetching?: boolean;
  error: boolean;
  onRetry: () => void;
  /** Shown when the filter matched nothing ("No movies in this genre yet."). */
  emptyMessage: string;
  /** A button under the empty message — "Reset" while filters are what emptied the list. */
  emptyAction?: { label: string; onPress: () => void } | null;
  hasNextPage: boolean;
  fetchingNextPage: boolean;
  /** The automatic next page failed: an inline "Couldn't load more · Retry" line appears (never a "Load more" button). */
  nextPageFailed: boolean;
  /** fetchNextPage. Called automatically near the end of the list, or by the inline Retry. */
  onLoadMore: () => void;
  /** Pull-to-refresh: every query the hub is showing. Omitted, the list has none. */
  onRefresh?: () => void;
  /** A refresh the user pulled for is in flight — never a background refetch. */
  refreshing?: boolean;
}

/** Placeholder rows while a filter's first page loads. */
const SKELETON_ROWS = 3;
/** Past the Categories overlay's fade-out and the results' 260ms cross-fade. */
const TITLE_FOCUS_DELAY_MS = 600;

/**
 * A hub's grid body, ending in its "All …" / results section: the Books
 * chip's page (hero, shelves, then "All books" with its chips and radios),
 * and the Movies / Series RESULTS view (a genre's hero or the chrome's
 * clearance, then the heading, the count and filter row, and the grid).
 * The 3-column grid pages by itself as the user nears the end — one page at
 * a time, skeleton cells while it streams in, the loaded pages kept, an
 * inline Retry only after a page failed. Everything above the section
 * arrives as `header`, so the whole page is ONE virtualized list (no list
 * nested in a ScrollView).
 */
export function HubAllGrid<T>({
  scroll,
  header,
  title,
  titleVariant = "section",
  compactTop = false,
  focusTitleOnMount = false,
  toolbar,
  chips,
  radios,
  note,
  moreRadios,
  items,
  keyExtractor,
  renderCell,
  renderSkeletonCell,
  loading,
  stale = false,
  refetching = false,
  error,
  onRetry,
  emptyMessage,
  emptyAction,
  hasNextPage,
  fetchingNextPage,
  nextPageFailed,
  onLoadMore,
  onRefresh,
  refreshing = false,
}: HubAllGridProps<T>) {
  const { t } = useLanguage();
  const grid = useHubGrid();
  const dockClearance = useDockClearance();
  const refreshControl = useHubRefreshControl(onRefresh, refreshing);
  useHubListScroll(scroll, grid.columns);

  const titleRef = useRef<View>(null);
  useEffect(() => {
    if (!focusTitleOnMount) return;
    const timer = setTimeout(() => {
      if (titleRef.current) AccessibilityInfo.sendAccessibilityEvent(titleRef.current, "focus");
    }, TITLE_FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
    // Once per mount: the hubs remount the grid for every new view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skeletonCell = useCallback(
    (width: number, index: number) =>
      renderSkeletonCell ? renderSkeletonCell(width, index) : <MediaCardSkeleton width={width} />,
    [renderSkeletonCell],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<T>) => (
      <View style={[{ width: grid.cellWidth }, stale && styles.stale]}>{renderCell(item, grid.cellWidth)}</View>
    ),
    [renderCell, grid.cellWidth, stale],
  );

  // Automatic paging, asked at most once at a time: never while a page (or
  // the first page, or a refresh) is on its way, never for held-over cells,
  // and never again by itself after a page failed — the inline Retry does that.
  const canLoadMore = hasNextPage && !fetchingNextPage && !nextPageFailed && !loading && !stale;
  /**
   * The end was reached while a background refetch held paging back. The
   * list reports an end only once per content length, and a refetch leaves
   * the length as it was — so the end is remembered here and answered as
   * soon as the refetch lands. (Every other hold changes the content, and
   * the list then asks again by itself.) A new filter forgets it.
   */
  const endPending = useRef(false);
  const onEndReached = useCallback(() => {
    if (!canLoadMore) return;
    if (refetching) endPending.current = true;
    else onLoadMore();
  }, [canLoadMore, refetching, onLoadMore]);
  useEffect(() => {
    if (loading || stale) endPending.current = false;
    else if (endPending.current && canLoadMore && !refetching) {
      endPending.current = false;
      onLoadMore();
    }
  }, [loading, stale, canLoadMore, refetching, onLoadMore]);

  const footer = useMemo(() => {
    if (fetchingNextPage) {
      return (
        <View
          style={[styles.footerRow, { columnGap: grid.columnGap, marginTop: grid.rowGap }]}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t.common.loading}
        >
          {Array.from({ length: grid.columns }, (_, i) => (
            <View key={i} style={{ width: grid.cellWidth }}>
              {skeletonCell(grid.cellWidth, i)}
            </View>
          ))}
        </View>
      );
    }
    if (nextPageFailed) return <NextPageError onRetry={onLoadMore} />;
    return null;
  }, [fetchingNextPage, nextPageFailed, grid, skeletonCell, onLoadMore, t]);

  const Separator = useCallback(() => <View style={{ height: grid.rowGap }} />, [grid.rowGap]);
  const columnStyle = useMemo(() => [styles.gridRow, { columnGap: grid.columnGap }], [grid.columnGap]);

  const showGrid = !loading && !error;
  const listHeader = (
    <View>
      {header}
      <View
        style={compactTop ? styles.sectionCompact : styles.section}
        onLayout={(event) => {
          scroll.setAllY(event.nativeEvent.layout.y);
        }}
      >
        <View ref={titleRef} style={styles.heading} accessible accessibilityRole="header" accessibilityLabel={title}>
          <ThemedText variant={titleVariant} style={styles.headingTitle}>
            {title}
          </ThemedText>
        </View>

        {toolbar ? <View style={styles.toolbar}>{toolbar}</View> : null}
        {chips && chips.options.length > 0 ? <ChipStrip group={chips} /> : null}
        {(radios && radios.options.length > 0) || note ? (
          <View style={styles.radioLine}>
            {radios && radios.options.length > 0 ? <RadioRow group={radios} /> : <View style={styles.flex} />}
            {note ? (
              <View style={styles.note}>
                <Ionicons name="arrow-down" size={14} color={theme.colors.textFaint} />
                <ThemedText variant="caption" weight="regular" color={theme.colors.textFaint}>
                  {note}
                </ThemedText>
              </View>
            ) : null}
          </View>
        ) : null}
        {moreRadios
          ?.filter((group) => group.options.length > 0)
          .map((group) => (
            <View key={group.label} style={styles.radioLine}>
              <RadioRow group={group} />
            </View>
          ))}

        <View style={styles.gridTop}>
          {loading ? (
            <View
              style={[styles.skeletonGrid, { columnGap: grid.columnGap, rowGap: grid.rowGap }]}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={t.common.loading}
            >
              {Array.from({ length: grid.columns * SKELETON_ROWS }, (_, i) => (
                <View key={i} style={{ width: grid.cellWidth }}>
                  {skeletonCell(grid.cellWidth, i)}
                </View>
              ))}
            </View>
          ) : error ? (
            <EmptyState
              icon="cloud-offline-outline"
              tone={theme.colors.danger}
              message={t.common.somethingWentWrong}
              actionLabel={t.common.retry}
              onAction={onRetry}
              fill={false}
              style={styles.gridState}
            />
          ) : items.length === 0 ? (
            <View style={styles.empty}>
              <ThemedText variant="body" color={theme.colors.textMuted}>
                {emptyMessage}
              </ThemedText>
              {emptyAction ? (
                <Button
                  title={emptyAction.label}
                  onPress={emptyAction.onPress}
                  variant="secondary"
                  labelLines={2}
                  style={styles.emptyAction}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );

  return (
    <Animated.FlatList
      ref={scroll.listRef}
      // RN cannot change numColumns in place — a rotation remounts the list.
      key={`hub-grid-${grid.columns}`}
      data={showGrid ? items : []}
      extraData={stale}
      numColumns={grid.columns}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ListHeaderComponent={listHeader}
      ListFooterComponent={footer}
      columnWrapperStyle={columnStyle}
      ItemSeparatorComponent={Separator}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      scrollEventThrottle={16}
      initialNumToRender={9}
      maxToRenderPerBatch={9}
      windowSize={7}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
      contentContainerStyle={{ paddingBottom: dockClearance }}
      // No field on this page, but a keyboard left up by a sheet still goes
      // away on a drag, and a tap on a card still lands while it is up.
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    />
  );
}

/**
 * A hub list's scroll wiring (HubAllGrid, HubBrowseList): writes the page's
 * scroll offset into the shared `scroll.scrollY`, which the Media bar's glass
 * and the hero's pager read. A new list (first mount, a view switch, or the
 * remount a rotation forces — `remountKey`) starts at the top without a
 * scroll event, so the value is reset with it — and so is a list that goes
 * away, or the bar would stay frosted over a page with nothing scrolled.
 * Only ONE list per hub is mounted at a time: they share `scroll.listRef`.
 */
export function useHubListScroll(scroll: HubScroll, remountKey: string | number): void {
  useScrollOffset(scroll.listRef, scroll.scrollY);
  useEffect(() => {
    const scrollY = scroll.scrollY;
    scrollY.value = 0;
    return () => {
      scrollY.value = 0;
    };
  }, [scroll.scrollY, remountKey]);
}

/**
 * Pull-to-refresh for a hub list, its indicator brought down below the
 * pinned Media bar and chips. A stable element: a fresh <RefreshControl>
 * would re-render the whole list.
 */
export function useHubRefreshControl(onRefresh: (() => void) | undefined, refreshing: boolean) {
  const chromeHeight = useHubChromeHeight();
  return useMemo(
    () =>
      onRefresh ? (
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          progressViewOffset={chromeHeight}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
          progressBackgroundColor={theme.colors.surface}
        />
      ) : undefined,
    [onRefresh, refreshing, chromeHeight],
  );
}

/** The category chips: one row that scrolls, the selected chip white. */
function ChipStrip({ group }: { group: HubChoiceGroup }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.chips}
      style={styles.chipsBox}
    >
      {group.options.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          selected={option.value === group.value}
          onPress={() => group.onChange(option.value)}
          accessibilityLabel={`${group.label}, ${option.label}`}
        />
      ))}
    </ScrollView>
  );
}

/**
 * The sort radios (Main.dc.html): words, the checked one white and
 * extra-bold over a 2pt crimson underline, the rest grey. Each is a 44pt
 * target; the row wraps instead of cutting a long Burmese label.
 */
function RadioRow({ group }: { group: HubChoiceGroup }) {
  return (
    <View style={styles.radios} accessibilityRole="radiogroup" accessibilityLabel={group.label}>
      {group.options.map((option) => {
        const checked = option.value === group.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => group.onChange(option.value)}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked }}
            // An opacity dip only — words do not scale — so reduce motion changes nothing.
            style={({ pressed }) => [styles.radio, pressed && !checked && styles.pressed]}
          >
            <ThemedText
              variant="muted"
              weight={checked ? "extrabold" : "semibold"}
              color={checked ? theme.colors.text : theme.colors.textFaint}
            >
              {option.label}
            </ThemedText>
            <View style={[styles.radioBar, checked && styles.radioBarOn]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { marginTop: HUB_SECTION_GAP },
  sectionCompact: { marginTop: theme.spacing.sm },
  /** Held-over cells while the new filter's first page loads (ResultsRegion's 40%). */
  stale: { opacity: 0.4 },
  heading: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    justifyContent: "space-between",
    columnGap: 12,
    paddingHorizontal: theme.layout.screenPadding,
  },
  headingTitle: { flexShrink: 1 },
  toolbar: { marginTop: theme.spacing.xs, gap: theme.spacing.xs },
  chipsBox: { marginTop: 10 },
  /** 5pt above and below keep the chips' 44pt slop inside the strip. */
  chips: {
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.layout.screenPadding,
    paddingVertical: 5,
  },
  radioLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    columnGap: 12,
    marginTop: 4,
    paddingHorizontal: theme.layout.screenPadding,
  },
  radios: { flex: 1, flexDirection: "row", flexWrap: "wrap", columnGap: 18 },
  radio: { minHeight: theme.layout.minTouch, justifyContent: "center" },
  radioBar: { height: 2, marginTop: 2, borderRadius: 1, backgroundColor: "transparent" },
  radioBarOn: { backgroundColor: theme.colors.primary },
  note: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: theme.layout.minTouch },
  gridTop: { marginTop: 10, marginBottom: 0 },
  skeletonGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: theme.layout.screenPadding },
  gridState: { paddingVertical: theme.spacing.xl },
  empty: { marginTop: 10, paddingHorizontal: theme.layout.screenPadding, alignItems: "flex-start" },
  emptyAction: { marginTop: theme.spacing.md, minWidth: 120 },
  gridRow: { paddingHorizontal: theme.layout.screenPadding },
  footerRow: { flexDirection: "row", paddingHorizontal: theme.layout.screenPadding },
  pressed: { opacity: 0.7 },
});
