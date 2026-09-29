import { useCallback, useMemo } from "react";
import { RefreshControl, StyleSheet, View, type ListRenderItemInfo } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ThemedText } from "@/components/ui/ThemedText";
import { TopBar } from "@/components/layout/TopBar";
import { Skeleton } from "@/components/common/Skeleton";
import { ActorAvatar } from "@/components/common/ActorAvatar";
import { ListFooterSpinner } from "@/components/common/ListFooterSpinner";
import { MediaCard, MediaCardSkeleton } from "@/components/common/MediaCard";
import { ListCardSkeleton } from "@/components/search/ListCard";
import { ResultsGrid } from "@/components/search/ResultsGrid";
import { SeriesListCard } from "@/components/search/SeriesListCard";
import { movieCardContent } from "@/components/movie/mediaItems";
import { useActor } from "@/hooks/useActors";
import { useMoviesInfinite } from "@/hooks/useMovies";
import { useSeriesInfinite } from "@/hooks/useSeries";
import { usePosterGrid } from "@/hooks/usePosterGrid";
import { LIST_PAGE_SIZE, flattenPages } from "@/hooks/pagination";
import { useLanguage } from "@/localization/LanguageProvider";
import { actorCreditsCaption } from "@/utils/actorCredits";
import { theme } from "@/theme";
import type { MediaDetailParamList } from "@/navigation/types";
import type { Movie } from "@/types/movie";
import type { SeriesListItem } from "@/types/series";

type Props = NativeStackScreenProps<MediaDetailParamList, "ActorDetails">;

/** The round photo at the top of the page. */
const PHOTO_SIZE = 96;

/** Module scope — handed to FlatList, whose cells are PureComponents (see ResultsGrid). */
const keyExtractor = (movie: Movie) => movie.id;

/**
 * A person's page: their photo, their name, then everything they are in —
 * the SERIES they appear in (on the show's cast or on any episode's) as the
 * search screen's list rows, and above the movie posters the same grid the
 * books tab uses. Both are paged from the PUBLIC catalogue queries
 * (`actorIds` on GET /series and GET /movies) — never GET /actors/:id/movies,
 * which 401s a guest, has no paging, and mixes episodes into the films.
 *
 * One scroll: the hero and the series rows are the poster grid's header, so
 * the page never nests a list inside a list. Registered in every tab stack
 * that registers the media detail group, so back always returns to the list
 * that opened it.
 */
export function ActorDetailsScreen({ route, navigation }: Props) {
  const { actorId } = route.params;
  const { t } = useLanguage();
  // Spacious, like the search grids: a filmography is READ, not scanned.
  const grid = usePosterGrid("spacious");
  const actorQuery = useActor(actorId);
  const moviesQuery = useMoviesInfinite({ actorIds: [actorId], sort: "newest", limit: LIST_PAGE_SIZE });
  const seriesQuery = useSeriesInfinite({ actorIds: [actorId], sort: "newest", limit: LIST_PAGE_SIZE });
  const movies = useMemo(() => flattenPages(moviesQuery.data?.pages), [moviesQuery.data]);
  const seriesItems = useMemo(() => flattenPages(seriesQuery.data?.pages), [seriesQuery.data]);
  const actor = actorQuery.data;

  /**
   * The credits under the name — "1 movie · 1 series", worded by the same
   * helper as the ActorsList cells. Each number is the catalogue's own total
   * for this person once it is in, the actor row's server-side count until
   * then. All backend numbers — never the rows loaded so far.
   */
  const movieTotal = moviesQuery.data?.pages[0]?.total ?? actor?.movieCount;
  const seriesTotal = seriesQuery.data?.pages[0]?.total ?? actor?.seriesCount;
  const countLabel =
    movieTotal === undefined || seriesTotal === undefined
      ? null
      : actorCreditsCaption(t, { movieCount: movieTotal, seriesCount: seriesTotal });

  // Stable, so the memoized poster cells and series rows survive a page landing.
  const goToMovieDetails = useCallback(
    (movie: Movie) => navigation.navigate("MovieDetails", { movieId: movie.id }),
    [navigation],
  );
  const goToSeriesDetails = useCallback(
    (series: SeriesListItem) => navigation.navigate("SeriesDetails", { seriesId: series.id }),
    [navigation],
  );
  const renderMovieItem = useCallback(
    ({ item }: ListRenderItemInfo<Movie>) => (
      <MediaCard
        {...movieCardContent(item, { showGenre: true })}
        width={grid.cellWidth}
        onPress={() => goToMovieDetails(item)}
      />
    ),
    [grid.cellWidth, goToMovieDetails],
  );
  const gridRowStyle = useMemo(() => [styles.gridRow, { gap: grid.gap }], [grid.gap]);

  /**
   * FlatList compares these by identity (PureComponent), so each is built
   * once per change of what it reads — never inline. query-core binds
   * `refetch` and `fetchNextPage` in the observer constructor, so they hold.
   */
  const moviesEndReached = useCallback(() => {
    if (moviesQuery.hasNextPage && !moviesQuery.isFetchingNextPage) moviesQuery.fetchNextPage();
  }, [moviesQuery.hasNextPage, moviesQuery.isFetchingNextPage, moviesQuery.fetchNextPage]);
  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={
          (moviesQuery.isRefetching && !moviesQuery.isFetchingNextPage) ||
          (seriesQuery.isRefetching && !seriesQuery.isFetchingNextPage)
        }
        onRefresh={() => {
          moviesQuery.refetch();
          seriesQuery.refetch();
        }}
        tintColor={theme.colors.primary}
        colors={[theme.colors.primary]}
        progressBackgroundColor={theme.colors.surface}
      />
    ),
    [
      moviesQuery.isRefetching,
      moviesQuery.isFetchingNextPage,
      moviesQuery.refetch,
      seriesQuery.isRefetching,
      seriesQuery.isFetchingNextPage,
      seriesQuery.refetch,
    ],
  );
  const listFooter = useMemo(
    () => <ListFooterSpinner visible={moviesQuery.isFetchingNextPage} />,
    [moviesQuery.isFetchingNextPage],
  );

  /** The hero — photo, name, credits — at the top of the grid's header so it scrolls away with the rows. */
  const hero = useMemo(
    () =>
      actor ? (
        <View style={styles.hero}>
          <ActorAvatar name={actor.name} imageUrl={actor.imageUrl} size={PHOTO_SIZE} />
          <ThemedText variant="title" numberOfLines={2} style={styles.center}>
            {actor.name}
          </ThemedText>
          {countLabel && (
            <ThemedText variant="caption" tabular>
              {countLabel}
            </ThemedText>
          )}
        </View>
      ) : null,
    [actor, countLabel],
  );

  /**
   * The grid's header: the hero, then the series section when there is one
   * (the Search screen's heading and rows, plus a "Show more" for the rare
   * person in more than a page of shows — the header cannot end-reach), then
   * the Movies heading over the posters, shown only when there ARE posters so
   * a series-only person never gets an empty heading.
   */
  const listHeader = useMemo(
    () => (
      <View>
        {hero}
        {seriesItems.length > 0 && (
          <View style={styles.seriesSection}>
            <SectionHeader title={t.search.series} icon="tv-outline" />
            <View style={styles.seriesList}>
              {seriesItems.map((series) => (
                <SeriesListCard key={series.id} series={series} onPress={goToSeriesDetails} />
              ))}
            </View>
            {seriesQuery.hasNextPage && (
              <Button
                title={t.common.showMore}
                variant="outline"
                icon="chevron-down"
                loading={seriesQuery.isFetchingNextPage}
                onPress={() => {
                  if (!seriesQuery.isFetchingNextPage) seriesQuery.fetchNextPage();
                }}
                style={styles.showMore}
              />
            )}
          </View>
        )}
        {movies.length > 0 && (
          <SectionHeader title={t.search.movies} icon="film-outline" style={styles.moviesHeader} />
        )}
      </View>
    ),
    [
      hero,
      seriesItems,
      movies.length,
      goToSeriesDetails,
      seriesQuery.hasNextPage,
      seriesQuery.isFetchingNextPage,
      seriesQuery.fetchNextPage,
      t,
    ],
  );

  const isLoading = actorQuery.isLoading || moviesQuery.isLoading || seriesQuery.isLoading;
  const isError = actorQuery.isError || moviesQuery.isError || seriesQuery.isError;

  return (
    <View style={styles.container}>
      <TopBar onBack={() => navigation.goBack()} backAccessibilityLabel={t.common.back} />

      {isLoading ? (
        // The hero's silhouette, one series row, then poster cells at the
        // grid's own cell width and gaps, so little moves when the page lands.
        <View style={styles.skeletonContent}>
          <View style={styles.hero}>
            <Skeleton width={PHOTO_SIZE} height={PHOTO_SIZE} radius="pill" />
            <Skeleton width={160} height={22} radius="sm" />
            <Skeleton width={72} height={13} radius="sm" />
          </View>
          <View style={[styles.seriesList, styles.skeletonRow]}>
            <ListCardSkeleton />
          </View>
          <View style={[styles.skeletonGrid, { gap: grid.gap, rowGap: theme.spacing.lg }]}>
            {Array.from({ length: Math.max(4, grid.columns * 2) }).map((_, index) => (
              <MediaCardSkeleton key={index} width={grid.cellWidth} metaLines={2} />
            ))}
          </View>
        </View>
      ) : isError ? (
        <EmptyState
          message={t.common.somethingWentWrong}
          icon="cloud-offline-outline"
          tone={theme.colors.danger}
          actionLabel={t.common.retry}
          onAction={() => {
            if (actorQuery.isError) actorQuery.refetch();
            if (moviesQuery.isError) moviesQuery.refetch();
            if (seriesQuery.isError) seriesQuery.refetch();
          }}
        />
      ) : movies.length === 0 && seriesItems.length === 0 ? (
        // Only when BOTH lists are empty — a person credited on nothing but a
        // show still gets their series section above an empty poster grid.
        <View style={styles.emptyContent}>
          {hero}
          <EmptyState message={t.actors.noTitles} icon="film-outline" fill={false} />
        </View>
      ) : (
        <ResultsGrid
          id="actor-movies"
          data={movies}
          columns={grid.columns}
          keyExtractor={keyExtractor}
          header={listHeader}
          footer={listFooter}
          rowStyle={gridRowStyle}
          renderItem={renderMovieItem}
          onEndReached={moviesEndReached}
          refreshControl={refreshControl}
          batch={grid.columns * 3}
          clip
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  hero: {
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
  },
  center: { textAlign: "center" },
  /** The Search screen's section rhythm: heading, then rows a little apart. */
  seriesSection: { gap: theme.spacing.xs, paddingBottom: theme.spacing.lg },
  seriesList: { paddingHorizontal: theme.layout.screenPadding, gap: theme.spacing.sm + 2 },
  showMore: { alignSelf: "center", marginTop: theme.spacing.sm },
  moviesHeader: { paddingBottom: theme.spacing.sm },
  gridRow: { paddingHorizontal: theme.layout.screenPadding },
  skeletonContent: { paddingTop: theme.spacing.md },
  skeletonRow: { paddingBottom: theme.spacing.lg },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: theme.layout.screenPadding,
  },
  emptyContent: { paddingTop: theme.spacing.md, gap: theme.spacing.md },
});
