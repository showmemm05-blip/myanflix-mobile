import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, ScrollView, StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { Chip } from "@/components/common/Chip";
import { Skeleton } from "@/components/common/Skeleton";
import { EpisodeCard, EPISODE_CARD_SIZE, type EpisodeCardSize } from "@/components/player/EpisodeCard";
import { usePlayerEpisodes } from "@/hooks/useSeries";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { PlayerEpisode } from "@/types/series";

/** Space between two cards: 12 in portrait, 14 in the fullscreen overlay (the boards). */
const CARD_GAP: Record<EpisodeCardSize, number> = { regular: 12, large: 14 };
const SKELETON_CARDS = [0, 1, 2];

/** Module scope: a fresh extractor each render defeats FlatList's PureComponent. */
const keyExtractor = (item: PlayerEpisode) => item.id;

interface Props {
  seriesId: string;
  currentEpisodeId: string;
  onSelectEpisode: (episodeId: string) => void;
  size: EpisodeCardSize;
  /** Left/right inset of the chips and the rail, so the first card lines up with the page margin. */
  inset: number;
  /** The portrait section's own "Episodes" heading, with the season's count beside it. */
  showHeading?: boolean;
}

/**
 * The player's episode picker (Player / PlayerEpisodes .dc.html): one chip
 * per season, then a horizontal rail of that season's episodes. Same query
 * and cache as before (`usePlayerEpisodes`), same data, same select handler —
 * only the shape changed, from one long vertical list of every season to a
 * season at a time.
 *
 * It follows what is PLAYING: it opens on the current episode's season with
 * that card at the start of the rail, and when the episode changes (Next
 * episode, a pick, a deep link) it moves to the new one's season and card. A
 * season the viewer chose by hand is kept until then.
 *
 * Virtualized — a long season is dozens of cards, each with a remote still —
 * with exact offsets, since every card has the same width.
 *
 * Memoized because the player re-renders four times a second off the playback
 * tick and every prop here is already stable there.
 */
export const EpisodeBrowser = memo(function EpisodeBrowser({
  seriesId,
  currentEpisodeId,
  onSelectEpisode,
  size,
  inset,
  showHeading,
}: Props) {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const episodesQuery = usePlayerEpisodes(seriesId);
  const listRef = useRef<FlatList<PlayerEpisode>>(null);
  const dims = EPISODE_CARD_SIZE[size];
  const gap = CARD_GAP[size];
  const step = dims.width + gap;

  const seasons = useMemo(() => episodesQuery.data?.seasons ?? [], [episodesQuery.data]);

  /** The season holding what is playing — where the browser opens and returns to. */
  const currentSeason = useMemo(() => {
    const holding = seasons.find((season) => season.episodes.some((e) => e.id === currentEpisodeId));
    return holding?.seasonNumber ?? seasons[0]?.seasonNumber ?? null;
  }, [seasons, currentEpisodeId]);

  /**
   * A season picked by hand, remembered WITH the episode that was playing when
   * it was picked: once a different episode plays, the choice simply stops
   * applying and the browser follows the new episode — no effect, no extra
   * render with the stale season on screen.
   */
  const [chosen, setChosen] = useState<{ season: number; forEpisode: string } | null>(null);
  const selectedSeason =
    chosen && chosen.forEpisode === currentEpisodeId && seasons.some((s) => s.seasonNumber === chosen.season)
      ? chosen.season
      : currentSeason;

  const episodes = useMemo(
    () => seasons.find((season) => season.seasonNumber === selectedSeason)?.episodes ?? [],
    [seasons, selectedSeason],
  );
  const currentIndex = useMemo(
    () => episodes.findIndex((episode) => episode.id === currentEpisodeId),
    [episodes, currentEpisodeId],
  );

  /**
   * Bring the new episode's card to the start of the rail when the episode
   * changes inside the same season. A change of season remounts the rail (it
   * is keyed on the season) and `initialScrollIndex` lands it instead.
   */
  const followedRef = useRef(currentEpisodeId);
  useEffect(() => {
    if (followedRef.current === currentEpisodeId) return;
    followedRef.current = currentEpisodeId;
    if (currentIndex < 0) return;
    listRef.current?.scrollToOffset({ offset: currentIndex * step, animated: !reduceMotion });
  }, [currentEpisodeId, currentIndex, step, reduceMotion]);

  const getItemLayout = useCallback(
    (_: ArrayLike<PlayerEpisode> | null | undefined, index: number) => ({ length: step, offset: step * index, index }),
    [step],
  );

  const renderItem = useCallback(
    // Each cell carries its trailing gap, so every cell is exactly `step`
    // wide and `getItemLayout` stays exact.
    ({ item }: { item: PlayerEpisode }) => (
      <View style={{ width: step, paddingRight: gap }}>
        <EpisodeCard
          episode={item}
          size={size}
          isCurrent={item.id === currentEpisodeId}
          onPress={onSelectEpisode}
        />
      </View>
    ),
    [step, gap, size, currentEpisodeId, onSelectEpisode],
  );

  const countLabel = t.series.episodeCount.replace("{n}", String(episodes.length));

  const heading = showHeading ? (
    <View style={[styles.headingRow, { paddingHorizontal: inset }]}>
      <ThemedText variant="section" accessibilityRole="header" style={styles.headingTitle}>
        {t.series.episodesTitle}
      </ThemedText>
      {!episodesQuery.isLoading && !episodesQuery.isError && episodes.length > 0 && (
        <ThemedText variant="caption" tabular color={theme.colors.textFaint}>
          {countLabel}
        </ThemedText>
      )}
    </View>
  ) : null;

  if (episodesQuery.isLoading) {
    return (
      <View accessible accessibilityRole="progressbar" accessibilityLabel={t.common.loading}>
        {heading}
        <View style={[styles.chipRow, styles.skeletonRow, { paddingHorizontal: inset }]}>
          <Skeleton width={92} height={34} radius="xl" />
          <Skeleton width={92} height={34} radius="xl" />
        </View>
        <View style={[styles.rail, styles.skeletonRail, { paddingHorizontal: inset, gap }]}>
          {SKELETON_CARDS.map((key) => (
            <View key={key} style={{ width: dims.width }}>
              <Skeleton width={dims.width} height={dims.height} radius="lg" />
              <Skeleton width={Math.round(dims.width * 0.7)} height={14} radius="xs" style={styles.skeletonTitle} />
              <Skeleton width={60} height={12} radius="xs" style={styles.skeletonMeta} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (episodesQuery.isError || seasons.every((season) => season.episodes.length === 0)) {
    const isError = episodesQuery.isError;
    return (
      <View>
        {heading}
        <View style={[styles.message, { paddingHorizontal: inset }]} accessibilityRole="text">
          <View style={styles.messageDisc}>
            <Ionicons
              name={isError ? "cloud-offline-outline" : "albums-outline"}
              size={28}
              color={theme.colors.textMuted}
            />
          </View>
          <ThemedText weight="semibold" color={theme.colors.textBody} style={styles.messageText}>
            {isError ? t.series.episodesLoadError : t.series.episodesEmpty}
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View>
      {heading}
      <View style={styles.chipRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.chips, { paddingHorizontal: inset }]}
          // No "tablist" role: the shared Chip speaks as a selected BUTTON,
          // never a tab, and a tab list with no tabs in it is what a screen
          // reader would announce. "Season 2, selected, button" is already
          // the honest reading; the label still names the strip.
          accessibilityLabel={t.series.seasonsStat}
        >
          {seasons.map((season) => (
            <Chip
              key={season.seasonNumber}
              label={t.series.season.replace("{n}", String(season.seasonNumber))}
              selected={season.seasonNumber === selectedSeason}
              onPress={() => setChosen({ season: season.seasonNumber, forEpisode: currentEpisodeId })}
            />
          ))}
          {!showHeading && (
            <ThemedText variant="caption" tabular color={theme.colors.textFaint} style={styles.inlineCount}>
              {countLabel}
            </ThemedText>
          )}
        </ScrollView>
      </View>

      <FlatList
        // A different season is a different list: remounting lands it on its
        // own first card, or on the playing one, with no scroll to animate.
        key={`season-${selectedSeason ?? "none"}`}
        ref={listRef}
        horizontal
        data={episodes}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        initialScrollIndex={currentIndex > 0 ? currentIndex : undefined}
        style={styles.rail}
        contentContainerStyle={{ paddingLeft: inset, paddingRight: inset - gap }}
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        snapToAlignment="start"
        decelerationRate="fast"
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  headingRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    justifyContent: "space-between",
    columnGap: 12,
  },
  headingTitle: { flexShrink: 1 },
  chipRow: { marginTop: 14 },
  chips: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, paddingVertical: 5 },
  inlineCount: { marginLeft: theme.spacing.sm },
  skeletonRow: { flexDirection: "row", gap: theme.spacing.sm, paddingVertical: 5 },
  rail: { marginTop: 14, flexGrow: 0 },
  skeletonRail: { flexDirection: "row", overflow: "hidden" },
  skeletonTitle: { marginTop: 14 },
  skeletonMeta: { marginTop: 8 },
  message: { alignItems: "center", gap: 12, paddingVertical: theme.spacing.lg },
  messageDisc: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceElevated,
  },
  messageText: { textAlign: "center" },
});
