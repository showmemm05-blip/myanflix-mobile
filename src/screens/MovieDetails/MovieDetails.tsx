import { useCallback, useMemo, useRef } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAnimatedRef } from "react-native-reanimated";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { ThemedText } from "@/components/ui/ThemedText";
import { FadeInView } from "@/components/ui/FadeInView";
import { TopBar } from "@/components/layout/TopBar";
import { GlassBarBackground, GlassScrollFeed, GlassTarget, useGlassBar } from "@/components/layout/GlassBar";
import { TitleHero, TitleHeroSkeleton, HERO_BODY_OFFSET } from "@/components/detail/TitleHero";
import {
  CategoryChips,
  DetailActions,
  MetaLine,
  StatStrip,
  SubscribeBanner,
  type DetailAction,
  type StatItem,
} from "@/components/detail/DetailBody";
import { ExpandableText } from "@/components/detail/ExpandableText";
import { CastRail } from "@/components/detail/CastRail";
import { MovieRow } from "@/components/movie/MovieRow";
import { LandscapeRail, type LandscapeItem } from "@/components/movie/LandscapeRail";
import { qualityBadgeLabel } from "@/components/movie/mediaItems";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { KeyboardLiftScrollView } from "@/components/common/KeyboardLiftScrollView";
import { useMovie, useMovies } from "@/hooks/useMovies";
import { useSubscriptionStatus } from "@/hooks/useSubscription";
import { useIsInWatchlist, useToggleWatchlist } from "@/hooks/useWatchlist";
import { useDockClearance } from "@/hooks/useDockClearance";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatDuration } from "@/utils/format";
import { AGE_RATING_LABELS } from "@/utils/ageRating";
import { hasAccess } from "@/utils/access";
import { theme } from "@/theme";
import type { MediaDetailParamList, MainTabParamList, RootStackParamList } from "@/navigation/types";
import type { Movie, MovieActorRef } from "@/types/movie";
import type { MovieCategoryRef } from "@/types/category";

type Props = CompositeScreenProps<
  NativeStackScreenProps<MediaDetailParamList, "MovieDetails">,
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList>,
    NativeStackScreenProps<RootStackParamList>
  >
>;

/** The boards' rail poster: three and a peek on a 390pt phone. */
const DETAIL_RAIL_CARD = 112;
/** Room the pinned transparent top bar takes over the page, below the inset. */
const TOP_BAR_ROW = 60;

export function MovieDetailsScreen({ route, navigation }: Props) {
  const { movieId } = route.params;
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const dockClearance = useDockClearance();
  const movieQuery = useMovie(movieId);
  const subscriptionQuery = useSubscriptionStatus();
  const isFavorite = useIsInWatchlist(movieId);
  const toggleWatchlist = useToggleWatchlist();
  // An animated ref, so the glass bar can follow this page's scroll on the UI thread.
  const scrollRef = useAnimatedRef<ScrollView>();
  // The glass bar (components/layout/GlassBar): back and share float over the
  // hero, transparent at the top, frosted once the page scrolls under them.
  const glass = useGlassBar();
  const commentsY = useRef(0);

  const movie = movieQuery.data;
  const canWatch = !!movie && hasAccess(movie.accessType, subscriptionQuery.data?.isActive ?? false);

  // Don't ASK until the movie's own category is known. This key would
  // otherwise start category-less (the movie hasn't resolved yet on first
  // render, and ["movie", id] is never pre-filled by a list), spending a whole
  // request on the generic top-10 that the guard below has already decided
  // never to show, and then fire a second one when the category arrived.
  const similarCategory = movie?.categories[0];
  const similarCategoryId = similarCategory?.id;
  const similarQuery = useMovies(
    { categoryId: similarCategoryId, limit: 10 },
    { enabled: !!similarCategoryId },
  );
  // The guard stays. `useMovies` keeps the previous key's data on screen while
  // the next key loads — right for a search field, wrong here: under a "Similar
  // movies" heading, with tappable cards, a held-over list from another key is
  // not a slow row, it is a wrong one. Show nothing until this row's own
  // results arrive.
  const similarMovies = useMemo(
    () => (similarQuery.isPlaceholderData ? [] : (similarQuery.data?.items ?? []).filter((m) => m.id !== movieId)),
    [similarQuery.isPlaceholderData, similarQuery.data, movieId],
  );

  /**
   * "Recommended for you — Most watched in {category}": the same category,
   * ranked by the server's view counts (sort=mostViewed), minus this title and
   * anything the Similar row already shows, so the two rows never repeat each
   * other. Same wait-for-the-category gate and the same held-over-data guard.
   */
  const recommendedQuery = useMovies(
    { categoryId: similarCategoryId, sort: "mostViewed", limit: 10 },
    { enabled: !!similarCategoryId },
  );
  const recommendedItems = useMemo<LandscapeItem[]>(() => {
    if (recommendedQuery.isPlaceholderData) return [];
    const shown = new Set(similarMovies.map((m) => m.id));
    return (recommendedQuery.data?.items ?? [])
      .filter((m) => m.id !== movieId && !shown.has(m.id))
      .map((m) => ({
        key: m.id,
        title: m.title,
        imageUrl: m.coverUrl ?? m.posterUrl,
        accessType: m.accessType,
        rating: m.rating > 0 ? m.rating : null,
        meta: [m.releaseYear, m.genre],
        onPress: () => navigation.push("MovieDetails", { movieId: m.id }),
      }));
  }, [recommendedQuery.isPlaceholderData, recommendedQuery.data, similarMovies, movieId, navigation]);

  const handleWatch = () => navigation.getParent()?.navigate("Player", { movieId });
  const handleSubscribe = useCallback(() => navigation.navigate("Subscribe"), [navigation]);
  const handleShare = () => {
    if (movie) Share.share({ message: movie.title }).catch(() => {});
  };
  // Stable: the Similar rail's memoized cards take it as a prop.
  const goToDetails = useCallback((m: Movie) => navigation.push("MovieDetails", { movieId: m.id }), [navigation]);
  // Memoized: it is the rail's onPress, which is a FlatList cell prop — a
  // fresh identity every render would rebuild every cell.
  const goToActorDetails = useCallback(
    (actor: MovieActorRef) => navigation.navigate("ActorDetails", { actorId: actor.id }),
    [navigation],
  );
  const goToCategory = useCallback(
    (category: MovieCategoryRef) => navigation.navigate("CategoryDetail", { categoryId: category.id }),
    [navigation],
  );
  const scrollToComments = useCallback(() => {
    scrollRef.current?.scrollTo({ y: Math.max(0, commentsY.current - insets.top - TOP_BAR_ROW), animated: true });
  }, [insets.top]);

  const actions = useMemo<DetailAction[]>(
    () => [
      {
        key: "favorite",
        icon: isFavorite ? "heart" : "heart-outline",
        iconColor: isFavorite ? theme.colors.primary : undefined,
        label: t.movie.favoritesAction,
        accessibilityLabel: isFavorite ? t.movie.removeFromFavorites : t.movie.addToFavorites,
        selected: isFavorite,
        onPress: () => toggleWatchlist.mutate(movieId),
      },
      { key: "comments", icon: "chatbubble-outline", label: t.comments.heading, onPress: scrollToComments },
    ],
    // toggleWatchlist.mutate is stable for the observer's life.
    [isFavorite, t, movieId, scrollToComments, toggleWatchlist.mutate],
  );

  if (movieQuery.isLoading) {
    return (
      <View style={styles.container}>
        <TitleHeroSkeleton />
        <TopBar transparent onBack={() => navigation.goBack()} backAccessibilityLabel={t.common.back} />
      </View>
    );
  }

  if (movieQuery.isError || !movie) {
    return (
      <View style={styles.center}>
        <ThemedText variant="body" color={theme.colors.textBody}>
          {t.common.somethingWentWrong}
        </ThemedText>
        <TopBar transparent onBack={() => navigation.goBack()} backAccessibilityLabel={t.common.back} />
      </View>
    );
  }

  const stats: StatItem[] = [];
  if (movie.rating > 0) stats.push({ key: "rating", label: t.movie.statRating, value: movie.rating.toFixed(1), star: true });
  if (movie.releaseYear) stats.push({ key: "year", label: t.movie.statYear, value: String(movie.releaseYear) });
  const length = formatDuration(movie.duration);
  if (length) stats.push({ key: "length", label: t.movie.statLength, value: length });
  if (movie.ageRating) {
    stats.push({ key: "age", label: t.movie.statAge, value: AGE_RATING_LABELS[movie.ageRating] ?? movie.ageRating });
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
              title={movie.title}
              artUrl={movie.posterUrl ?? movie.coverUrl}
              accessType={movie.accessType}
              kindLabel={t.movie.kindFilm}
              action={
                canWatch
                  ? { kind: "play", onPress: handleWatch, accessibilityLabel: `${movie.title}, ${t.movie.watchButton}` }
                  : { kind: "locked", onPress: handleSubscribe, accessibilityLabel: t.movie.subscriptionLocked }
              }
            />

            <FadeInView style={styles.body}>
              {!canWatch && <SubscribeBanner label={t.movie.subscriptionLocked} onPress={handleSubscribe} />}

              <StatStrip items={stats} />
              <MetaLine quality={qualityBadgeLabel(movie.maxQuality)} parts={[movie.language, movie.genre, movie.country]} />
              {movie.director ? (
                <ThemedText variant="caption" weight="regular" color={theme.colors.textMuted} style={styles.director}>
                  {`${t.movie.director} · ${movie.director}`}
                </ThemedText>
              ) : null}

              <CategoryChips categories={movie.categories} onSelect={goToCategory} />

              <ExpandableText text={movie.description} moreLabel={t.common.showMore} lessLabel={t.common.showLess} />

              <DetailActions actions={actions} />
            </FadeInView>

            {/* Nothing at all when the catalogue carries no cast — no empty
                section, no lone header. */}
            {!!movie.actors?.length && (
              <View style={styles.section}>
                <CastRail title={t.movie.cast} actors={movie.actors} onPress={goToActorDetails} />
              </View>
            )}

            {similarMovies.length > 0 && (
              <View style={styles.section}>
                <MovieRow
                  title={t.movie.similarMovies}
                  movies={similarMovies}
                  onPressMovie={goToDetails}
                  cardWidth={DETAIL_RAIL_CARD}
                />
              </View>
            )}

            {recommendedItems.length > 0 && similarCategory && (
              <View style={styles.section}>
                <LandscapeRail
                  title={t.movie.recommendedTitle}
                  subtitle={t.movie.recommendedSubtitle.replace("{category}", similarCategory.name)}
                  items={recommendedItems}
                />
              </View>
            )}

            <View
              style={styles.section}
              onLayout={(event) => {
                commentsY.current = event.nativeEvent.layout.y;
              }}
            >
              <CommentsSection movieId={movieId} />
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
    padding: theme.layout.screenPadding,
  },
  body: { paddingHorizontal: theme.layout.screenPadding, paddingTop: HERO_BODY_OFFSET },
  director: { marginTop: 6 },
  /** The boards' 36pt between sections. */
  section: { marginTop: 36 },
});
