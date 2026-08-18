import { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { MediaCard, MediaCardSkeleton } from "@/components/common/MediaCard";
import { TopBar } from "@/components/layout/TopBar";
import { useMovies } from "@/hooks/useMovies";
import { useSeriesList } from "@/hooks/useSeries";
import { useToggleWatchlist, useWatchlist } from "@/hooks/useWatchlist";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatDuration } from "@/utils/format";
import { theme } from "@/theme";
import type { LibraryStackParamList } from "@/navigation/types";
import type { Movie } from "@/types/movie";
import type { SeriesListItem } from "@/types/series";

type Props = NativeStackScreenProps<LibraryStackParamList, "Favorites">;
type Tab = "movies" | "series";

export function FavoritesScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>("movies");
  const watchlistQuery = useWatchlist();
  const toggleWatchlist = useToggleWatchlist();
  // No "get movies/series by ids" endpoint — fetch a large page and filter
  // client-side, same pattern as the web app's client-side-only filters.
  const moviesQuery = useMovies({ limit: 100 });
  const seriesQuery = useSeriesList({ limit: 100 });
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

  // Un-favourite in place, same as the web watchlist's per-card remove control:
  // one tap, no confirmation, the row disappears as the ids come back.
  const removeFavorite = (id: string) => toggleWatchlist.mutate(id);

  const goToMovieDetails = (movie: Movie) => {
    navigation.getParent()?.navigate("HomeTab", { screen: "MovieDetails", params: { movieId: movie.id } });
  };
  const goToSeriesDetails = (series: SeriesListItem) => {
    navigation.getParent()?.navigate("HomeTab", { screen: "SeriesDetails", params: { seriesId: series.id } });
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
        <View style={styles.skeletonList}>
          <MediaCardSkeleton />
          <MediaCardSkeleton />
        </View>
      ) : isError ? (
        <EmptyState message={t.common.somethingWentWrong} icon="alert-circle-outline" tone={theme.colors.danger} />
      ) : tab === "movies" ? (
        favoriteMovies.length === 0 ? (
          <EmptyState message={t.profile.empty} icon="heart-outline" tone={theme.colors.danger} />
        ) : (
          <FlatList
            data={favoriteMovies}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={5}
            removeClippedSubviews
            renderItem={({ item }) => (
              <MediaCard
                title={item.title}
                imageUrl={item.coverUrl ?? item.posterUrl}
                posterUrl={item.posterUrl}
                accessType={item.accessType}
                rating={item.rating}
                meta={[item.releaseYear, item.duration ? formatDuration(item.duration) : null, item.genre]}
                onPress={() => goToMovieDetails(item)}
                action={{
                  icon: "heart-dislike",
                  label: t.movie.removeFromFavorites,
                  onPress: () => removeFavorite(item.id),
                  color: theme.colors.danger,
                }}
              />
            )}
          />
        )
      ) : favoriteSeries.length === 0 ? (
        <EmptyState message={t.profile.empty} icon="heart-outline" tone={theme.colors.danger} />
      ) : (
        <FlatList
          data={favoriteSeries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={5}
          removeClippedSubviews
          renderItem={({ item }) => (
            <MediaCard
              title={item.title}
              imageUrl={item.coverUrl ?? item.posterUrl}
              posterUrl={item.posterUrl}
              accessType={item.accessType}
              meta={[
                item.releaseYear,
                t.series.episodeCount.replace("{n}", String(item.episodeCount)),
                item.genre,
              ]}
              onPress={() => goToSeriesDetails(item)}
              action={{
                icon: "heart-dislike",
                label: t.movie.removeFromFavorites,
                onPress: () => removeFavorite(item.id),
                color: theme.colors.danger,
              }}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  segment: { paddingHorizontal: theme.layout.screenPadding, paddingBottom: theme.spacing.sm },
  skeletonList: { paddingHorizontal: theme.layout.screenPadding, paddingTop: theme.spacing.md, gap: theme.spacing.lg },
  // One column: a 16:9 dossier card at half width is unreadable on a phone.
  listContent: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.layout.tabBarClearance,
    gap: theme.spacing.lg,
  },
});
