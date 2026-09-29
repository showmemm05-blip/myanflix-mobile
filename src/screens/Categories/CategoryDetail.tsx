import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, View, StyleSheet, type ListRenderItemInfo } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ThemedText } from "@/components/ui/ThemedText";
import { TopBar } from "@/components/layout/TopBar";
import { Skeleton } from "@/components/common/Skeleton";
import { ListFooterSpinner } from "@/components/common/ListFooterSpinner";
import { MediaCard, MediaCardSkeleton } from "@/components/common/MediaCard";
import { movieCardContent, seriesCardContent } from "@/components/movie/mediaItems";
import { useMoviesInfinite } from "@/hooks/useMovies";
import { useSeriesInfinite } from "@/hooks/useSeries";
import { useCategory } from "@/hooks/useCategories";
import { usePosterGrid } from "@/hooks/usePosterGrid";
import { LIST_PAGE_SIZE, flattenPages } from "@/hooks/pagination";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { MediaDetailParamList } from "@/navigation/types";
import type { Movie } from "@/types/movie";
import type { SeriesListItem } from "@/types/series";

type Props = NativeStackScreenProps<MediaDetailParamList, "CategoryDetail">;
type Tab = "movies" | "series";

/**
 * Module scope on purpose — handed to FlatList, whose cells are PureComponents,
 * so an inline extractor or separator would re-render every visible poster
 * for a change that only touched the segment above the grid.
 */
const keyExtractor = (item: { id: string }) => item.id;
function RowSeparator() {
  return <View style={styles.rowGap} />;
}

/** One genre, browsed as a portrait poster grid — same layout brain as Search. */
export function CategoryDetailScreen({ route, navigation }: Props) {
  const { categoryId } = route.params;
  const { t } = useLanguage();
  const grid = usePosterGrid();
  const [tab, setTab] = useState<Tab>("movies");
  const categoryQuery = useCategory(categoryId);
  // The server filters movies by category, so every page is all this genre.
  const moviesQuery = useMoviesInfinite({ categoryId, limit: LIST_PAGE_SIZE });
  /**
   * Series are NOT filtered by the server — GET /series has no categoryId —
   * so this pages the whole catalogue and keeps the category filter this
   * screen has always applied on the client (`inCategory` below). Only the
   * visible tab asks: the screen opens on "movies", and every reader of
   * seriesQuery is inside a `tab === "series"` branch, so the pages were pure
   * speculation until then.
   */
  const seriesQuery = useSeriesInfinite({ limit: LIST_PAGE_SIZE }, { enabled: tab === "series" });

  const movies = useMemo(() => flattenPages(moviesQuery.data?.pages), [moviesQuery.data]);
  const inCategory = useCallback(
    (series: SeriesListItem) => series.categories.some((c) => c.id === categoryId),
    [categoryId],
  );
  const seriesInCategory = useMemo(
    () => flattenPages(seriesQuery.data?.pages).filter(inCategory),
    [seriesQuery.data, inCategory],
  );

  /**
   * The client-side filter's one blind spot, closed here. FlatList only fires
   * onEndReached again once its content grows, and a page of 30 series that
   * holds none of THIS category grows nothing — the user's thumb would be
   * asking for a page it can never see. So a page that added no rows pulls
   * the next one itself, until one does or the catalogue runs out. The movie
   * grid never needs this: the server pages it already filtered.
   *
   * The `isError` bail-out is what keeps this from becoming a request loop:
   * a next-page fetch that FAILS leaves hasNextPage true and the pages as
   * they were (query-core keeps the old data, flags isFetchNextPageError),
   * and isFetchingNextPage flipping back to false re-runs this effect — which
   * would find the same matchless last page and ask again, forever, each
   * round after React Query's own retries. On error the hunt stops, the error
   * state below takes the screen; switching tabs or reopening the screen
   * re-enables the query and refetches, which is the way back in.
   */
  const seriesPages = seriesQuery.data?.pages;
  useEffect(() => {
    if (tab !== "series" || !seriesPages?.length) return;
    if (seriesQuery.isError) return;
    if (!seriesQuery.hasNextPage || seriesQuery.isFetchingNextPage) return;
    const lastPage = seriesPages[seriesPages.length - 1];
    if (lastPage.items.some(inCategory)) return;
    seriesQuery.fetchNextPage();
  }, [
    tab,
    seriesPages,
    seriesQuery.isError,
    seriesQuery.hasNextPage,
    seriesQuery.isFetchingNextPage,
    seriesQuery.fetchNextPage,
    inCategory,
  ]);

  // Stable, so the memoized poster cells survive a tab switch or a page
  // landing — `navigation` holds its identity for the screen's life.
  const goToMovieDetails = useCallback(
    (movie: Movie) => navigation.navigate("MovieDetails", { movieId: movie.id }),
    [navigation],
  );
  const goToSeriesDetails = useCallback(
    (series: SeriesListItem) => navigation.navigate("SeriesDetails", { seriesId: series.id }),
    [navigation],
  );

  /**
   * "Still hunting": the series pages loaded so far hold nothing of this
   * category but there are more to pull (the effect above is pulling them).
   * Reads as loading rather than as an empty genre, which the next page may
   * well disprove. Never while errored: the effect has stopped pulling, so a
   * skeleton here would be a promise nothing is keeping — the error state
   * must win.
   */
  const seriesHunting = seriesInCategory.length === 0 && seriesQuery.hasNextPage && !seriesQuery.isError;
  const isLoading = tab === "movies" ? moviesQuery.isLoading : seriesQuery.isLoading || seriesHunting;
  const isError = tab === "movies" ? moviesQuery.isError : seriesQuery.isError;
  /**
   * The count line. Movies quote the server's total for the whole category —
   * `pages[0].total`, the honest number, never the rows loaded so far. Series
   * can only count what the client has filtered, which grows as pages land;
   * the server does not know this category's series total.
   */
  const count = tab === "movies" ? (moviesQuery.data?.pages[0]?.total ?? movies.length) : seriesInCategory.length;

  /**
   * Both handed to FlatList as stable identities — it is a PureComponent, so
   * a fresh arrow or a fresh `<RefreshControl>` element per render would force
   * a whole VirtualizedList pass every time a page lands. query-core binds
   * `refetch` and `fetchNextPage` in the observer constructor, so these hold.
   * A pull refetches every loaded page; the spinner is that refetch only,
   * never the next-page fetch, which has its own footer.
   */
  const moviesEndReached = useCallback(() => {
    if (moviesQuery.hasNextPage && !moviesQuery.isFetchingNextPage) moviesQuery.fetchNextPage();
  }, [moviesQuery.hasNextPage, moviesQuery.isFetchingNextPage, moviesQuery.fetchNextPage]);
  const seriesEndReached = useCallback(() => {
    if (seriesQuery.hasNextPage && !seriesQuery.isFetchingNextPage) seriesQuery.fetchNextPage();
  }, [seriesQuery.hasNextPage, seriesQuery.isFetchingNextPage, seriesQuery.fetchNextPage]);

  const moviesRefreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={moviesQuery.isRefetching && !moviesQuery.isFetchingNextPage}
        onRefresh={() => moviesQuery.refetch()}
        tintColor={theme.colors.primary}
        colors={[theme.colors.primary]}
        progressBackgroundColor={theme.colors.surface}
      />
    ),
    [moviesQuery.isRefetching, moviesQuery.isFetchingNextPage, moviesQuery.refetch],
  );
  const seriesRefreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={seriesQuery.isRefetching && !seriesQuery.isFetchingNextPage}
        onRefresh={() => seriesQuery.refetch()}
        tintColor={theme.colors.primary}
        colors={[theme.colors.primary]}
        progressBackgroundColor={theme.colors.surface}
      />
    ),
    [seriesQuery.isRefetching, seriesQuery.isFetchingNextPage, seriesQuery.refetch],
  );

  const renderMovieItem = useCallback(
    ({ item }: ListRenderItemInfo<Movie>) => (
      <MediaCard {...movieCardContent(item)} width={grid.cellWidth} onPress={() => goToMovieDetails(item)} />
    ),
    [grid.cellWidth, goToMovieDetails],
  );
  const renderSeriesItem = useCallback(
    ({ item }: ListRenderItemInfo<SeriesListItem>) => (
      <MediaCard
        {...seriesCardContent(item, t.series.episodeCount.replace("{n}", String(item.episodeCount)))}
        width={grid.cellWidth}
        onPress={() => goToSeriesDetails(item)}
      />
    ),
    [grid.cellWidth, goToSeriesDetails, t],
  );

  const listHeader = useMemo(
    () => (
      <ThemedText variant="caption" tabular style={styles.count}>
        {t.search.resultsCount.replace("{n}", String(count))}
      </ThemedText>
    ),
    [count, t],
  );
  /**
   * Spinner while the next page streams in under the user's thumb. Memoized
   * on the one flag it reads, so the element's identity — which FlatList
   * compares as a prop — only changes when the spinner should appear or go.
   */
  const moviesFooter = useMemo(
    () => <ListFooterSpinner visible={moviesQuery.isFetchingNextPage} />,
    [moviesQuery.isFetchingNextPage],
  );
  const seriesFooter = useMemo(
    () => <ListFooterSpinner visible={seriesQuery.isFetchingNextPage} />,
    [seriesQuery.isFetchingNextPage],
  );

  return (
    <View style={styles.container}>
      <TopBar
        title={categoryQuery.data?.name ?? ""}
        subtitle={categoryQuery.data?.description ?? undefined}
        large
        onBack={() => navigation.goBack()}
        backAccessibilityLabel={t.common.back}
      >
        <View style={styles.segment}>
          <SegmentedControl
            options={[
              { value: "movies", label: t.search.movies, icon: "film-outline" },
              { value: "series", label: t.search.series, icon: "tv-outline" },
            ]}
            value={tab}
            onChange={(v) => setTab(v as Tab)}
          />
        </View>
      </TopBar>

      {isLoading ? (
        // The count line's silhouette above a grid of poster cells, at the
        // grid's own cell width and gaps, so nothing moves when the page lands.
        <View style={styles.gridContent}>
          <View style={styles.count}>
            <Skeleton width={90} height={13} radius="sm" />
          </View>
          <View style={styles.skeletonGrid}>
            {Array.from({ length: Math.max(6, grid.columns * 2) }).map((_, index) => (
              <MediaCardSkeleton key={index} width={grid.cellWidth} />
            ))}
          </View>
        </View>
      ) : isError ? (
        <EmptyState message={t.common.somethingWentWrong} icon="cloud-offline-outline" tone={theme.colors.danger} />
      ) : tab === "movies" ? (
        movies.length === 0 ? (
          <EmptyState message={t.profile.empty} icon="film-outline" />
        ) : (
          <FlatList
            key={`movies-grid-${grid.columns}`}
            data={movies}
            numColumns={grid.columns}
            keyExtractor={keyExtractor}
            ListHeaderComponent={listHeader}
            ListFooterComponent={moviesFooter}
            contentContainerStyle={styles.gridContent}
            columnWrapperStyle={styles.gridRow}
            ItemSeparatorComponent={RowSeparator}
            refreshControl={moviesRefreshControl}
            renderItem={renderMovieItem}
            onEndReachedThreshold={0.6}
            onEndReached={moviesEndReached}
            initialNumToRender={9}
            maxToRenderPerBatch={9}
            windowSize={5}
            removeClippedSubviews
          />
        )
      ) : seriesInCategory.length === 0 ? (
        <EmptyState message={t.profile.empty} icon="tv-outline" />
      ) : (
        <FlatList
          key={`series-grid-${grid.columns}`}
          data={seriesInCategory}
          numColumns={grid.columns}
          keyExtractor={keyExtractor}
          ListHeaderComponent={listHeader}
          ListFooterComponent={seriesFooter}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          ItemSeparatorComponent={RowSeparator}
          refreshControl={seriesRefreshControl}
          renderItem={renderSeriesItem}
          onEndReachedThreshold={0.6}
          onEndReached={seriesEndReached}
          initialNumToRender={9}
          maxToRenderPerBatch={9}
          windowSize={5}
          removeClippedSubviews
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  segment: { paddingHorizontal: theme.layout.screenPadding, paddingBottom: theme.spacing.sm },
  count: { paddingHorizontal: theme.layout.screenPadding, paddingBottom: theme.spacing.sm },
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
  },
});
