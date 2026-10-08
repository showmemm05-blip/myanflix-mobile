import { useCallback, useMemo } from "react";
import { FlatList, RefreshControl, ScrollView, StyleSheet, View, type ListRenderItemInfo } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAnimatedRef } from "react-native-reanimated";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { EmptyState } from "@/components/ui/EmptyState";
import { FadeInView } from "@/components/ui/FadeInView";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ThemedText } from "@/components/ui/ThemedText";
import { TopBar } from "@/components/layout/TopBar";
import { GlassBarBackground, GlassScrollFeed, GlassTarget, useGlassBar } from "@/components/layout/GlassBar";
import { Skeleton } from "@/components/common/Skeleton";
import { ActorAvatar, personInitials } from "@/components/common/ActorAvatar";
import { ListFooterSpinner } from "@/components/common/ListFooterSpinner";
import { MediaCard, MediaCardSkeleton } from "@/components/common/MediaCard";
import { movieCardContent } from "@/components/movie/mediaItems";
import {
  LANDSCAPE_CARD_HEIGHT,
  LandscapeCardSkeleton,
  LandscapeRail,
  RailEndTile,
  type LandscapeItem,
} from "@/components/movie/LandscapeRail";
import { useActor } from "@/hooks/useActors";
import { useMoviesInfinite } from "@/hooks/useMovies";
import { useSeriesInfinite } from "@/hooks/useSeries";
import { usePosterGrid } from "@/hooks/usePosterGrid";
import { useDockClearance } from "@/hooks/useDockClearance";
import { LIST_PAGE_SIZE, flattenPages } from "@/hooks/pagination";
import { useLanguage } from "@/localization/LanguageProvider";
import { actorCreditsCaption } from "@/utils/actorCredits";
import { theme, withAlpha } from "@/theme";
import type { MediaDetailParamList } from "@/navigation/types";
import type { Movie } from "@/types/movie";

type Props = NativeStackScreenProps<MediaDetailParamList, "ActorDetails">;

/** ActorDetail.dc.html: a 380pt hero with a 112pt portrait disc. */
const HERO_MIN_HEIGHT = 380;
const PHOTO_SIZE = 112;
/** The "Show more" tile at the end of the series rail. */
const MORE_TILE_WIDTH = 132;

/** Module scope — handed to FlatList, whose cells are PureComponents. */
const keyExtractor = (movie: Movie) => movie.id;
function RowSeparator() {
  return <View style={styles.rowGap} />;
}

/**
 * A person's page (ActorDetail.dc.html): their photo (blurred behind the hero
 * when they have one, a big quiet monogram when they do not), their name and
 * credits, then the SERIES they appear in (on the show's cast or on any
 * episode's) as a 16:9 rail, and the MOVIES as a poster grid. Both are paged
 * from the PUBLIC catalogue queries (`actorIds` on GET /series and GET
 * /movies) — never GET /actors/:id/movies, which 401s a guest, has no paging,
 * and mixes episodes into the films.
 *
 * One scroll: the hero and the series rail are the poster grid's header, so
 * the page never nests a vertical list inside a vertical list. Registered in
 * every tab stack that registers the media detail group, so back always
 * returns to the list that opened it.
 */
export function ActorDetailsScreen({ route, navigation }: Props) {
  const { actorId } = route.params;
  const { t } = useLanguage();
  const grid = usePosterGrid();
  const dockClearance = useDockClearance();
  // The glass bar (components/layout/GlassBar): the back button floats over
  // the hero, transparent at the top, frosted once the page scrolls under it.
  // Two pages can scroll — the poster grid, or the "no titles" page — and
  // whichever is showing feeds the glass.
  const glass = useGlassBar();
  const gridRef = useAnimatedRef<FlatList<Movie>>();
  const emptyRef = useAnimatedRef<ScrollView>();
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

  // Stable, so the memoized poster cells and series cards survive a page landing.
  const goToMovieDetails = useCallback(
    (movie: Movie) => navigation.navigate("MovieDetails", { movieId: movie.id }),
    [navigation],
  );
  const goToSeries = useCallback(
    (seriesId: string) => navigation.navigate("SeriesDetails", { seriesId }),
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

  const seriesCards = useMemo<LandscapeItem[]>(
    () =>
      seriesItems.map((series) => ({
        key: series.id,
        title: series.title,
        imageUrl: series.coverUrl ?? series.posterUrl,
        accessType: series.accessType,
        rating: series.rating > 0 ? series.rating : null,
        meta:
          series.rating > 0
            ? [series.releaseYear]
            : [series.releaseYear, t.series.episodeCount.replace("{n}", String(series.episodeCount))],
        onPress: () => goToSeries(series.id),
      })),
    [seriesItems, goToSeries, t],
  );

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
    // The refetch functions are bound once per observer.
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

  /** "Show more" for the rare person in more than a page of shows — the header cannot end-reach. */
  const seriesMore = useMemo(
    () =>
      seriesQuery.hasNextPage ? (
        <RailEndTile
          label={t.common.showMore}
          icon="chevron-down"
          width={MORE_TILE_WIDTH}
          height={LANDSCAPE_CARD_HEIGHT}
          busy={seriesQuery.isFetchingNextPage}
          onPress={() => {
            if (!seriesQuery.isFetchingNextPage) seriesQuery.fetchNextPage();
          }}
        />
      ) : null,
    // fetchNextPage is bound once per observer.
    [seriesQuery.hasNextPage, seriesQuery.isFetchingNextPage, seriesQuery.fetchNextPage, t],
  );

  const newestFirst = useMemo(
    () => (
      <ThemedText variant="caption" color={theme.colors.textFaint}>
        {t.actors.newestFirst}
      </ThemedText>
    ),
    [t],
  );

  /** The hero — photo, name, credits — at the top of the grid's header so it scrolls away with the rows. */
  const hero = useMemo(
    () => (actor ? <ActorHero name={actor.name} imageUrl={actor.imageUrl} credits={countLabel} /> : null),
    [actor, countLabel],
  );

  /**
   * The grid's header: the hero, then the series rail when there is one, then
   * the Movies heading over the posters, shown only when there ARE posters so
   * a series-only person never gets an empty heading.
   */
  const listHeader = useMemo(
    () => (
      <View>
        {hero}
        {seriesCards.length > 0 && (
          <FadeInView style={styles.seriesSection}>
            <LandscapeRail title={t.search.series} accessory={newestFirst} items={seriesCards} endTile={seriesMore} />
          </FadeInView>
        )}
        {movies.length > 0 && (
          <SectionHeader title={t.search.movies} accessory={newestFirst} style={styles.moviesHeader} />
        )}
      </View>
    ),
    [hero, seriesCards, seriesMore, newestFirst, movies.length, t],
  );

  const isLoading = actorQuery.isLoading || moviesQuery.isLoading || seriesQuery.isLoading;
  const isError = actorQuery.isError || moviesQuery.isError || seriesQuery.isError;

  return (
    <View style={styles.container}>
      <GlassTarget targetRef={glass.blurTarget}>
        {isLoading ? (
          <ActorSkeleton cellWidth={grid.cellWidth} gap={grid.gap} columns={grid.columns} />
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
          // show still gets their series rail above an empty poster grid.
          // Scrolls, and clears the dock: the 380pt hero plus the message is
          // taller than a small phone's window.
          <>
            <ScrollView
              ref={emptyRef}
              contentContainerStyle={[styles.emptyContent, { paddingBottom: dockClearance }]}
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
            >
              {hero}
              <EmptyState message={t.actors.noTitles} icon="film-outline" fill={false} />
            </ScrollView>
            <GlassScrollFeed scrollRef={emptyRef} scrollY={glass.scrollY} />
          </>
        ) : (
          <>
            <FlatList
              ref={gridRef}
              key={`actor-movies-${grid.columns}`}
              data={movies}
              numColumns={grid.columns}
              keyExtractor={keyExtractor}
              ListHeaderComponent={listHeader}
              ListFooterComponent={listFooter}
              contentContainerStyle={{ paddingBottom: dockClearance }}
              columnWrapperStyle={gridRowStyle}
              ItemSeparatorComponent={RowSeparator}
              renderItem={renderMovieItem}
              onEndReachedThreshold={0.6}
              onEndReached={moviesEndReached}
              refreshControl={refreshControl}
              initialNumToRender={grid.columns * 3}
              maxToRenderPerBatch={grid.columns * 3}
              windowSize={5}
              removeClippedSubviews
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
            />
            <GlassScrollFeed scrollRef={gridRef} scrollY={glass.scrollY} />
          </>
        )}
      </GlassTarget>

      <GlassBarBackground scrollY={glass.scrollY} height={glass.barHeight} blurTarget={glass.blurTarget} />
      <TopBar
        transparent
        touchThrough
        onLayout={glass.onBarLayout}
        onBack={() => navigation.goBack()}
        backAccessibilityLabel={t.common.back}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */

/**
 * The person's hero: over their photo (blurred and dimmed) when the catalogue
 * has one, or the avatar tone with a huge quiet monogram when it does not;
 * the 112pt portrait disc, the 34pt name and the credits line on the bottom.
 */
function ActorHero({ name, imageUrl, credits }: { name: string; imageUrl: string | null; credits: string | null }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.hero}>
      <View style={styles.heroArt} pointerEvents="none">
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={[StyleSheet.absoluteFill, styles.heroPhoto]}
            contentFit="cover"
            blurRadius={24}
            transition={220}
            accessible={false}
          />
        ) : (
          <>
            <LinearGradient
              colors={[theme.colors.avatar, theme.colors.background]}
              start={{ x: 0.85, y: 0.1 }}
              end={{ x: 0.2, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <ThemedText weight="black" allowFontScaling={false} style={styles.monogram}>
              {personInitials(name)}
            </ThemedText>
          </>
        )}
        <LinearGradient
          colors={[withAlpha(theme.colors.background, 0), withAlpha(theme.colors.background, 0.8), theme.colors.background]}
          locations={[0, 0.6, 1]}
          style={styles.heroScrim}
        />
      </View>
      {/* Clear of the transparent back button (inset + 8…52), as TitleHero does,
          so a long name at large text that grows the hero never puts the
          portrait under it. */}
      <View style={[styles.heroText, { paddingTop: insets.top + 64 }]}>
        <View style={styles.photoRing}>
          <ActorAvatar name={name} imageUrl={imageUrl} size={PHOTO_SIZE} />
        </View>
        <ThemedText variant="display" accessibilityRole="header" style={styles.name}>
          {name}
        </ThemedText>
        {credits ? (
          <ThemedText variant="body" tabular color={theme.colors.textBody} style={styles.credits}>
            {credits}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

function ActorSkeleton({ cellWidth, gap, columns }: { cellWidth: number; gap: number; columns: number }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.skeletonHero}>
        <Skeleton width="100%" height={HERO_MIN_HEIGHT} radius="xs" style={styles.skeletonHeroBlock} />
        <View style={styles.skeletonHeroText}>
          <Skeleton width={PHOTO_SIZE} height={PHOTO_SIZE} radius="pill" />
          <Skeleton width={180} height={30} radius="sm" style={styles.skeletonGapLg} />
          <Skeleton width={120} height={14} radius="xs" style={styles.skeletonGap} />
        </View>
      </View>
      <Skeleton width={90} height={18} radius="xs" style={styles.skeletonHeading} />
      <View style={styles.skeletonRail}>
        <LandscapeCardSkeleton />
        <LandscapeCardSkeleton />
      </View>
      <Skeleton width={90} height={18} radius="xs" style={styles.skeletonHeading} />
      <View style={[styles.skeletonGrid, { gap }]}>
        {Array.from({ length: Math.max(3, columns * 2) }).map((_, index) => (
          <MediaCardSkeleton key={index} width={cellWidth} metaLines={2} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  hero: { minHeight: HERO_MIN_HEIGHT, justifyContent: "flex-end" },
  heroArt: { ...StyleSheet.absoluteFill, overflow: "hidden", backgroundColor: theme.colors.background },
  heroPhoto: { opacity: 0.55 },
  monogram: {
    position: "absolute",
    right: -24,
    top: 34,
    fontSize: 200,
    lineHeight: 240,
    color: withAlpha(theme.colors.onAvatar, 0.16),
  },
  heroScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 200 },
  heroText: { paddingHorizontal: theme.layout.screenPadding, paddingBottom: 20 },
  photoRing: {
    alignSelf: "flex-start",
    padding: 4,
    borderRadius: PHOTO_SIZE / 2 + 4,
    backgroundColor: theme.colors.background,
    ...theme.shadow.lg,
  },
  name: { marginTop: 16 },
  credits: { marginTop: 4 },
  seriesSection: { marginTop: 28 },
  moviesHeader: { marginTop: 36 },
  rowGap: { height: 20 },
  gridRow: { paddingHorizontal: theme.layout.screenPadding },
  emptyContent: { gap: theme.spacing.md },
  skeletonHero: { height: HERO_MIN_HEIGHT },
  skeletonHeroBlock: { position: "absolute", top: 0, left: 0, borderRadius: 0 },
  skeletonHeroText: { position: "absolute", left: theme.layout.screenPadding, bottom: 20 },
  skeletonGapLg: { marginTop: 20 },
  skeletonGap: { marginTop: 12 },
  skeletonHeading: { marginTop: 32, marginHorizontal: theme.layout.screenPadding },
  skeletonRail: { flexDirection: "row", gap: 10, marginTop: 16, paddingLeft: theme.layout.screenPadding, overflow: "hidden" },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 20,
    marginTop: 16,
    paddingHorizontal: theme.layout.screenPadding,
  },
});
