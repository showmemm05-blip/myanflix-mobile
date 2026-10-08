import { memo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { PressableScale } from "@/components/ui/PressableScale";
import { FadeInView } from "@/components/ui/FadeInView";
import { Skeleton } from "@/components/common/Skeleton";
import { EpisodeBrowser } from "@/components/player/EpisodeBrowser";
import { PlayerGlyph } from "@/components/player/PlayerGlyph";
import { describeEpisode, episodeTag, type OrderedEpisode } from "@/components/player/episodeOrder";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatDuration } from "@/utils/format";
import { theme } from "@/theme";
import type { Movie } from "@/types/movie";

interface Props {
  seriesId: string;
  currentEpisodeId: string;
  onSelectEpisode: (episodeId: string) => void;
  /** The episode playing — undefined for the renders between a swap and its details landing. */
  episode: Movie | undefined;
  /** The episode after this one in the series order; null hides Next episode. */
  nextEpisode: OrderedEpisode | null;
  onNextEpisode: () => void;
  /** The home-indicator inset, so the rail can scroll clear of it. */
  bottomInset: number;
}

/**
 * Everything under the video in portrait for a series episode
 * (Player.dc.html, "series"): which episode this is ("S1 · E2", its title
 * and runtime), the Next-episode control, and the episodes — a chip per
 * season and a rail of that season's cards.
 *
 * The series' own name is not shown: the player never loads the series
 * record (AREA-NOTES, Player). The Next-episode control is new (owner
 * decision 2026-10-02): it plays the episode after this one in the order the
 * episode list returns, through the same select handler the rail uses, and is
 * hidden on the last episode.
 *
 * Memoized because the player re-renders four times a second off the playback
 * tick (VideoPlayer's `timeUpdateEventInterval` is 0.25s) and every prop this
 * takes is already stable there — so none of those ticks reach this panel.
 */
export const EpisodesSection = memo(function EpisodesSection({
  seriesId,
  currentEpisodeId,
  onSelectEpisode,
  episode,
  nextEpisode,
  onNextEpisode,
  bottomInset,
}: Props) {
  const tag = episodeTag(episode?.seasonNumber, episode?.episodeNumber);
  const runtime = formatDuration(episode?.duration);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={{ paddingBottom: bottomInset + theme.spacing.xl }}
      showsVerticalScrollIndicator={false}
    >
      <FadeInView from="bottom" style={styles.info}>
        {episode ? (
          <>
            {tag && (
              <ThemedText variant="caption" weight="bold" tabular color={theme.colors.link}>
                {tag}
              </ThemedText>
            )}
            <ThemedText variant="title" accessibilityRole="header" style={styles.title}>
              {episode.title}
            </ThemedText>
            {runtime && (
              <ThemedText variant="caption" tabular color={theme.colors.textMuted} style={styles.runtime}>
                {runtime}
              </ThemedText>
            )}
          </>
        ) : (
          <View style={styles.infoSkeleton}>
            <Skeleton width={64} height={14} radius="xs" />
            <Skeleton width={220} height={26} radius="sm" />
            <Skeleton width={48} height={14} radius="xs" />
          </View>
        )}

        {nextEpisode && <NextEpisodeButton next={nextEpisode} onPress={onNextEpisode} />}
      </FadeInView>

      <View style={styles.episodes}>
        <EpisodeBrowser
          seriesId={seriesId}
          currentEpisodeId={currentEpisodeId}
          onSelectEpisode={onSelectEpisode}
          size="regular"
          inset={theme.layout.screenPadding}
          showHeading
        />
      </View>
    </ScrollView>
  );
});

function NextEpisodeButton({ next, onPress }: { next: OrderedEpisode; onPress: () => void }) {
  const { t } = useLanguage();
  const description = describeEpisode(next, t.series.episodeFallbackTitle);
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={t.player.nextEpisodeLabel.replace("{title}", description)}
      style={styles.next}
    >
      <View style={styles.nextDisc}>
        <PlayerGlyph name="next" size={18} color={theme.colors.onPlay} />
      </View>
      <View style={styles.nextText}>
        <ThemedText weight="extrabold" style={styles.nextLabel}>
          {t.player.nextEpisode}
        </ThemedText>
        <ThemedText variant="caption" tabular color={theme.colors.textMuted}>
          {description}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textFaint} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  info: { paddingTop: 20, paddingHorizontal: theme.layout.screenPadding },
  title: { marginTop: 4 },
  runtime: { marginTop: 6 },
  infoSkeleton: { gap: 10 },
  next: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.tonalStrong,
  },
  nextDisc: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.play,
  },
  nextText: { flex: 1, gap: 2 },
  nextLabel: { fontSize: 15 },
  episodes: { marginTop: 32 },
});
