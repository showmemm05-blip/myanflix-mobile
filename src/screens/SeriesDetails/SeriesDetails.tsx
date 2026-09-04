import { useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { ThemedText } from "@/components/ui/ThemedText";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Chip } from "@/components/common/Chip";
import { StatTile } from "@/components/common/StatTile";
import { TopBar } from "@/components/layout/TopBar";
import { SeriesHero, SeriesHeroSkeleton } from "@/components/series/SeriesHero";
import { StorylineCard } from "@/components/series/StorylineCard";
import { SeriesFacts } from "@/components/series/SeriesFacts";
import { EpisodeRow } from "@/components/series/EpisodeRow";
import { SeriesRow } from "@/components/series/SeriesRow";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { useSeries, useEpisodes, useSeriesList } from "@/hooks/useSeries";
import { useSubscriptionStatus } from "@/hooks/useSubscription";
import { useIsInWatchlist, useToggleWatchlist } from "@/hooks/useWatchlist";
import { useLanguage } from "@/localization/LanguageProvider";
import { hasAccess } from "@/utils/access";
import { theme } from "@/theme";
import type { HomeStackParamList, MainTabParamList, RootStackParamList } from "@/navigation/types";
import type { Movie } from "@/types/movie";

type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, "SeriesDetails">,
  CompositeScreenProps<BottomTabScreenProps<MainTabParamList>, NativeStackScreenProps<RootStackParamList>>
>;

/**
 * The series detail page, restructured to the web IA: full-bleed hero, then
 * one spine of CTA → storyline → stats → facts, then the season-chipped
 * episode list, similar series and comments. ONE access gate covers the whole
 * show — episodes are never purchased individually.
 */
export function SeriesDetailsScreen({ route, navigation }: Props) {
  const { seriesId } = route.params;
  const { t } = useLanguage();
  const seriesQuery = useSeries(seriesId);
  const episodesQuery = useEpisodes(seriesId);
  const subscriptionQuery = useSubscriptionStatus();
  const isFavorite = useIsInWatchlist(seriesId);
  const toggleWatchlist = useToggleWatchlist();
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);

  const series = seriesQuery.data;
  const isSubscribed = subscriptionQuery.data?.isActive ?? false;
  const canWatch = !!series && hasAccess(series.accessType, isSubscribed);

  const similarQuery = useSeriesList({ limit: 20 });
  const similarSeries = (similarQuery.data?.items ?? []).filter(
    (s) => s.id !== seriesId && s.categories.some((c) => series?.categories.some((sc) => sc.id === c.id)),
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

  // One translated sentence, shown only once BOTH counts are actually known.
  const seasonSummary =
    !episodesUnknown && episodeCount > 0
      ? t.series.seasonSummary.replace("{s}", String(seasons.length)).replace("{e}", String(episodeCount))
      : null;

  const handleWatch = () => {
    if (firstEpisode) navigation.getParent()?.navigate("Player", { movieId: firstEpisode.id });
  };
  const handleSubscribe = () => navigation.navigate("Subscribe");
  const handleEpisodePress = (episodeId: string) => navigation.getParent()?.navigate("Player", { movieId: episodeId });
  const handleShare = () => {
    if (series) Share.share({ message: series.title }).catch(() => {});
  };
  const goToSeriesDetails = (s: { id: string }) => navigation.push("SeriesDetails", { seriesId: s.id });

  if (seriesQuery.isLoading) {
    return (
      <View style={styles.container}>
        <SeriesHeroSkeleton />
        <View style={styles.loadingBody}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
        <TopBar transparent onBack={() => navigation.goBack()} backAccessibilityLabel={t.common.back} />
      </View>
    );
  }

  if (seriesQuery.isError || !series) {
    return (
      <View style={styles.center}>
        <ThemedText variant="muted">{t.common.somethingWentWrong}</ThemedText>
        <TopBar transparent onBack={() => navigation.goBack()} backAccessibilityLabel={t.common.back} />
      </View>
    );
  }

  // The watch CTA hides only when the episode list is KNOWN to be empty.
  const showWatchCta = canWatch && (episodesUnknown || !!firstEpisode);

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
          <SeriesHero
            title={series.title}
            backdropUrl={series.coverUrl ?? series.posterUrl}
            accessType={series.accessType}
            releaseYear={series.releaseYear}
            language={series.language}
            seasonSummary={seasonSummary}
          />

          <View style={styles.spine}>
            <View style={styles.ctaBlock}>
              <View style={styles.ctaRow}>
                {canWatch ? (
                  showWatchCta && (
                    <Button
                      title={t.series.startWatching}
                      icon="play"
                      size="lg"
                      onPress={handleWatch}
                      loading={episodesPending}
                      disabled={!firstEpisode}
                      style={styles.ctaSolid}
                    />
                  )
                ) : (
                  <Button
                    title={t.series.subscribeToWatch}
                    icon="diamond"
                    size="lg"
                    color={theme.colors.premium}
                    onPress={handleSubscribe}
                    style={styles.ctaSolid}
                  />
                )}
                <IconButton
                  icon={isFavorite ? "heart" : "heart-outline"}
                  variant={isFavorite ? "soft" : "outline"}
                  size="lg"
                  color={isFavorite ? theme.colors.primary : undefined}
                  accessibilityLabel={isFavorite ? t.movie.removeFromFavorites : t.movie.addToFavorites}
                  onPress={() => toggleWatchlist.mutate(seriesId)}
                />
                <IconButton
                  icon="share-outline"
                  variant="outline"
                  size="lg"
                  accessibilityLabel={t.movie.share}
                  onPress={handleShare}
                />
              </View>

              {isSubscribed && series.accessType === "SUBSCRIPTION" && (
                <ThemedText variant="caption" color={theme.colors.textMuted} style={styles.unlockedNote}>
                  {t.series.unlockedNote}
                </ThemedText>
              )}
            </View>

            <StorylineCard genre={series.genre} description={series.description} categories={series.categories} />

            {!episodesUnknown && episodeCount > 0 && (
              <View style={styles.statRow}>
                <StatTile label={t.series.seasonsStat} value={String(seasons.length)} icon="layers-outline" style={styles.statTile} />
                <StatTile label={t.series.episodesStat} value={String(episodeCount)} icon="albums-outline" style={styles.statTile} />
              </View>
            )}

            <SeriesFacts releaseYear={series.releaseYear} language={series.language} genre={series.genre} />

            <View style={styles.episodesSection}>
              <SectionHeader
                title={t.series.episodesTitle}
                eyebrow={activeSeason ? t.series.season.replace("{n}", String(activeSeason.seasonNumber)) : undefined}
                icon="albums-outline"
                inset={false}
                accessory={
                  activeSeason ? (
                    <ThemedText variant="caption" tabular>
                      {t.series.episodeCount.replace("{n}", String(activeSeason.episodes.length))}
                    </ThemedText>
                  ) : undefined
                }
              />

              {seasons.length > 1 && !episodesUnknown && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.seasonChips}
                >
                  {seasons.map((season) => (
                    <Chip
                      key={season.seasonNumber}
                      label={t.series.season.replace("{n}", String(season.seasonNumber))}
                      selected={season.seasonNumber === activeSeason?.seasonNumber}
                      onPress={() => setSelectedSeason(season.seasonNumber)}
                    />
                  ))}
                </ScrollView>
              )}

              {episodesPending ? (
                <View style={styles.episodesState}>
                  <ActivityIndicator color={theme.colors.primary} />
                  <ThemedText variant="muted">{t.common.loading}</ThemedText>
                </View>
              ) : episodesFailed ? (
                <View style={styles.episodesState}>
                  <Ionicons name="cloud-offline-outline" size={26} color={theme.colors.textFaint} />
                  <ThemedText variant="muted">{t.series.episodesLoadError}</ThemedText>
                  <Button
                    title={t.common.retry}
                    variant="outline"
                    icon="refresh"
                    onPress={() => {
                      episodesQuery.refetch();
                    }}
                  />
                </View>
              ) : activeSeason ? (
                <View style={styles.episodeList}>
                  {activeSeason.episodes.map((episode) => (
                    <EpisodeRow
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
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.episodesState}>
                  <Ionicons name="albums-outline" size={26} color={theme.colors.textFaint} />
                  <ThemedText variant="muted">{t.series.episodesEmpty}</ThemedText>
                </View>
              )}
            </View>
          </View>

          <View style={styles.similarRow}>
            <SeriesRow title={t.series.similarSeries} series={similarSeries} onPressSeries={goToSeriesDetails} />
          </View>

          <View style={styles.comments}>
            <CommentsSection seriesId={seriesId} />
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
  loadingBody: { paddingVertical: theme.spacing.xl, alignItems: "center" },
  scrollContent: { paddingBottom: theme.layout.tabBarClearance },
  spine: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  ctaBlock: { gap: theme.spacing.sm },
  ctaRow: { flexDirection: "row", gap: theme.spacing.sm, alignItems: "center" },
  ctaSolid: { flex: 1 },
  unlockedNote: { textAlign: "center" },
  statRow: { flexDirection: "row", gap: theme.spacing.sm },
  statTile: { flex: 1 },
  episodesSection: { gap: theme.spacing.md },
  seasonChips: { flexDirection: "row", gap: theme.spacing.sm, paddingVertical: 2 },
  episodeList: { gap: theme.spacing.sm },
  episodesState: {
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xl,
  },
  similarRow: { marginTop: theme.spacing.xl },
  comments: { marginTop: theme.spacing.xl },
});
