import { ActivityIndicator, ScrollView, Share, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
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
import { useMovie, useMovies } from "@/hooks/useMovies";
import { useSubscriptionStatus } from "@/hooks/useSubscription";
import { useIsInWatchlist, useToggleWatchlist } from "@/hooks/useWatchlist";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatDuration } from "@/utils/format";
import { hasAccess } from "@/utils/access";
import { theme } from "@/theme";
import type { HomeStackParamList, MainTabParamList, RootStackParamList } from "@/navigation/types";
import type { Movie } from "@/types/movie";

type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, "MovieDetails">,
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

  const similarQuery = useMovies({ categoryId: movie?.categories[0]?.id, limit: 10 });
  const similarMovies = (similarQuery.data?.items ?? []).filter((m) => m.id !== movieId);

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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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
                { label: t.movie.duration, value: formatDuration(movie.duration) },
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
      </ScrollView>

      <TopBar transparent onBack={() => navigation.goBack()} backAccessibilityLabel={t.common.back} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
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
});
