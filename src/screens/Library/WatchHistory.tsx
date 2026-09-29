import { useCallback, useMemo } from "react";
import { FlatList, RefreshControl, View, StyleSheet, type ListRenderItemInfo } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { EmptyState } from "@/components/ui/EmptyState";
import { MediaCard, MediaCardSkeleton } from "@/components/common/MediaCard";
import { ListFooterSpinner } from "@/components/common/ListFooterSpinner";
import { TopBar } from "@/components/layout/TopBar";
import { useWatchHistoryInfinite } from "@/hooks/useVideo";
import { usePosterGrid } from "@/hooks/usePosterGrid";
import { LIST_PAGE_SIZE, flattenPages } from "@/hooks/pagination";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatDuration } from "@/utils/format";
import { theme } from "@/theme";
import type { LibraryStackParamList } from "@/navigation/types";
import type { WatchHistoryEntry } from "@/types/video";

type Props = NativeStackScreenProps<LibraryStackParamList, "WatchHistory">;

/**
 * Module scope on purpose — handed to FlatList, whose cells are PureComponents,
 * so an inline extractor or separator would re-render every visible poster
 * each time a page lands.
 */
const keyExtractor = (item: WatchHistoryEntry) => item.id;
function RowSeparator() {
  return <View style={styles.rowGap} />;
}

export function WatchHistoryScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const grid = usePosterGrid();
  // Paged, newest first: a screenful at a time instead of one 50-row pull, and
  // no ceiling on how far back the user can scroll.
  const historyQuery = useWatchHistoryInfinite({ limit: LIST_PAGE_SIZE });
  const entries = useMemo(() => flattenPages(historyQuery.data?.pages), [historyQuery.data]);

  // Pushes onto the LIBRARY stack — MovieDetails is registered here too
  // (LibraryStackNavigator) — so back returns to this list. It used to jump to
  // the Home tab, which is why back dropped the user on Home. Stable, so the
  // memoized poster cells survive a page landing.
  const goToDetails = useCallback(
    (movieId: string) => navigation.navigate("MovieDetails", { movieId }),
    [navigation],
  );

  /**
   * Stable identities for FlatList (a PureComponent): a fresh arrow or a fresh
   * `<RefreshControl>` element per render would force a whole VirtualizedList
   * pass every time a page lands. A pull refetches every loaded page; its
   * spinner is that refetch only, never the next-page fetch, which has the
   * footer below.
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
      />
    ),
    [historyQuery.isRefetching, historyQuery.isFetchingNextPage, historyQuery.refetch],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<WatchHistoryEntry>) => {
      const percent = Math.min(100, Math.max(0, Math.round(item.progress)));
      return (
        <MediaCard
          title={item.movieTitle}
          posterUrl={item.posterUrl}
          progress={percent / 100}
          cornerLabel={`${percent}%`}
          meta={[item.durationMinutes ? formatDuration(item.durationMinutes) : null]}
          width={grid.cellWidth}
          // Tap resumes via the detail screen — the old explicit "resume"
          // button pointed at the exact same destination.
          onPress={() => goToDetails(item.movieId)}
        />
      );
    },
    [grid.cellWidth, goToDetails],
  );

  /**
   * Spinner while the next page streams in under the user's thumb — memoized
   * so its element identity (a FlatList prop) only moves with the flag.
   */
  const listFooter = useMemo(
    () => <ListFooterSpinner visible={historyQuery.isFetchingNextPage} />,
    [historyQuery.isFetchingNextPage],
  );

  return (
    <View style={styles.container}>
      <TopBar title={t.profile.watchHistory} onBack={() => navigation.goBack()} backAccessibilityLabel={t.common.back} />

      {historyQuery.isLoading ? (
        // Two rows of poster cells at the grid's own width and gaps, so the
        // first page lands on top of the placeholders without a shift.
        <View style={styles.skeletonGrid}>
          {Array.from({ length: Math.max(6, grid.columns * 2) }).map((_, index) => (
            <MediaCardSkeleton key={index} width={grid.cellWidth} />
          ))}
        </View>
      ) : historyQuery.isError ? (
        <EmptyState message={t.common.somethingWentWrong} icon="alert-circle-outline" tone={theme.colors.danger} />
      ) : entries.length === 0 ? (
        <EmptyState message={t.profile.empty} icon="time-outline" />
      ) : (
        <FlatList
          key={`history-grid-${grid.columns}`}
          data={entries}
          numColumns={grid.columns}
          keyExtractor={keyExtractor}
          ListFooterComponent={listFooter}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          ItemSeparatorComponent={RowSeparator}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          onEndReachedThreshold={0.6}
          onEndReached={endReached}
          initialNumToRender={9}
          maxToRenderPerBatch={9}
          windowSize={7}
          removeClippedSubviews
          renderItem={renderItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  rowGap: { height: 16 },
  gridContent: {
    paddingTop: theme.spacing.md,
    paddingBottom: theme.layout.tabBarClearance,
  },
  gridRow: { gap: 12, paddingHorizontal: theme.layout.screenPadding },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    rowGap: 16,
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.md,
  },
});
