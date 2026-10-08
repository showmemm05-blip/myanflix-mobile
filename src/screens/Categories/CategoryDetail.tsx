import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type ListRenderItemInfo,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAnimatedRef, useScrollOffset } from "react-native-reanimated";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ThemedText } from "@/components/ui/ThemedText";
import { TopBar } from "@/components/layout/TopBar";
import { GlassBarBackground, GlassTarget, useGlassBar } from "@/components/layout/GlassBar";
import { Chip } from "@/components/common/Chip";
import { Skeleton } from "@/components/common/Skeleton";
import { ListFooterSpinner } from "@/components/common/ListFooterSpinner";
import { MediaCard, MediaCardSkeleton } from "@/components/common/MediaCard";
import { isRecentlyAdded, movieCardContent, seriesCardContent } from "@/components/movie/mediaItems";
import { LandscapeRail, type LandscapeItem } from "@/components/movie/LandscapeRail";
import { RankedRail } from "@/components/movie/RankedRail";
import {
  createMovieFilters,
  createSeriesFilters,
  durationBucketLabel,
  movieFiltersToQuery,
  ratingFloorLabel,
  seriesFiltersToQuery,
  sortLabel,
  yearPresetLabel,
  type MovieFilters,
  type SeriesFilters,
} from "@/components/search/filters";
import { CategoryFilterSheet } from "@/screens/Categories/CategoryFilterSheet";
import { useMovies, useMoviesInfinite } from "@/hooks/useMovies";
import { useSeriesInfinite } from "@/hooks/useSeries";
import { useCategory } from "@/hooks/useCategories";
import { usePosterGrid } from "@/hooks/usePosterGrid";
import { useDockClearance } from "@/hooks/useDockClearance";
import { LIST_PAGE_SIZE, flattenPages } from "@/hooks/pagination";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatDuration } from "@/utils/format";
import { theme, withAlpha } from "@/theme";
import type { MediaDetailParamList } from "@/navigation/types";
import type { Movie } from "@/types/movie";
import type { SeriesListItem } from "@/types/series";

type Props = NativeStackScreenProps<MediaDetailParamList, "CategoryDetail">;
type Tab = "movies" | "series";
type GridItem = Movie | SeriesListItem;

/** CategoryDetail.dc.html: a 360pt hero on a 390pt board. */
const HERO_RATIO = 360 / 390;
/** The "Top rated" shelf only earns its place with a few rated titles to rank. */
const MIN_RANKED = 3;
const ROW_LIMIT = 10;

/**
 * Module scope on purpose — handed to FlatList, whose cells are PureComponents,
 * so an inline extractor or separator would re-render every visible poster
 * for a change that only touched the header above the grid.
 */
const keyExtractor = (item: { id: string }) => item.id;
function RowSeparator() {
  return <View style={styles.rowGap} />;
}
const isSeries = (item: GridItem): item is SeriesListItem => "episodeCount" in item;

/**
 * One category (CategoryDetail.dc.html): the hero (its newest title's art,
 * the name and description), the Movies / Series switch, the filter chips
 * and sheet, the "Top rated" and "Recently added" shelves, then every title
 * as a portrait poster grid that pages as it scrolls.
 */
export function CategoryDetailScreen({ route, navigation }: Props) {
  const { categoryId } = route.params;
  const { t } = useLanguage();
  const grid = usePosterGrid();
  const dockClearance = useDockClearance();
  const [tab, setTab] = useState<Tab>("movies");
  const [movieFilters, setMovieFilters] = useState<MovieFilters>(createMovieFilters);
  const [seriesFilters, setSeriesFilters] = useState<SeriesFilters>(createSeriesFilters);
  const [sheetOpen, setSheetOpen] = useState(false);
  // The glass bar (components/layout/GlassBar): the back button floats over
  // the hero, transparent at the top, frosted once the page scrolls under it.
  const glass = useGlassBar();
  const listRef = useAnimatedRef<FlatList<GridItem>>();
  useScrollOffset(listRef, glass.scrollY);
  const categoryQuery = useCategory(categoryId);
  const category = categoryQuery.data;

  /**
   * The server filters movies by category, so every page is all this genre.
   * Untouched filters add nothing, so the key is exactly the old
   * `{ categoryId, limit }` until the user picks something.
   */
  const moviesQuery = useMoviesInfinite({ categoryId, limit: LIST_PAGE_SIZE, ...movieFiltersToQuery(movieFilters) });
  /**
   * Series are filtered by category on the server too (GET /series?categoryId=),
   * so every page is all this category and the total is exact. Only the
   * visible tab asks: the screen opens on "movies", and every reader of
   * seriesQuery is inside a `tab === "series"` branch, so the pages were pure
   * speculation until then.
   */
  const seriesQuery = useSeriesInfinite(
    { categoryId, limit: LIST_PAGE_SIZE, ...seriesFiltersToQuery(seriesFilters) },
    { enabled: tab === "series" },
  );
  /** "Recently added" on the Series side: the category's newest — the same key as the grid until a filter is set. */
  const recentSeriesQuery = useSeriesInfinite({ categoryId, limit: LIST_PAGE_SIZE }, { enabled: tab === "series" });

  /** The newest titles (the hero's art and "Recently added") — the key the Browse rows and Similar rows share. */
  const recentMoviesQuery = useMovies({ categoryId, limit: ROW_LIMIT });
  /** "Top rated": the server's rating order inside the category. */
  const topRatedQuery = useMovies({ categoryId, sort: "rating", limit: ROW_LIMIT }, { enabled: tab === "movies" });

  const movies = useMemo(() => flattenPages(moviesQuery.data?.pages), [moviesQuery.data]);
  const seriesInCategory = useMemo(() => flattenPages(seriesQuery.data?.pages), [seriesQuery.data]);

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
   * The list hooks keep the previous key's pages as placeholder data
   * (keepPreviousData), and only a committed filter changes the key here. So
   * placeholder data means "the old filter's grid and total": it reads as
   * loading — skeleton cells, no count — until the new first page lands,
   * instead of standing under the new chip labels as if it answered them.
   */
  const isLoading =
    tab === "movies"
      ? moviesQuery.isLoading || moviesQuery.isPlaceholderData
      : seriesQuery.isLoading || seriesQuery.isPlaceholderData;
  const isError = tab === "movies" ? moviesQuery.isError : seriesQuery.isError;
  /**
   * The count line: the server's total for the whole (filtered) category —
   * `pages[0].total`, the honest number, never the rows loaded so far.
   */
  const count =
    tab === "movies"
      ? (moviesQuery.data?.pages[0]?.total ?? movies.length)
      : (seriesQuery.data?.pages[0]?.total ?? seriesInCategory.length);

  const activeFilterCount =
    tab === "movies"
      ? (movieFilters.yearPreset !== "any" ? 1 : 0) +
        (movieFilters.ratingMin > 0 ? 1 : 0) +
        (movieFilters.durationBucket !== "any" ? 1 : 0)
      : seriesFilters.yearPreset !== "any"
        ? 1
        : 0;
  const filtersTouched =
    tab === "movies"
      ? JSON.stringify(movieFiltersToQuery(movieFilters)) !== "{}"
      : JSON.stringify(seriesFiltersToQuery(seriesFilters)) !== "{}";

  /**
   * FlatList compares these by identity (it is a PureComponent), so each is
   * built once per change of what it reads. query-core binds `refetch` and
   * `fetchNextPage` in the observer constructor, so these hold. A pull
   * refetches every loaded page; the indicator is that refetch only, never
   * the next-page fetch, which has its own footer.
   */
  const onEndReached = useCallback(() => {
    if (tab === "movies") {
      if (moviesQuery.hasNextPage && !moviesQuery.isFetchingNextPage) moviesQuery.fetchNextPage();
    } else if (seriesQuery.hasNextPage && !seriesQuery.isFetchingNextPage) {
      seriesQuery.fetchNextPage();
    }
    // The fetchNextPage functions are bound once per observer.
  }, [
    tab,
    moviesQuery.hasNextPage,
    moviesQuery.isFetchingNextPage,
    moviesQuery.fetchNextPage,
    seriesQuery.hasNextPage,
    seriesQuery.isFetchingNextPage,
    seriesQuery.fetchNextPage,
  ]);

  // A placeholder fetch is a new filter's first page (the skeleton above says
  // so), not a pull — query-core still reports it as isRefetching.
  const refreshing =
    tab === "movies"
      ? moviesQuery.isRefetching && !moviesQuery.isFetchingNextPage && !moviesQuery.isPlaceholderData
      : seriesQuery.isRefetching && !seriesQuery.isFetchingNextPage && !seriesQuery.isPlaceholderData;
  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={() => {
          if (tab === "movies") {
            moviesQuery.refetch();
            recentMoviesQuery.refetch();
            topRatedQuery.refetch();
          } else {
            seriesQuery.refetch();
          }
        }}
        tintColor={theme.colors.primary}
        colors={[theme.colors.primary]}
        progressBackgroundColor={theme.colors.surface}
      />
    ),
    // The refetch functions are bound once per observer.
    [refreshing, tab, moviesQuery.refetch, recentMoviesQuery.refetch, topRatedQuery.refetch, seriesQuery.refetch],
  );

  const fetchingNext = tab === "movies" ? moviesQuery.isFetchingNextPage : seriesQuery.isFetchingNextPage;
  /**
   * Dots while the next page streams in under the user's thumb. Memoized on
   * the one flag it reads, so the element's identity — which FlatList
   * compares as a prop — only changes when the dots should appear or go.
   */
  const listFooter = useMemo(() => <ListFooterSpinner visible={fetchingNext} />, [fetchingNext]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<GridItem>) =>
      isSeries(item) ? (
        <MediaCard
          {...seriesCardContent(item, t.series.episodeCount.replace("{n}", String(item.episodeCount)))}
          width={grid.cellWidth}
          onPress={() => goToSeriesDetails(item)}
        />
      ) : (
        <MediaCard {...movieCardContent(item)} width={grid.cellWidth} onPress={() => goToMovieDetails(item)} />
      ),
    [grid.cellWidth, goToMovieDetails, goToSeriesDetails, t],
  );

  /* ---- the shelves above the grid ---- */
  const recentMovies = recentMoviesQuery.data?.items;
  const rankedMovies = useMemo(
    () => (topRatedQuery.data?.items ?? []).filter((m) => m.rating > 0),
    [topRatedQuery.data],
  );
  const recentItems = useMemo<LandscapeItem[]>(() => {
    if (tab === "movies") {
      return (recentMovies ?? []).map((m) => ({
        key: m.id,
        title: m.title,
        imageUrl: m.coverUrl ?? m.posterUrl,
        accessType: m.accessType,
        isNew: isRecentlyAdded(m.createdAt),
        rating: m.rating > 0 ? m.rating : null,
        meta: m.rating > 0 ? [m.releaseYear] : [m.releaseYear, formatDuration(m.duration)],
        onPress: () => goToMovieDetails(m),
      }));
    }
    return flattenPages(recentSeriesQuery.data?.pages)
      .slice(0, ROW_LIMIT)
      .map((s) => ({
        key: s.id,
        title: s.title,
        imageUrl: s.coverUrl ?? s.posterUrl,
        accessType: s.accessType,
        isNew: isRecentlyAdded(s.createdAt),
        rating: s.rating > 0 ? s.rating : null,
        meta:
          s.rating > 0
            ? [s.releaseYear]
            : [s.releaseYear, t.series.episodeCount.replace("{n}", String(s.episodeCount))],
        onPress: () => goToSeriesDetails(s),
      }));
  }, [tab, recentMovies, recentSeriesQuery.data, goToMovieDetails, goToSeriesDetails, t]);

  const heroArt = (() => {
    const movie = recentMovies?.[0];
    if (movie) return movie.posterUrl ?? movie.coverUrl;
    const series = seriesInCategory[0];
    return series ? (series.posterUrl ?? series.coverUrl) : null;
  })();

  const filterChips = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterRail}
      style={styles.filterRailBox}
    >
      <Chip
        label={activeFilterCount > 0 ? `${t.search.filterButton} · ${activeFilterCount}` : t.search.filterButton}
        icon="options-outline"
        selected
        onPress={() => setSheetOpen(true)}
      />
      <Chip
        label={sortLabel(t, tab === "movies" ? movieFilters.sort : seriesFilters.sort)}
        icon="swap-vertical"
        trailingIcon="chevron-down"
        onPress={() => setSheetOpen(true)}
      />
      <Chip
        label={yearPresetLabel(t, tab === "movies" ? movieFilters.yearPreset : seriesFilters.yearPreset)}
        trailingIcon="chevron-down"
        onPress={() => setSheetOpen(true)}
      />
      {tab === "movies" && (
        <>
          <Chip
            label={movieFilters.ratingMin > 0 ? ratingFloorLabel(t, movieFilters.ratingMin) : t.search.filterRating}
            trailingIcon="chevron-down"
            onPress={() => setSheetOpen(true)}
          />
          <Chip
            label={
              movieFilters.durationBucket !== "any"
                ? durationBucketLabel(t, movieFilters.durationBucket)
                : t.search.filterDuration
            }
            trailingIcon="chevron-down"
            onPress={() => setSheetOpen(true)}
          />
        </>
      )}
    </ScrollView>
  );

  const gridTitle = (tab === "movies" ? t.browse.allMovies : t.browse.allSeries).replace("{name}", category?.name ?? "");

  const listHeader = (
    <View>
      {categoryQuery.isLoading ? (
        <CategoryHeroSkeleton />
      ) : (
        <CategoryHero
          name={category?.name ?? ""}
          description={category?.description ?? null}
          artUrl={heroArt}
          overline={t.browse.categoryOverline}
        />
      )}

      <View style={styles.segment}>
        <SegmentedControl
          wrap
          options={[
            { value: "movies", label: t.search.movies, icon: "film-outline" },
            { value: "series", label: t.search.series, icon: "tv-outline" },
          ]}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
        />
      </View>
      {filterChips}

      {tab === "movies" && rankedMovies.length >= MIN_RANKED && (
        <View style={styles.shelf}>
          <RankedRail title={t.browse.topRated} movies={rankedMovies} onPress={goToMovieDetails} />
        </View>
      )}
      {recentItems.length > 0 && (
        <View style={styles.shelf}>
          <LandscapeRail title={t.browse.recentlyAdded} items={recentItems} />
        </View>
      )}

      <View style={styles.gridHeading}>
        <ThemedText variant="section" accessibilityRole="header" style={styles.gridTitle}>
          {gridTitle}
        </ThemedText>
        {!isLoading && !isError && (
          <ThemedText variant="caption" tabular color={theme.colors.textFaint}>
            {t.search.resultsCount.replace("{n}", String(count))}
          </ThemedText>
        )}
      </View>

      {isLoading ? (
        // Poster cells at the grid's own cell width and gaps, so nothing
        // moves when the page lands.
        <View style={[styles.skeletonGrid, { gap: grid.gap }]}>
          {Array.from({ length: Math.max(6, grid.columns * 3) }).map((_, index) => (
            <MediaCardSkeleton key={index} width={grid.cellWidth} />
          ))}
        </View>
      ) : isError ? (
        <EmptyState
          message={t.common.somethingWentWrong}
          icon="cloud-offline-outline"
          tone={theme.colors.danger}
          fill={false}
          style={styles.state}
        />
      ) : (tab === "movies" ? movies.length : seriesInCategory.length) === 0 ? (
        filtersTouched ? (
          <EmptyState
            message={t.search.noResultsFiltersBody}
            icon="options-outline"
            actionLabel={t.search.clearFilters}
            onAction={() => (tab === "movies" ? setMovieFilters(createMovieFilters()) : setSeriesFilters(createSeriesFilters()))}
            fill={false}
            style={styles.state}
          />
        ) : (
          <EmptyState
            message={t.profile.empty}
            icon={tab === "movies" ? "film-outline" : "tv-outline"}
            fill={false}
            style={styles.state}
          />
        )
      ) : null}
    </View>
  );

  const data: GridItem[] = isLoading || isError ? [] : tab === "movies" ? movies : seriesInCategory;
  const gridRowStyle = useMemo(() => [styles.gridRow, { gap: grid.gap }], [grid.gap]);

  return (
    <View style={styles.container}>
      <GlassTarget targetRef={glass.blurTarget}>
        <FlatList
          ref={listRef}
          // RN cannot change `numColumns` in place — the list has to remount when
          // a rotation re-flows the grid. The tab is NOT in the key: switching
          // Movies / Series keeps the page where it is.
          key={`category-grid-${grid.columns}`}
          data={data}
          numColumns={grid.columns}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          contentContainerStyle={{ paddingBottom: dockClearance }}
          columnWrapperStyle={gridRowStyle}
          ItemSeparatorComponent={RowSeparator}
          refreshControl={refreshControl}
          onEndReachedThreshold={0.6}
          onEndReached={onEndReached}
          initialNumToRender={9}
          maxToRenderPerBatch={9}
          windowSize={5}
          removeClippedSubviews
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
        />
      </GlassTarget>

      <GlassBarBackground scrollY={glass.scrollY} height={glass.barHeight} blurTarget={glass.blurTarget} />
      <TopBar
        transparent
        touchThrough
        onLayout={glass.onBarLayout}
        onBack={() => navigation.goBack()}
        backAccessibilityLabel={t.common.back}
      />

      <CategoryFilterSheet
        visible={sheetOpen}
        tab={tab}
        categoryId={categoryId}
        movieFilters={movieFilters}
        seriesFilters={seriesFilters}
        onApplyMovies={setMovieFilters}
        onApplySeries={setSeriesFilters}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */

function useCategoryHeroHeight() {
  const { width, height } = useWindowDimensions();
  return Math.round(Math.max(300, Math.min(width * HERO_RATIO, height * 0.5)));
}

/**
 * The category's banner: its newest title's art under the board's two
 * scrims, the crimson "CATEGORY" overline, the name and two lines of
 * description. A min height, so a long Burmese name grows it downwards.
 */
function CategoryHero({
  name,
  description,
  artUrl,
  overline,
}: {
  name: string;
  description: string | null;
  artUrl: string | null;
  overline: string;
}) {
  const heroHeight = useCategoryHeroHeight();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.hero, { minHeight: heroHeight }]}>
      <View style={styles.heroArt} pointerEvents="none">
        {artUrl ? (
          <Image source={{ uri: artUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={220} accessible={false} />
        ) : null}
        <LinearGradient
          colors={[withAlpha(theme.colors.background, 0.7), withAlpha(theme.colors.background, 0)]}
          style={[styles.heroTopScrim, { height: insets.top + 120 }]}
        />
        <LinearGradient
          colors={[withAlpha(theme.colors.background, 0), withAlpha(theme.colors.background, 0.84), theme.colors.background]}
          locations={[0, 0.58, 1]}
          style={[styles.heroBottomScrim, { height: Math.min(240, heroHeight * 0.7) }]}
        />
      </View>
      <View style={[styles.heroText, { paddingTop: insets.top + 64 }]}>
        <ThemedText variant="overline" color={theme.colors.link}>
          {overline.toUpperCase()}
        </ThemedText>
        <ThemedText variant="display" accessibilityRole="header" style={styles.heroName}>
          {name}
        </ThemedText>
        {description ? (
          <ThemedText variant="body" color={theme.colors.textBody} numberOfLines={2} style={styles.heroDescription}>
            {description}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

function CategoryHeroSkeleton() {
  const heroHeight = useCategoryHeroHeight();
  return (
    <View style={{ height: heroHeight }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Skeleton width="100%" height={heroHeight} radius="xs" style={styles.heroSkeleton} />
      <View style={styles.heroSkeletonText}>
        <Skeleton width={80} height={12} radius="xs" />
        <Skeleton width="52%" height={32} radius="sm" style={styles.heroSkeletonGap} />
        <Skeleton width="86%" height={14} radius="xs" style={styles.heroSkeletonGap} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  hero: { justifyContent: "flex-end" },
  heroArt: { ...StyleSheet.absoluteFill, overflow: "hidden", backgroundColor: theme.colors.surface },
  heroTopScrim: { position: "absolute", top: 0, left: 0, right: 0 },
  heroBottomScrim: { position: "absolute", left: 0, right: 0, bottom: 0 },
  heroText: { paddingHorizontal: theme.layout.screenPadding, paddingBottom: 20 },
  heroName: { marginTop: 6 },
  heroDescription: { marginTop: 6 },
  heroSkeleton: { position: "absolute", top: 0, left: 0, borderRadius: 0 },
  heroSkeletonText: { position: "absolute", left: theme.layout.screenPadding, right: theme.layout.screenPadding, bottom: 20 },
  heroSkeletonGap: { marginTop: 12 },
  segment: { paddingHorizontal: theme.layout.screenPadding, paddingTop: theme.spacing.md },
  filterRailBox: { marginTop: 12 },
  filterRail: { gap: theme.spacing.sm, paddingHorizontal: theme.layout.screenPadding, paddingVertical: 5 },
  shelf: { marginTop: theme.spacing.xl },
  gridHeading: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 36,
    marginBottom: 14,
    paddingHorizontal: theme.layout.screenPadding,
  },
  gridTitle: { flexShrink: 1 },
  rowGap: { height: 20 },
  gridRow: { paddingHorizontal: theme.layout.screenPadding },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 20,
    paddingHorizontal: theme.layout.screenPadding,
  },
  state: { paddingVertical: theme.spacing.xl },
});
