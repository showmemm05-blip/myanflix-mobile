import { useCallback, useMemo } from "react";
import {
  RefreshControl,
  SectionList,
  StyleSheet,
  View,
  type SectionListData,
  type SectionListRenderItemInfo,
} from "react-native";
import { useAnimatedRef, useScrollOffset } from "react-native-reanimated";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ThemedText } from "@/components/ui/ThemedText";
import { Skeleton } from "@/components/common/Skeleton";
import { ListFooterSpinner } from "@/components/common/ListFooterSpinner";
import { TopBar } from "@/components/layout/TopBar";
import { GlassBarBackground, GlassTarget, useGlassBar } from "@/components/layout/GlassBar";
import { HistoryRow } from "@/components/library/HistoryRow";
import { PageHeading } from "@/components/library/PageHeading";
import { ErrorBlock, HaloIcon, StateBlock } from "@/components/library/LibraryState";
import {
  dayHeading,
  groupByDay,
  titlesCountLabel,
  useCalendarDay,
  type DayGroup,
} from "@/components/library/historyFormat";
import { useWatchHistoryInfinite } from "@/hooks/useVideo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LIST_PAGE_SIZE, flattenPages } from "@/hooks/pagination";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { ProfileStackParamList } from "@/navigation/types";
import type { WatchHistoryEntry } from "@/types/video";

type Props = NativeStackScreenProps<ProfileStackParamList, "WatchHistory">;

type Section = DayGroup<WatchHistoryEntry>;

/**
 * Module scope on purpose — handed to SectionList, whose cells are
 * PureComponents, so an inline extractor, separator or header would re-render
 * every visible row each time a page lands.
 */
const keyExtractor = (item: WatchHistoryEntry) => item.id;
const dateOf = (item: WatchHistoryEntry) => item.updatedAt;
function RowSeparator() {
  return <View style={styles.rowGap} />;
}
const renderSectionHeader = ({ section }: { section: SectionListData<WatchHistoryEntry, Section> }) => (
  <View style={styles.sectionHeader}>
    <ThemedText variant="caption" weight="extrabold" tabular color={theme.colors.textMuted} accessibilityRole="header">
      {section.title}
    </ThemedText>
    <View style={styles.sectionRule} />
  </View>
);

export function WatchHistoryScreen({ navigation }: Props) {
  const { t } = useLanguage();
  // Opened from Profile, above the tabs, where the dock is hidden — so pad for
  // the phone's own bottom edge, not for the dock (owner, 2026-10-07).
  const bottomClearance = useSafeAreaInsets().bottom + theme.spacing.xl;
  // The glass bar (components/layout/GlassBar): the bar floats over the list,
  // transparent at the top, frosted once the rows scroll under it.
  const glass = useGlassBar();
  const listRef = useAnimatedRef<SectionList<WatchHistoryEntry, Section>>();
  useScrollOffset(listRef, glass.scrollY);
  // Paged, newest first: a screenful at a time instead of one 50-row pull, and
  // no ceiling on how far back the user can scroll.
  const historyQuery = useWatchHistoryInfinite({ limit: LIST_PAGE_SIZE });
  const entries = useMemo(() => flattenPages(historyQuery.data?.pages), [historyQuery.data]);
  // The server's total for the whole history, not just the loaded pages.
  const total = historyQuery.data?.pages[0]?.total ?? entries.length;

  // Today / Yesterday / the phone's short date, in the API's own order.
  // `today` is a trigger only: it moves at the first foreground after
  // midnight, so the headings are recomputed against the new day.
  const today = useCalendarDay();
  const sections = useMemo<Section[]>(
    () => groupByDay(entries, dateOf, (iso) => dayHeading(iso, t)),
    [entries, t, today],
  );

  // Pushes onto PROFILE's own stack — MovieDetails is registered here too
  // (ProfileStackNavigator) — so back returns to this list. It used to jump to
  // the Home tab, which is why back dropped the user on Home. Stable, so the
  // memoized rows survive a page landing.
  const goToDetails = useCallback(
    (movieId: string) => navigation.navigate("MovieDetails", { movieId }),
    [navigation],
  );

  // The empty state's way out (WatchHistory.dc.html → Browse.dc.html): the
  // Browse page, registered on this stack, so back returns to this list.
  const browse = useCallback(() => navigation.navigate("Browse"), [navigation]);

  /**
   * Stable identities for SectionList (a PureComponent): a fresh arrow or a
   * fresh `<RefreshControl>` element per render would force a whole
   * VirtualizedList pass every time a page lands. A pull refetches every
   * loaded page; its spinner is that refetch only, never the next-page fetch,
   * which has the footer below.
   */
  const endReached = useCallback(() => {
    if (historyQuery.hasNextPage && !historyQuery.isFetchingNextPage) historyQuery.fetchNextPage();
  }, [historyQuery.hasNextPage, historyQuery.isFetchingNextPage, historyQuery.fetchNextPage]);

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={historyQuery.isRefetching && !historyQuery.isFetchingNextPage}
        onRefresh={() => historyQuery.refetch()}
        tintColor={theme.colors.primary}
        colors={[theme.colors.primary]}
        progressBackgroundColor={theme.colors.surface}
        progressViewOffset={glass.barHeight}
      />
    ),
    [historyQuery.isRefetching, historyQuery.isFetchingNextPage, historyQuery.refetch, glass.barHeight],
  );

  const renderItem = useCallback(
    ({ item }: SectionListRenderItemInfo<WatchHistoryEntry, Section>) => <HistoryRow entry={item} onOpen={goToDetails} />,
    [goToDetails],
  );

  /**
   * The "next page is on the wire" dots — memoized so its element identity (a
   * list prop) only moves with the flag.
   */
  const listFooter = useMemo(
    () => <ListFooterSpinner visible={historyQuery.isFetchingNextPage} />,
    [historyQuery.isFetchingNextPage],
  );

  const isReady = !historyQuery.isLoading && !historyQuery.isError && entries.length > 0;

  const listHeader = useMemo(
    () => (
      <PageHeading
        title={t.profile.watchHistory}
        meta={
          isReady ? (
            <ThemedText variant="caption" weight="regular" tabular color={theme.colors.textFaint}>
              {`${titlesCountLabel(total, t)} · ${t.library.newestFirst}`}
            </ThemedText>
          ) : null
        }
        style={styles.heading}
      />
    ),
    [isReady, total, t],
  );

  const listEmpty = historyQuery.isLoading ? (
    // A day heading and five rows at the real row's size, so the first page
    // lands on top of the placeholders without a shift.
    <View style={styles.skeletonList} accessibilityLabel={t.common.loading}>
      <Skeleton width={80} height={12} radius="xs" />
      {[0, 1, 2, 3, 4].map((key) => (
        <View key={key} style={styles.skeletonRow}>
          <Skeleton width={80} height={120} radius="sm" />
          <View style={styles.skeletonText}>
            <Skeleton width={150} height={16} radius="sm" />
            <Skeleton width={90} height={11} radius="xs" style={styles.skeletonMeta} />
            <Skeleton height={4} radius="xs" style={styles.skeletonBar} />
          </View>
        </View>
      ))}
    </View>
  ) : historyQuery.isError ? (
    <ErrorBlock message={t.common.somethingWentWrong} style={styles.stateBlock} />
  ) : (
    <StateBlock
      art={<HaloIcon icon="time-outline" />}
      title={t.profile.empty}
      body={t.library.historyEmptyBody}
      actionLabel={t.library.browse}
      onAction={browse}
      style={styles.stateBlock}
    />
  );

  return (
    <View style={styles.container}>
      <GlassTarget targetRef={glass.blurTarget}>
        <SectionList
          ref={listRef}
          sections={isReady ? sections : []}
          keyExtractor={keyExtractor}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          ListFooterComponent={listFooter}
          // The page starts under the floating bar and scrolls up beneath it.
          contentContainerStyle={[styles.listContent, { paddingTop: glass.barHeight, paddingBottom: bottomClearance }]}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          stickySectionHeadersEnabled={false}
          refreshControl={isReady ? refreshControl : undefined}
          onEndReachedThreshold={0.6}
          onEndReached={endReached}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
          renderSectionHeader={renderSectionHeader}
          ItemSeparatorComponent={RowSeparator}
          renderItem={renderItem}
        />
      </GlassTarget>

      <GlassBarBackground scrollY={glass.scrollY} height={glass.barHeight} blurTarget={glass.blurTarget} />
      <TopBar
        floating
        touchThrough
        onLayout={glass.onBarLayout}
        onBack={() => navigation.goBack()}
        backAccessibilityLabel={t.common.back}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  listContent: { flexGrow: 1, paddingHorizontal: theme.layout.screenPadding },
  /** The list owns the 16pt margins, so the heading drops its own. */
  heading: { paddingHorizontal: 0, marginBottom: theme.spacing.sm },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    // 24 above each day: the board's 28pt between groups, less the row's own air.
    marginTop: theme.spacing.lg,
    marginBottom: 12,
  },
  sectionRule: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  rowGap: { height: theme.spacing.md },
  skeletonList: { paddingTop: 18 },
  skeletonRow: { flexDirection: "row", gap: 14, marginTop: theme.spacing.md },
  skeletonText: { flex: 1, paddingTop: theme.spacing.sm },
  skeletonMeta: { marginTop: 12 },
  skeletonBar: { marginTop: 30 },
  stateBlock: { marginTop: 72 },
});
