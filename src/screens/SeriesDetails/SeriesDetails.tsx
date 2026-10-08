import { useCallback, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAnimatedRef } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { ThemedText } from "@/components/ui/ThemedText";
import { Button } from "@/components/ui/Button";
import { FadeInView } from "@/components/ui/FadeInView";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TopBar } from "@/components/layout/TopBar";
import { GlassBarBackground, GlassScrollFeed, GlassTarget, useGlassBar } from "@/components/layout/GlassBar";
import { TitleHero, TitleHeroSkeleton, HERO_BODY_OFFSET, type HeroAction } from "@/components/detail/TitleHero";
import {
  CategoryChips,
  DetailActions,
  MetaLine,
  StatStrip,
  SubscribeBanner,
  UnlockedNote,
  type DetailAction,
  type StatItem,
} from "@/components/detail/DetailBody";
import { ExpandableText } from "@/components/detail/ExpandableText";
import { CastRail } from "@/components/detail/CastRail";
import {
  EPISODE_COMPLETED_THRESHOLD,
  SeasonEpisodeItem,
  SeasonEpisodeSkeleton,
} from "@/components/series/SeasonEpisodeItem";
import { SeriesRow } from "@/components/series/SeriesRow";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { KeyboardLiftScrollView } from "@/components/common/KeyboardLiftScrollView";
import { useSeries, useEpisodes, usePlayerEpisodes } from "@/hooks/useSeries";
import { seriesService } from "@/services/series.service";
import { useSubscriptionStatus } from "@/hooks/useSubscription";
import { useIsInWatchlist, useToggleWatchlist } from "@/hooks/useWatchlist";
import { useDockClearance } from "@/hooks/useDockClearance";
import { useLanguage } from "@/localization/LanguageProvider";
import { hasAccess } from "@/utils/access";
import { theme } from "@/theme";
import type { MediaDetailParamList, MainTabParamList, RootStackParamList } from "@/navigation/types";
import type { Movie, MovieActorRef } from "@/types/movie";
import type { MovieCategoryRef } from "@/types/category";
import type { PaginatedResponse } from "@/types/api";
import type { PlayerEpisodeProgress, SeriesListItem, SeriesQuery } from "@/types/series";

type Props = CompositeScreenProps<
  NativeStackScreenProps<MediaDetailParamList, "SeriesDetails">,
  CompositeScreenProps<BottomTabScreenProps<MainTabParamList>, NativeStackScreenProps<RootStackParamList>>
>;

/** The boards' rail poster: three and a peek on a 390pt phone. */
const DETAIL_RAIL_CARD = 112;
/** Room the pinned transparent top bar takes over the page, below the inset. */
const TOP_BAR_ROW = 60;
const EPISODE_SKELETONS = [0, 1, 2, 3];

/** How many of the show's categories "Similar" asks about, and how many series per category. */
const SIMILAR_CATEGORY_MAX = 3;
const SIMILAR_PER_CATEGORY = 12;
/** The row as long as it used to be at most (the newest 20, minus this show). */
const SIMILAR_MAX = 20;
const SIMILAR_STALE_TIME_MS = 60_000;

/** Module-level so React Query re-runs it only when a category's answer changes. */
function combineSimilarPages(results: UseQueryResult<PaginatedResponse<SeriesListItem>>[]): SeriesListItem[][] {
  return results.map((result) => result.data?.items ?? []);
}

/** The categories' answers as one row: de-duplicated, without this show, newest first. */
function mergeSimilar(pages: SeriesListItem[][], currentId: string): SeriesListItem[] {
  const byId = new Map<string, SeriesListItem>();
  for (const page of pages) {
    for (const item of page) {
      if (item.id !== currentId && !byId.has(item.id)) byId.set(item.id, item);
    }
  }
  return [...byId.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .slice(0, SIMILAR_MAX);
}

/**
 * The series page (SeriesDetail.dc.html): the tall hero with the floating
 * Play, then stats, categories, the storyline and the action row, then the
 * season-tabbed episode list with per-episode progress, the cast, similar
 * series and comments. ONE access gate covers the whole show — episodes are
 * never purchased individually.
 *
 * Progress comes from GET /series/:id/player-episodes (the player's own list,
 * same cache key), asked only when the viewer can watch. With it, Play resumes
 * the first unfinished episode; without it (still loading, failed, or locked)
 * Play keeps the old behaviour and opens S1 E1.
 */
export function SeriesDetailsScreen({ route, navigation }: Props) {
  const { seriesId } = route.params;
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const dockClearance = useDockClearance();
  const seriesQuery = useSeries(seriesId);
  const episodesQuery = useEpisodes(seriesId);
  const subscriptionQuery = useSubscriptionStatus();
  const isFavorite = useIsInWatchlist(seriesId);
  const toggleWatchlist = useToggleWatchlist();
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  // An animated ref, so the glass bar can follow this page's scroll on the UI thread.
  const scrollRef = useAnimatedRef<ScrollView>();
  // The glass bar (components/layout/GlassBar): back and share float over the
  // hero, transparent at the top, frosted once the page scrolls under them.
  const glass = useGlassBar();
  const episodesY = useRef(0);
  const commentsY = useRef(0);

  const series = seriesQuery.data;
  const isSubscribed = subscriptionQuery.data?.isActive ?? false;
  const canWatch = !!series && hasAccess(series.accessType, isSubscribed);

  const progressQuery = usePlayerEpisodes(canWatch ? seriesId : undefined);
  /**
   * Coming back from the player (a full-screen modal over this page) is a
   * focus event: the progress it just saved is pulled again so the bars and
   * the Play target are current. The first focus is the mount, which the
   * query already fetches for, and a locked viewer never asks at all.
   */
  const focusedOnce = useRef(false);
  const progressLive = useRef(false);
  progressLive.current = canWatch;
  const refetchProgress = progressQuery.refetch;
  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }
      if (progressLive.current) refetchProgress();
    }, [refetchProgress]),
  );

  const progressById = useMemo(() => {
    const map = new Map<string, PlayerEpisodeProgress>();
    for (const season of progressQuery.data?.seasons ?? []) {
      for (const episode of season.episodes) {
        if (episode.watchProgress) map.set(episode.id, episode.watchProgress);
      }
    }
    return map;
  }, [progressQuery.data]);

  /**
   * "Similar": series sharing ANY of this show's categories, asked of the
   * server per category (GET /series?categoryId=, at most 3 categories in
   * parallel), merged, de-duplicated, this show dropped, newest first. The
   * old way filtered the 20 newest series on the phone, so once the catalogue
   * grew past a few dozen titles the row was almost always empty.
   */
  const similarCategoryIds = useMemo(
    () => (series?.categories ?? []).slice(0, SIMILAR_CATEGORY_MAX).map((c) => c.id),
    [series?.categories],
  );
  const similarPages = useQueries({
    queries: similarCategoryIds.map((categoryId) => {
      const query: SeriesQuery = { categoryId, limit: SIMILAR_PER_CATEGORY };
      return {
        // useSeriesList's own key shape, so the two share a cache entry.
        queryKey: ["series", query] as const,
        queryFn: ({ signal }: { signal: AbortSignal }) => seriesService.getSeries(query, { signal }),
        staleTime: SIMILAR_STALE_TIME_MS,
      };
    }),
    combine: combineSimilarPages,
  });
  const similarSeries = useMemo(
    () => mergeSimilar(similarPages, seriesId),
    [similarPages, seriesId],
  );

  const seasons = useMemo(() => {
    const episodes = episodesQuery.data ?? [];
    const grouped = new Map<number, Movie[]>();
    for (const ep of episodes) {
      const season = ep.seasonNumber ?? 1;
      const list = grouped.get(season) ?? [];
      list.push(ep);
      grouped.set(season, list);
    }
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a - b)
      .map(([seasonNumber, eps]) => ({
        seasonNumber,
        episodes: eps.sort((a, b) => (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0)),
      }));
  }, [episodesQuery.data]);

  const firstEpisode = seasons[0]?.episodes[0];
  const activeSeason = seasons.find((s) => s.seasonNumber === selectedSeason) ?? seasons[0];
  const episodeCount = seasons.reduce((total, season) => total + season.episodes.length, 0);
  // A pending or failed episode fetch is NOT an empty series — the CTA and the
  // list below have to say so, instead of claiming "no episodes yet".
  const episodesPending = episodesQuery.isLoading;
  const episodesFailed = episodesQuery.isError;
  const episodesUnknown = episodesPending || episodesFailed;

  /**
   * What Play opens. Progress known → the first episode (season order) that
   * is not yet watched to 95%, and "Continue watching" once anything has been
   * started; every episode finished → back to S1 E1. Progress unknown → S1 E1,
   * exactly as before.
   */
  const playTarget = useMemo(() => {
    if (!firstEpisode) return null;
    if (!progressQuery.isSuccess) return { episode: firstEpisode, resuming: false };
    const ordered = seasons.flatMap((season) => season.episodes);
    const percentOf = (episode: Movie) => progressById.get(episode.id)?.progressPercent ?? 0;
    const started = ordered.some((episode) => percentOf(episode) > 0);
    const firstUnfinished = ordered.find((episode) => percentOf(episode) < EPISODE_COMPLETED_THRESHOLD);
    return { episode: firstUnfinished ?? firstEpisode, resuming: started && !!firstUnfinished };
  }, [firstEpisode, progressQuery.isSuccess, seasons, progressById]);

  const handleWatch = () => {
    if (playTarget) navigation.getParent()?.navigate("Player", { movieId: playTarget.episode.id });
  };
  // Stable, because a whole season of `SeasonEpisodeItem`s is rendered in flow
  // below and those rows are memoized: a fresh handler here would defeat the
  // memo on every row for a screen render that changed one thing.
  const handleSubscribe = useCallback(() => navigation.navigate("Subscribe"), [navigation]);
  const handleEpisodePress = useCallback(
    (episodeId: string) => navigation.getParent()?.navigate("Player", { movieId: episodeId }),
    [navigation],
  );
  const handleShare = () => {
    if (series) Share.share({ message: series.title }).catch(() => {});
  };
  const goToSeriesDetails = useCallback(
    (s: { id: string }) => navigation.push("SeriesDetails", { seriesId: s.id }),
    [navigation],
  );
  // Memoized: it is the cast rail's onPress, which is a FlatList cell prop — a
  // fresh identity every render would rebuild every cell (same as MovieDetails).
  const goToActorDetails = useCallback(
    (actor: MovieActorRef) => navigation.navigate("ActorDetails", { actorId: actor.id }),
    [navigation],
  );
  const goToCategory = useCallback(
    (category: MovieCategoryRef) => navigation.navigate("CategoryDetail", { categoryId: category.id }),
    [navigation],
  );
  const scrollTo = useCallback(
    (y: number) => scrollRef.current?.scrollTo({ y: Math.max(0, y - insets.top - TOP_BAR_ROW), animated: true }),
    [insets.top],
  );

  const actions = useMemo<DetailAction[]>(
    () => [
      {
        key: "favorite",
        icon: isFavorite ? "heart" : "heart-outline",
        iconColor: isFavorite ? theme.colors.primary : undefined,
        label: t.movie.favoritesAction,
        accessibilityLabel: isFavorite ? t.movie.removeFromFavorites : t.movie.addToFavorites,
        selected: isFavorite,
        onPress: () => toggleWatchlist.mutate(seriesId),
      },
      { key: "episodes", icon: "list-outline", label: t.series.episodesTitle, onPress: () => scrollTo(episodesY.current) },
      { key: "comments", icon: "chatbubble-outline", label: t.comments.heading, onPress: () => scrollTo(commentsY.current) },
    ],
    // toggleWatchlist.mutate is stable for the observer's life.
    [isFavorite, t, seriesId, scrollTo, toggleWatchlist.mutate],
  );

  if (seriesQuery.isLoading) {
    return (
      <View style={styles.container}>
        <TitleHeroSkeleton />
        <TopBar transparent onBack={() => navigation.goBack()} backAccessibilityLabel={t.common.back} />
      </View>
    );
  }

  if (seriesQuery.isError || !series) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={34} color={theme.colors.textFaint} />
        <ThemedText variant="body" color={theme.colors.textBody} style={styles.centerText}>
          {t.common.somethingWentWrong}
        </ThemedText>
        <TopBar transparent onBack={() => navigation.goBack()} backAccessibilityLabel={t.common.back} />
      </View>
    );
  }

  const episodeCode = (episode: Movie) =>
    episode.episodeNumber != null
      ? t.series.episodeCode
          .replace("{s}", String(episode.seasonNumber ?? 1))
          .replace("{e}", String(episode.episodeNumber))
      : null;
  const playLabel = playTarget?.resuming ? t.series.continueWatching : t.series.startWatching;
  const targetCode = playTarget ? episodeCode(playTarget.episode) : null;

  // The watch control hides only when the episode list is KNOWN to be empty.
  let heroAction: HeroAction | null = null;
  if (!canWatch) {
    heroAction = { kind: "locked", onPress: handleSubscribe, accessibilityLabel: t.series.subscribeToWatch };
  } else if (episodesPending) {
    heroAction = { kind: "busy", accessibilityLabel: t.series.startWatching };
  } else if (episodesFailed || !playTarget) {
    heroAction = episodesFailed ? { kind: "disabled", accessibilityLabel: t.series.startWatching } : null;
  } else {
    const episode = playTarget.episode;
    heroAction = {
      kind: "play",
      onPress: handleWatch,
      accessibilityLabel:
        episode.episodeNumber != null
          ? t.series.playEpisodeA11y
              .replace("{action}", playLabel)
              .replace("{title}", series.title)
              .replace("{s}", String(episode.seasonNumber ?? 1))
              .replace("{e}", String(episode.episodeNumber))
          : `${playLabel}, ${series.title}`,
    };
  }
  const subline = canWatch && !episodesUnknown && playTarget ? [playLabel, targetCode].filter(Boolean).join(" · ") : null;

  const stats: StatItem[] = [];
  if (series.rating > 0) stats.push({ key: "rating", label: t.movie.statRating, value: series.rating.toFixed(1), star: true });
  if (series.releaseYear) stats.push({ key: "year", label: t.movie.statYear, value: String(series.releaseYear) });
  // Both counts only once they are actually known — never a half-truth.
  if (!episodesUnknown && episodeCount > 0) {
    stats.push({ key: "seasons", label: t.series.seasonsStat, value: String(seasons.length) });
    stats.push({ key: "episodes", label: t.series.episodesStat, value: String(episodeCount) });
  }

  return (
    <View style={styles.container}>
      {/* The comment composer at the foot of this page is the only text input
          on a detail screen — on iOS nothing lifts it clear of the keyboard
          without this. Android resizes the window itself (adjustResize in the
          manifest), so it takes no behavior, same as AuthScreenShell. */}
      <GlassTarget targetRef={glass.blurTarget}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <KeyboardLiftScrollView
            ref={scrollRef}
            // Every frame: the glass bar follows this scroll (GlassScrollFeed).
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: dockClearance }}
            // Without this the first tap on "Post" only dismisses the keyboard.
            keyboardShouldPersistTaps="handled"
          >
            <TitleHero
              title={series.title}
              artUrl={series.posterUrl ?? series.coverUrl}
              accessType={series.accessType}
              kindLabel={t.series.kindSeries}
              subline={subline}
              action={heroAction}
              fallbackIcon="tv-outline"
            />

            <FadeInView style={styles.body}>
              {!canWatch && <SubscribeBanner label={t.series.subscribeToWatch} onPress={handleSubscribe} />}
              {isSubscribed && series.accessType === "SUBSCRIPTION" && <UnlockedNote text={t.series.unlockedNote} />}

              <StatStrip items={stats} />
              <MetaLine parts={[series.language, series.genre]} />

              <CategoryChips categories={series.categories} onSelect={goToCategory} />

              <ExpandableText text={series.description} moreLabel={t.common.showMore} lessLabel={t.common.showLess} />

              <DetailActions actions={actions} />
            </FadeInView>

            <View
              style={styles.section}
              onLayout={(event) => {
                episodesY.current = event.nativeEvent.layout.y;
              }}
            >
              <View style={styles.episodesHeader}>
                <ThemedText variant="section" accessibilityRole="header" style={styles.episodesTitle}>
                  {t.series.episodesTitle}
                </ThemedText>
                {!episodesUnknown && activeSeason ? (
                  <ThemedText variant="caption" tabular color={theme.colors.textFaint}>
                    {t.series.episodeCount.replace("{n}", String(activeSeason.episodes.length))}
                  </ThemedText>
                ) : null}
              </View>

              {seasons.length > 1 && !episodesUnknown && (
                <SegmentedControl
                  appearance="underline"
                  scrollable={seasons.length > 4}
                  options={seasons.map((season) => ({
                    value: String(season.seasonNumber),
                    label: t.series.season.replace("{n}", String(season.seasonNumber)),
                  }))}
                  value={String(activeSeason?.seasonNumber ?? seasons[0].seasonNumber)}
                  onChange={(value) => setSelectedSeason(Number(value))}
                  style={styles.seasonTabs}
                />
              )}

              {episodesPending ? (
                <View style={styles.episodeList} accessibilityLabel={t.common.loading} accessible>
                  {EPISODE_SKELETONS.map((key) => (
                    <SeasonEpisodeSkeleton key={key} />
                  ))}
                </View>
              ) : episodesFailed ? (
                <View style={styles.episodesState} accessibilityRole="alert">
                  <Ionicons name="cloud-offline-outline" size={30} color={theme.colors.textFaint} />
                  <ThemedText variant="body" color={theme.colors.textBody} style={styles.centerText}>
                    {t.series.episodesLoadError}
                  </ThemedText>
                  <Button
                    title={t.common.retry}
                    variant="secondary"
                    icon="refresh"
                    onPress={() => {
                      episodesQuery.refetch();
                    }}
                  />
                </View>
              ) : activeSeason ? (
                <View style={styles.episodeList}>
                  {activeSeason.episodes.map((episode) => {
                    const progress = progressById.get(episode.id);
                    return (
                      <SeasonEpisodeItem
                        key={episode.id}
                        episodeId={episode.id}
                        title={episode.title}
                        episodeNumber={episode.episodeNumber}
                        durationMinutes={episode.duration}
                        thumbnailUrl={episode.coverUrl ?? episode.posterUrl}
                        description={episode.description}
                        locked={!canWatch}
                        onLockedPress={handleSubscribe}
                        onPress={handleEpisodePress}
                        progressPercent={progress?.progressPercent ?? null}
                        lastPositionSeconds={progress?.lastPositionSeconds ?? null}
                      />
                    );
                  })}
                </View>
              ) : (
                <View style={styles.episodesState}>
                  <Ionicons name="albums-outline" size={30} color={theme.colors.textFaint} />
                  <ThemedText variant="body" color={theme.colors.textBody} style={styles.centerText}>
                    {t.series.episodesEmpty}
                  </ThemedText>
                </View>
              )}
            </View>

            {/* Nothing at all when the show carries no cast — no empty section,
                no lone header. */}
            {!!series.actors?.length && (
              <View style={styles.section}>
                <CastRail title={t.movie.cast} actors={series.actors} onPress={goToActorDetails} />
              </View>
            )}

            {similarSeries.length > 0 && (
              <View style={styles.section}>
                <SeriesRow
                  title={t.series.similarSeries}
                  series={similarSeries}
                  onPressSeries={goToSeriesDetails}
                  cardWidth={DETAIL_RAIL_CARD}
                />
              </View>
            )}

            <View
              style={styles.section}
              onLayout={(event) => {
                commentsY.current = event.nativeEvent.layout.y;
              }}
            >
              <CommentsSection seriesId={seriesId} />
            </View>
          </KeyboardLiftScrollView>
          <GlassScrollFeed scrollRef={scrollRef} scrollY={glass.scrollY} />
        </KeyboardAvoidingView>
      </GlassTarget>

      <GlassBarBackground scrollY={glass.scrollY} height={glass.barHeight} blurTarget={glass.blurTarget} />
      <TopBar
        transparent
        touchThrough
        onLayout={glass.onBarLayout}
        onBack={() => navigation.goBack()}
        backAccessibilityLabel={t.common.back}
        rightIcon="share-outline"
        onRightPress={handleShare}
        rightAccessibilityLabel={t.movie.share}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  center: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: theme.layout.screenPadding,
  },
  centerText: { textAlign: "center" },
  body: { paddingHorizontal: theme.layout.screenPadding, paddingTop: HERO_BODY_OFFSET },
  /** The boards' 36pt between sections. */
  section: { marginTop: 36 },
  episodesHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: theme.layout.screenPadding,
  },
  episodesTitle: { flexShrink: 1 },
  seasonTabs: { marginTop: 14, marginHorizontal: theme.layout.screenPadding },
  episodeList: { gap: 20, marginTop: 20, paddingHorizontal: theme.layout.screenPadding },
  episodesState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 20,
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.layout.screenPadding,
  },
});
