import { useMemo, useState } from "react";
import { Alert, FlatList, RefreshControl, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { MediaCard, MediaCardSkeleton } from "@/components/common/MediaCard";
import { TopBar } from "@/components/layout/TopBar";
import { movieCardContent, seriesCardContent } from "@/components/movie/mediaItems";
import { useMovies } from "@/hooks/useMovies";
import { useSeriesList } from "@/hooks/useSeries";
import { usePosterGrid } from "@/hooks/usePosterGrid";
import { useToggleWatchlist, useWatchlist } from "@/hooks/useWatchlist";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { LibraryStackParamList } from "@/navigation/types";
import type { Movie } from "@/types/movie";
import type { SeriesListItem } from "@/types/series";

type Props = NativeStackScreenProps<LibraryStackParamList, "Favorites">;
type Tab = "movies" | "series";

export function FavoritesScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const grid = usePosterGrid();
  const [tab, setTab] = useState<Tab>("movies");
  const watchlistQuery = useWatchlist();
  const toggleWatchlist = useToggleWatchlist();
  // No "get movies/series by ids" endpoint — fetch a large page and filter
  // client-side, same pattern as the web app's client-side-only filters.
  const moviesQuery = useMovies({ limit: 100 });
  // Only the visible tab asks — this screen opens on "movies", and every
  // reader of seriesQuery below is inside a `tab === "series"` branch. The key
  // is shared with Search and CategoryDetail, so it is often already cached.
  const seriesQuery = useSeriesList({ limit: 100 }, { enabled: tab === "series" });
  // Presentation-only spinner state for pull-to-refresh.
  const [refreshing, setRefreshing] = useState(false);

  const favoriteMovies = useMemo(() => {
    const ids = new Set(watchlistQuery.data ?? []);
    return (moviesQuery.data?.items ?? []).filter((m) => ids.has(m.id));
  }, [watchlistQuery.data, moviesQuery.data]);

  const favoriteSeries = useMemo(() => {
    const ids = new Set(watchlistQuery.data ?? []);
    return (seriesQuery.data?.items ?? []).filter((s) => ids.has(s.id));
  }, [watchlistQuery.data, seriesQuery.data]);

  // The old card carried a per-row remove button; the portrait card has no
  // trailing control, so the same capability lives on long-press with a
  // confirm — the row disappears as the ids come back.
  const confirmRemove = (id: string, title: string) => {
    Alert.alert(t.movie.removeFromFavorites, title, [
      { text: t.common.cancel, style: "cancel" },
      { text: t.common.remove, style: "destructive", onPress: () => toggleWatchlist.mutate(id) },
    ]);
  };

  // Push onto the LIBRARY stack, not the Home tab's: the detail screens are
  // registered in every stack that can open one (LibraryStackNavigator), so a
  // favourite opens inside this tab and back returns to this grid. The old
  // hop through the parent tab navigator into the Home tab is what used to
  // move the user off Library and onto Home.
  const goToMovieDetails = (movie: Movie) => {
    navigation.navigate("MovieDetails", { movieId: movie.id });
  };
  const goToSeriesDetails = (series: SeriesListItem) => {
    navigation.navigate("SeriesDetails", { seriesId: series.id });
  };

  const isLoading = watchlistQuery.isLoading || (tab === "movies" ? moviesQuery.isLoading : seriesQuery.isLoading);
  const isError = watchlistQuery.isError || (tab === "movies" ? moviesQuery.isError : seriesQuery.isError);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([watchlistQuery.refetch(), tab === "movies" ? moviesQuery.refetch() : seriesQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={handleRefresh}
      tintColor={theme.colors.primary}
      colors={[theme.colors.primary]}
      progressBackgroundColor={theme.colors.surface}
    />
  );

  return (
    <View style={styles.container}>
      <TopBar title={t.profile.favorites} onBack={() => navigation.goBack()} backAccessibilityLabel={t.common.back}>
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
        <View style={styles.skeletonGrid}>
          {Array.from({ length: 6 }).map((_, index) => (
            <MediaCardSkeleton key={index} width={grid.cellWidth} />
          ))}
        </View>
      ) : isError ? (
        <EmptyState message={t.common.somethingWentWrong} icon="alert-circle-outline" tone={theme.colors.danger} />
      ) : tab === "movies" ? (
        favoriteMovies.length === 0 ? (
          <EmptyState message={t.profile.empty} icon="heart-outline" tone={theme.colors.danger} />
        ) : (
          <FlatList
            key={`movies-grid-${grid.columns}`}
            data={favoriteMovies}
            numColumns={grid.columns}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.gridContent}
            columnWrapperStyle={styles.gridRow}
            ItemSeparatorComponent={RowSeparator}
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
            initialNumToRender={9}
            maxToRenderPerBatch={9}
            windowSize={5}
            removeClippedSubviews
            renderItem={({ item }) => (
              <MediaCard
                {...movieCardContent(item)}
                width={grid.cellWidth}
                onPress={() => goToMovieDetails(item)}
                onLongPress={() => confirmRemove(item.id, item.title)}
              />
            )}
          />
        )
      ) : favoriteSeries.length === 0 ? (
        <EmptyState message={t.profile.empty} icon="heart-outline" tone={theme.colors.danger} />
      ) : (
        <FlatList
          key={`series-grid-${grid.columns}`}
          data={favoriteSeries}
          numColumns={grid.columns}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          ItemSeparatorComponent={RowSeparator}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          initialNumToRender={9}
          maxToRenderPerBatch={9}
          windowSize={5}
          removeClippedSubviews
          renderItem={({ item }) => (
            <MediaCard
              {...seriesCardContent(item, t.series.episodeCount.replace("{n}", String(item.episodeCount)))}
              width={grid.cellWidth}
              onPress={() => goToSeriesDetails(item)}
              onLongPress={() => confirmRemove(item.id, item.title)}
            />
          )}
        />
      )}
    </View>
  );
}

function RowSeparator() {
  return <View style={styles.rowGap} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  segment: { paddingHorizontal: theme.layout.screenPadding, paddingBottom: theme.spacing.sm },
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
