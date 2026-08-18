import { useMemo, useState } from "react";
import { FlatList, RefreshControl, View, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ThemedText } from "@/components/ui/ThemedText";
import { TopBar } from "@/components/layout/TopBar";
import { MediaCard, MediaCardSkeleton } from "@/components/common/MediaCard";
import { movieCardContent, seriesCardContent } from "@/components/movie/mediaItems";
import { useMovies } from "@/hooks/useMovies";
import { useSeriesList } from "@/hooks/useSeries";
import { useCategory } from "@/hooks/useCategories";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { HomeStackParamList } from "@/navigation/types";
import type { Movie } from "@/types/movie";
import type { SeriesListItem } from "@/types/series";

type Props = NativeStackScreenProps<HomeStackParamList, "CategoryDetail">;
type Tab = "movies" | "series";

/**
 * One genre, browsed as a single column of MediaCards — a 16:9 still at half a
 * phone's width is unreadable, so the grid trades density for legibility.
 */
export function CategoryDetailScreen({ route, navigation }: Props) {
  const { categoryId } = route.params;
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>("movies");
  const categoryQuery = useCategory(categoryId);
  const moviesQuery = useMovies({ categoryId, limit: 50 });
  const seriesQuery = useSeriesList({ limit: 100 });

  const seriesInCategory = useMemo(
    () => (seriesQuery.data?.items ?? []).filter((s) => s.categories.some((c) => c.id === categoryId)),
    [seriesQuery.data, categoryId],
  );

  const goToMovieDetails = (movie: Movie) => navigation.navigate("MovieDetails", { movieId: movie.id });
  const goToSeriesDetails = (series: SeriesListItem) => navigation.navigate("SeriesDetails", { seriesId: series.id });

  const isLoading = tab === "movies" ? moviesQuery.isLoading : seriesQuery.isLoading;
  const isError = tab === "movies" ? moviesQuery.isError : seriesQuery.isError;
  const isRefetching = tab === "movies" ? moviesQuery.isRefetching : seriesQuery.isRefetching;
  const refetch = () => (tab === "movies" ? moviesQuery.refetch() : seriesQuery.refetch());
  const movies = moviesQuery.data?.items ?? [];
  const count = tab === "movies" ? movies.length : seriesInCategory.length;

  const refreshControl = (
    <RefreshControl
      refreshing={isRefetching}
      onRefresh={refetch}
      tintColor={theme.colors.primary}
      colors={[theme.colors.primary]}
      progressBackgroundColor={theme.colors.surface}
    />
  );

  const listHeader = (
    <ThemedText variant="caption" tabular style={styles.count}>
      {t.search.resultsCount.replace("{n}", String(count))}
    </ThemedText>
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
        <View style={styles.skeletonList}>
          {Array.from({ length: 3 }).map((_, index) => (
            <MediaCardSkeleton key={index} />
          ))}
        </View>
      ) : isError ? (
        <EmptyState message={t.common.somethingWentWrong} icon="cloud-offline-outline" tone={theme.colors.danger} />
      ) : tab === "movies" ? (
        movies.length === 0 ? (
          <EmptyState message={t.profile.empty} icon="film-outline" />
        ) : (
          <FlatList
            data={movies}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={listHeader}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            refreshControl={refreshControl}
            renderItem={({ item }) => (
              <MediaCard {...movieCardContent(item)} onPress={() => goToMovieDetails(item)} />
            )}
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={5}
            removeClippedSubviews
          />
        )
      ) : seriesInCategory.length === 0 ? (
        <EmptyState message={t.profile.empty} icon="tv-outline" />
      ) : (
        <FlatList
          data={seriesInCategory}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={listHeader}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={refreshControl}
          renderItem={({ item }) => (
            <MediaCard
              {...seriesCardContent(item, t.series.episodeCount.replace("{n}", String(item.episodeCount)))}
              onPress={() => goToSeriesDetails(item)}
            />
          )}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
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
  count: { paddingBottom: theme.spacing.sm },
  separator: { height: theme.spacing.lg },
  listContent: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.layout.tabBarClearance,
  },
  skeletonList: { paddingHorizontal: theme.layout.screenPadding, paddingTop: theme.spacing.md, gap: theme.spacing.lg },
});
