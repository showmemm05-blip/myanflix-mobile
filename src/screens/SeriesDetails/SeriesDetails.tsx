import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Share, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { ThemedText } from "@/components/ui/ThemedText";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TopBar } from "@/components/layout/TopBar";
import { DetailHero } from "@/components/detail/DetailHero";
import { Synopsis } from "@/components/detail/Synopsis";
import { EpisodeRow } from "@/components/series/EpisodeRow";
import { SeriesRow } from "@/components/series/SeriesRow";
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
  const canWatch = !!series && hasAccess(series.accessType, subscriptionQuery.data?.isActive ?? false);

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
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (seriesQuery.isError || !series) {
    return (
      <View style={styles.center}>
        <ThemedText variant="muted">{t.common.somethingWentWrong}</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <DetailHero
          title={series.title}
          backdropUrl={series.coverUrl ?? series.posterUrl}
          posterUrl={series.posterUrl}
          accessType={series.accessType}
          meta={[
            series.releaseYear,
            episodeCount > 0 ? t.series.episodeCount.replace("{n}", String(episodeCount)) : null,
            series.genre,
          ]}
        />

        <View style={styles.spine}>
          <View style={styles.ctaRow}>
            <Button
              title={
                canWatch
                  ? firstEpisode || episodesUnknown
                    ? t.movie.watchButton
                    : t.series.episodesEmpty
                  : t.movie.subscribeButton
              }
              icon={canWatch && firstEpisode ? "play" : canWatch ? undefined : "diamond"}
              size="lg"
              color={canWatch ? undefined : theme.colors.premium}
              onPress={canWatch ? handleWatch : handleSubscribe}
              loading={canWatch && episodesPending}
              disabled={canWatch && !firstEpisode}
              style={styles.ctaSolid}
            />
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

          {!canWatch && (
            <View style={styles.lockedNote}>
              <Ionicons name="lock-closed" size={14} color={theme.colors.premium} />
              <ThemedText variant="caption" style={styles.lockedText}>
                {t.movie.subscriptionLocked}
              </ThemedText>
            </View>
          )}

          {series.categories.length > 0 && (
            <View style={styles.chips}>
              {series.categories.map((c) => (
                <Pill key={c.id} tone="neutral">
                  {c.name}
                </Pill>
              ))}
            </View>
          )}

          <Synopsis text={series.description} title={t.movie.synopsis} />

          <View style={styles.episodesSection}>
            <SectionHeader
              title={t.series.episodesTitle}
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
              <SegmentedControl
                options={seasons.map((season) => ({
                  value: String(season.seasonNumber),
                  label: t.series.season.replace("{n}", String(season.seasonNumber)),
                }))}
                value={String(activeSeason?.seasonNumber ?? "")}
                onChange={(value) => setSelectedSeason(Number(value))}
                scrollable={seasons.length > 3}
              />
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
                    locked={!canWatch}
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
  episodesSection: { gap: theme.spacing.md },
  episodeList: { gap: theme.spacing.sm },
  episodesState: {
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xl,
  },
  similarRow: { marginTop: theme.spacing.xl },
});
