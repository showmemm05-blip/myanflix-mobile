import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { ThemedText } from "@/components/ui/ThemedText";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TopBar } from "@/components/layout/TopBar";
import { DetailHero } from "@/components/detail/DetailHero";
import { Synopsis } from "@/components/detail/Synopsis";
import { InfoGrid } from "@/components/detail/InfoGrid";
import { MovieRow } from "@/components/movie/MovieRow";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { useMovie, useMovies } from "@/hooks/useMovies";
import { useSubscriptionStatus } from "@/hooks/useSubscription";
import { useIsInWatchlist, useToggleWatchlist } from "@/hooks/useWatchlist";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatDuration, UNKNOWN_DURATION } from "@/utils/format";
import { hasAccess } from "@/utils/access";
import { theme } from "@/theme";
import type { MediaDetailParamList, MainTabParamList, RootStackParamList } from "@/navigation/types";
import type { Movie } from "@/types/movie";

type Props = CompositeScreenProps<
  NativeStackScreenProps<MediaDetailParamList, "MovieDetails">,
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList>,
    NativeStackScreenProps<RootStackParamList>
  >
>;

export function MovieDetailsScreen({ route, navigation }: Props) {
  const { movieId } = route.params;
  const { t } = useLanguage();
  const movieQuery = useMovie(movieId);
  const subscriptionQuery = useSubscriptionStatus();
  const isFavorite = useIsInWatchlist(movieId);
  const toggleWatchlist = useToggleWatchlist();

  const movie = movieQuery.data;
  const canWatch = !!movie && hasAccess(movie.accessType, subscriptionQuery.data?.isActive ?? false);

  // Don't ASK until the movie's own category is known. This key would
  // otherwise start category-less (the movie hasn't resolved yet on first
  // render, and ["movie", id] is never pre-filled by a list), spending a whole
  // request on the generic top-10 that the guard below has already decided
  // never to show, and then fire a second one when the category arrived.
  const similarCategoryId = movie?.categories[0]?.id;
  const similarQuery = useMovies(
    { categoryId: similarCategoryId, limit: 10 },
    { enabled: !!similarCategoryId },
  );
  // The guard stays. `useMovies` keeps the previous key's data on screen while
  // the next key loads — right for a search field, wrong here: under a "Similar
  // movies" heading, with tappable cards, a held-over list from another key is
  // not a slow row, it is a wrong one. Show nothing until this row's own
  // results arrive.
  const similarMovies = similarQuery.isPlaceholderData
    ? []
    : (similarQuery.data?.items ?? []).filter((m) => m.id !== movieId);

  const handleWatch = () => navigation.getParent()?.navigate("Player", { movieId });
  const handleSubscribe = () => navigation.navigate("Subscribe");
  const handleShare = () => {
    if (movie) Share.share({ message: movie.title }).catch(() => {});
  };
  const goToDetails = (m: Movie) => navigation.push("MovieDetails", { movieId: m.id });

  if (movieQuery.isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (movieQuery.isError || !movie) {
    return (
      <SafeAreaView style={styles.center}>
        <ThemedText variant="muted">{t.common.somethingWentWrong}</ThemedText>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* The comment composer at the foot of this page is the only text input
          on a detail screen — on iOS nothing lifts it clear of the keyboard
          without this. Android resizes the window itself (adjustResize in the
          manifest), so it takes no behavior, same as AuthScreenShell. */}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          // Without this the first tap on "Post" only dismisses the keyboard.
          keyboardShouldPersistTaps="handled"
        >
          <DetailHero
            title={movie.title}
            backdropUrl={movie.coverUrl ?? movie.posterUrl}
            posterUrl={movie.posterUrl}
            accessType={movie.accessType}
            rating={movie.rating}
            meta={[movie.releaseYear, formatDuration(movie.duration), movie.genre]}
          />

          <View style={styles.spine}>
            <View style={styles.ctaRow}>
              <Button
                title={canWatch ? t.movie.watchButton : t.movie.subscribeButton}
                icon={canWatch ? "play" : "diamond"}
                size="lg"
                color={canWatch ? undefined : theme.colors.premium}
                onPress={canWatch ? handleWatch : handleSubscribe}
                style={styles.ctaSolid}
              />
              <IconButton
                icon={isFavorite ? "heart" : "heart-outline"}
                variant={isFavorite ? "soft" : "outline"}
                size="lg"
                color={isFavorite ? theme.colors.primary : undefined}
                accessibilityLabel={isFavorite ? t.movie.removeFromFavorites : t.movie.addToFavorites}
                onPress={() => toggleWatchlist.mutate(movieId)}
              />
              <IconButton
                icon="share-outline"
                variant="outline"
                size="lg"
                accessibilityLabel={t.movie.share}
                onPress={handleShare}
              />
            </View>

            {!canWatch && (
              <View style={styles.lockedNote}>
                <Ionicons name="lock-closed" size={14} color={theme.colors.premium} />
                <ThemedText variant="caption" style={styles.lockedText}>
                  {t.movie.subscriptionLocked}
                </ThemedText>
              </View>
            )}

            {movie.categories.length > 0 && (
              <View style={styles.chips}>
                {movie.categories.map((c) => (
                  <Pill key={c.id} tone="neutral">
                    {c.name}
                  </Pill>
                ))}
              </View>
            )}

            <Synopsis text={movie.description} title={t.movie.synopsis} />

            <View style={styles.infoBlock}>
              <SectionHeader title={t.movie.details} inset={false} />
              <InfoGrid
                items={[
                  { label: t.movie.duration, value: formatDuration(movie.duration) ?? UNKNOWN_DURATION },
                  { label: t.movie.releaseYear, value: String(movie.releaseYear) },
                  { label: t.movie.rating, value: movie.rating.toFixed(1) },
                  { label: t.movie.genre, value: movie.genre },
                  { label: t.movie.language, value: movie.language },
                ]}
              />
            </View>
          </View>

          <View style={styles.similarRow}>
            <MovieRow title={t.movie.similarMovies} movies={similarMovies} onPressMovie={goToDetails} />
          </View>

          <View style={styles.comments}>
            <CommentsSection movieId={movieId} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <TopBar transparent onBack={() => navigation.goBack()} backAccessibilityLabel={t.common.back} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  center: { flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingBottom: theme.layout.tabBarClearance },
  spine: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.lg,
  },
  ctaRow: { flexDirection: "row", gap: theme.spacing.sm, alignItems: "center" },
  ctaSolid: { flex: 1 },
  lockedNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs,
    marginTop: -theme.spacing.sm,
  },
  lockedText: { color: theme.colors.premium },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  infoBlock: { gap: theme.spacing.sm },
  similarRow: { marginTop: theme.spacing.xl },
  comments: { marginTop: theme.spacing.xl },
});
