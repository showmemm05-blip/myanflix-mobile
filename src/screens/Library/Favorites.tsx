import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View, type ListRenderItemInfo } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAnimatedRef, useScrollOffset } from "react-native-reanimated";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ThemedText } from "@/components/ui/ThemedText";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Chip } from "@/components/common/Chip";
import { MediaCard, MediaCardSkeleton } from "@/components/common/MediaCard";
import { TopBar } from "@/components/layout/TopBar";
import { GlassBarBackground, GlassTarget, useGlassBar } from "@/components/layout/GlassBar";
import { movieCardContent, seriesCardContent } from "@/components/movie/mediaItems";
import { PageHeading } from "@/components/library/PageHeading";
import { ErrorBlock, PosterStackArt, StateBlock } from "@/components/library/LibraryState";
import {
  FavoritesSortSheet,
  RemoveFavoriteSheet,
  type FavoriteSort,
} from "@/components/library/FavoriteSheets";
import {
  fromMovie,
  fromSeries,
  savedOrderOf,
  useFavoriteCatalog,
  type FavoriteTitle,
} from "@/components/library/favoriteTitles";
import { titlesCountLabel } from "@/components/library/historyFormat";
import { usePosterGrid } from "@/hooks/usePosterGrid";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useToggleWatchlist, useWatchlist } from "@/hooks/useWatchlist";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { ProfileStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<ProfileStackParamList, "Favorites">;
type Tab = "movies" | "series";
type AccessFilter = "all" | "free" | "premium";

/**
 * Client-side view of the saved titles (Favorites.dc.html). "Recently saved"
 * is the reverse of the saved-id order — ids are appended as they are saved
 * and no timestamp exists. Every other sort falls back to it on a tie, so
 * the order is always stable.
 */
function arrange(list: FavoriteTitle[], filter: AccessFilter, sort: FavoriteSort): FavoriteTitle[] {
  const kept =
    filter === "all"
      ? list
      : list.filter((item) => (filter === "premium" ? item.accessType === "SUBSCRIPTION" : item.accessType === "FREE"));
  const byRecent = (a: FavoriteTitle, b: FavoriteTitle) => b.savedOrder - a.savedOrder;
  return [...kept].sort((a, b) => {
    switch (sort) {
      case "title":
        return a.title.localeCompare(b.title) || byRecent(a, b);
      case "year":
        return b.releaseYear - a.releaseYear || byRecent(a, b);
      case "rating":
        // Unrated is stored as 0, so it sorts last on its own.
        return b.rating - a.rating || byRecent(a, b);
      case "recent":
      default:
        return byRecent(a, b);
    }
  });
}

const keyExtractor = (item: FavoriteTitle) => item.id;
function RowSeparator() {
  return <View style={styles.rowGap} />;
}

export function FavoritesScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const grid = usePosterGrid();
  // Opened from Profile, above the tabs, where the dock is hidden — so pad for
  // the phone's own bottom edge, not for the dock (owner, 2026-10-07).
  const bottomClearance = useSafeAreaInsets().bottom + theme.spacing.xl;
  const [tab, setTab] = useState<Tab>("movies");
  const [filter, setFilter] = useState<AccessFilter>("all");
  const [sort, setSort] = useState<FavoriteSort>("recent");
  const [sortOpen, setSortOpen] = useState(false);
  /**
   * The title the remove confirm is about. Kept after the sheet closes so its
   * close animation still shows the poster and name; `removeOpen` is what
   * shows or hides it.
   */
  const [removeTarget, setRemoveTarget] = useState<FavoriteTitle | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const watchlistQuery = useWatchlist();
  const toggleWatchlist = useToggleWatchlist();
  // The saved titles, asked for BY ID (GET /movies?ids= and /series?ids=) —
  // only what is saved is downloaded, however old. Same keys as Profile's
  // "Your library" group (useFavoriteTitles), so coming from Profile the
  // movies are usually already cached. Only the visible tab asks: this screen
  // opens on "movies", and every reader of `seriesQuery` below is inside a
  // `tab === "series"` branch.
  const { movies: moviesQuery, series: seriesQuery } = useFavoriteCatalog(watchlistQuery.data, {
    movies: true,
    series: tab === "series",
  });
  // Presentation-only spinner state for pull-to-refresh.
  const [refreshing, setRefreshing] = useState(false);
  // The glass bar (components/layout/GlassBar): the bar floats over the grid,
  // transparent at the top, frosted once the posters scroll under it.
  const glass = useGlassBar();
  const listRef = useAnimatedRef<FlatList<FavoriteTitle>>();
  useScrollOffset(listRef, glass.scrollY);

  const savedIds = watchlistQuery.data;
  const savedCount = savedIds?.length ?? 0;

  const favoriteMovies = useMemo(() => {
    const order = savedOrderOf(savedIds ?? []);
    return moviesQuery.items.flatMap((m) => {
      const at = order.get(m.id);
      return at === undefined ? [] : [fromMovie(m, at)];
    });
  }, [savedIds, moviesQuery.items]);

  const favoriteSeries = useMemo(() => {
    const order = savedOrderOf(savedIds ?? []);
    return seriesQuery.items.flatMap((s) => {
      const at = order.get(s.id);
      return at === undefined ? [] : [fromSeries(s, at)];
    });
  }, [savedIds, seriesQuery.items]);

  const tabItems = tab === "movies" ? favoriteMovies : favoriteSeries;
  const visible = useMemo(() => arrange(tabItems, filter, sort), [tabItems, filter, sort]);

  // The heart and the long-press both ask first; the cell disappears as the
  // ids come back from the one toggle mutation.
  const askRemove = useCallback((item: FavoriteTitle) => {
    setRemoveTarget(item);
    setRemoveOpen(true);
  }, []);
  const confirmRemove = () => {
    if (removeTarget) toggleWatchlist.mutate(removeTarget.id);
    setRemoveOpen(false);
  };

  // Push onto PROFILE's own stack, not the Home tab's: the detail screens are
  // registered in every stack that can open one (ProfileStackNavigator), so a
  // favourite opens on top of this grid and back returns to it. The old hop
  // through the parent tab navigator into the Home tab is what used to move
  // the user off this page and onto Home.
  const openTitle = useCallback(
    (item: FavoriteTitle) => {
      if (item.kind === "movie") navigation.navigate("MovieDetails", { movieId: item.id });
      else navigation.navigate("SeriesDetails", { seriesId: item.id });
    },
    [navigation],
  );

  // The empty state's way out (Favorites.dc.html → Browse.dc.html): the Browse
  // page, registered on this stack, so back returns to this grid.
  const browse = () => navigation.navigate("Browse");

  const isLoading = watchlistQuery.isLoading || (tab === "movies" ? moviesQuery.isLoading : seriesQuery.isLoading);
  const isError = watchlistQuery.isError || (tab === "movies" ? moviesQuery.isError : seriesQuery.isError);
  const isReady = !isLoading && !isError;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([watchlistQuery.refetch(), tab === "movies" ? moviesQuery.refetch() : seriesQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const sortOptions: { value: FavoriteSort; label: string }[] = [
    { value: "recent", label: t.library.sortRecent },
    { value: "title", label: t.library.sortTitle },
    { value: "year", label: t.library.sortYear },
    { value: "rating", label: t.library.sortRating },
  ];
  const sortLabel = sortOptions.find((option) => option.value === sort)?.label ?? t.library.sortRecent;
  const filters: { value: AccessFilter; label: string }[] = [
    { value: "all", label: t.common.all },
    { value: "free", label: t.movie.free },
    { value: "premium", label: t.movie.premium },
  ];

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<FavoriteTitle>) => {
      const content =
        item.kind === "movie" && item.movie
          ? movieCardContent(item.movie)
          : item.series
            ? seriesCardContent(item.series, t.series.episodeCount.replace("{n}", String(item.series.episodeCount)))
            : null;
      if (!content) return null;
      return (
        <View style={{ width: grid.cellWidth }}>
          <MediaCard
            {...content}
            // The heart owns the poster's top-right corner here, where the
            // quality tag would otherwise sit.
            qualityLabel={null}
            width={grid.cellWidth}
            onPress={() => openTitle(item)}
            onLongPress={() => askRemove(item)}
          />
          <Pressable
            onPress={() => askRemove(item)}
            accessibilityRole="button"
            accessibilityLabel={t.library.removeNamed.replace("{title}", item.title)}
            style={({ pressed }) => [styles.heartButton, pressed && styles.heartPressed]}
          >
            <View style={styles.heartDisc}>
              <Ionicons name="heart" size={16} color={theme.colors.link} />
            </View>
          </Pressable>
        </View>
      );
    },
    [grid.cellWidth, openTitle, askRemove, t],
  );

  const countLine = savedCount > 0 ? `${titlesCountLabel(savedCount, t)} · ${t.library.savedOnPhone}` : t.library.savedOnPhone;

  const listHeader = (
    <View>
      <PageHeading
        title={t.profile.favorites}
        meta={
          <View style={styles.countRow}>
            <Ionicons name="phone-portrait-outline" size={14} color={theme.colors.textFaint} />
            <ThemedText variant="caption" weight="regular" tabular color={theme.colors.textFaint} style={styles.countText}>
              {countLine}
            </ThemedText>
          </View>
        }
      />
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
      {/* Sideways-scrolling, so a long Burmese label never squeezes its neighbours. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.controls}
        accessibilityLabel={t.library.sortAndFilter}
      >
        <Chip
          label={sortLabel}
          icon="swap-vertical"
          trailingIcon="chevron-down"
          onPress={() => setSortOpen(true)}
          accessibilityLabel={`${t.library.sortBy}: ${sortLabel}`}
        />
        <View style={styles.divider} />
        {filters.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={filter === option.value}
            onPress={() => setFilter(option.value)}
          />
        ))}
      </ScrollView>
      <View style={styles.headerEnd} />
    </View>
  );

  const listEmpty = isLoading ? (
    <View style={[styles.skeletonGrid, { columnGap: grid.gap }]} accessibilityLabel={t.common.loading}>
      {Array.from({ length: Math.max(9, grid.columns * 3) }).map((_, index) => (
        <MediaCardSkeleton key={index} width={grid.cellWidth} />
      ))}
    </View>
  ) : isError ? (
    <ErrorBlock message={t.common.somethingWentWrong} style={styles.stateBlock} />
  ) : tabItems.length > 0 ? (
    // Saved titles exist; only the Free/Premium filter hides them all.
    <StateBlock art={<PosterStackArt />} title={t.profile.empty} style={styles.stateBlock} />
  ) : (
    <StateBlock
      art={<PosterStackArt />}
      title={t.profile.empty}
      body={t.library.favoritesEmptyBody}
      actionLabel={t.library.browse}
      onAction={browse}
      style={styles.stateBlock}
    />
  );

  return (
    <View style={styles.container}>
      <GlassTarget targetRef={glass.blurTarget}>
        <FlatList
          ref={listRef}
          // RN cannot change numColumns in place — the list remounts with the grid.
          key={`favorites-grid-${grid.columns}`}
          data={isReady ? visible : []}
          numColumns={grid.columns}
          keyExtractor={keyExtractor}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          // The page starts under the floating bar and scrolls up beneath it.
          contentContainerStyle={[styles.gridContent, { paddingTop: glass.barHeight, paddingBottom: bottomClearance }]}
          columnWrapperStyle={[styles.gridRow, { gap: grid.gap }]}
          ItemSeparatorComponent={RowSeparator}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          refreshControl={
            isReady ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={theme.colors.primary}
                colors={[theme.colors.primary]}
                progressBackgroundColor={theme.colors.surface}
                progressViewOffset={glass.barHeight}
              />
            ) : undefined
          }
          initialNumToRender={9}
          maxToRenderPerBatch={9}
          windowSize={5}
          removeClippedSubviews
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

      <RemoveFavoriteSheet
        visible={removeOpen}
        title={removeTarget?.title ?? ""}
        posterUrl={removeTarget?.posterUrl ?? removeTarget?.coverUrl ?? null}
        onConfirm={confirmRemove}
        onClose={() => setRemoveOpen(false)}
      />
      <FavoritesSortSheet
        visible={sortOpen}
        value={sort}
        options={sortOptions}
        onChange={setSort}
        onClose={() => setSortOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  countRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  countText: { flexShrink: 1 },
  segment: { paddingHorizontal: theme.layout.screenPadding, marginTop: 20 },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.layout.screenPadding,
    // 5pt above and below the 34pt chips puts their 44pt targets inside the row.
    paddingVertical: 5,
    marginTop: 7,
  },
  divider: { width: 1, height: 20, backgroundColor: theme.colors.borderStrong },
  /** 16pt between the controls and the first row of posters. */
  headerEnd: { height: theme.spacing.md },
  gridContent: { flexGrow: 1 },
  gridRow: { paddingHorizontal: theme.layout.screenPadding },
  /** Favorites.dc.html: 20pt between rows of posters. */
  rowGap: { height: 20 },
  heartButton: {
    position: "absolute",
    top: 0,
    right: 0,
    width: theme.layout.minTouch,
    height: theme.layout.minTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  heartPressed: { opacity: 0.7 },
  /** A 30pt dark-glass disc stamped on the art, like the crown chip opposite it. */
  heartDisc: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.artBadge,
  },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 20,
    paddingHorizontal: theme.layout.screenPadding,
  },
  stateBlock: { marginTop: 48 },
});
