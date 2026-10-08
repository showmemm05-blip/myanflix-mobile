import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { PressableScale } from "@/components/ui/PressableScale";
import { ProgressTrack } from "@/components/common/ProgressTrack";
import { PlayerGlyph } from "@/components/player/PlayerGlyph";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatDuration, UNKNOWN_DURATION } from "@/utils/format";
import { theme } from "@/theme";
import type { PlayerEpisode } from "@/types/series";

/** The rail's watched rule, the same one the episode row and the resume use. */
const COMPLETED_THRESHOLD = 95;

/** Card geometry per place: the portrait rail and sheet, or the fullscreen overlay. */
export const EPISODE_CARD_SIZE = {
  regular: { width: 232, height: 130, number: 34, numberLine: 38, title: 14, titleLine: 20 },
  large: { width: 256, height: 144, number: 38, numberLine: 40, title: 15, titleLine: 22 },
} as const;
export type EpisodeCardSize = keyof typeof EPISODE_CARD_SIZE;

/**
 * The boards' tight leading, plus the Marquee "+4" when the text is Burmese:
 * a fixed line height here overrides ThemedText's own bonus, and stacked
 * Myanmar marks would clip without it.
 */
const MYANMAR_SCRIPT = /[\u1000-\u109F\uAA60-\uAA7F]/;
function leading(text: string, base: number): number {
  return MYANMAR_SCRIPT.test(text) ? base + 4 : base;
}

/** Scrim under the big numeral so it reads on any still (the boards' art has none to fight). */
const NUMBER_SCRIM = ["rgba(8,8,11,0)", "rgba(8,8,11,0.62)"] as const;

interface Props {
  episode: PlayerEpisode;
  size: EpisodeCardSize;
  /** The episode playing now — dimmed still, crimson "Now Playing" tag. */
  isCurrent: boolean;
  onPress: (episodeId: string) => void;
}

/**
 * One episode in the player's rail (Player / PlayerEpisodes .dc.html): a
 * 16:9 still (the episode's thumbnail, else its poster) with the episode
 * number set large on it, the title and runtime underneath. It carries the
 * rail's states — Now Playing (dim + crimson tag, plus a crimson ring in the
 * fullscreen overlay), watched (green check, "Completed") and part-watched
 * (a crimson progress line) — from the progress the episode list already
 * returns.
 *
 * Memoized: the player re-renders four times a second off the playback tick,
 * and every prop here is either a structurally shared record, a primitive or
 * the player's stable select handler.
 */
export const EpisodeCard = memo(function EpisodeCard({ episode, size, isCurrent, onPress }: Props) {
  const { t } = useLanguage();
  const dims = EPISODE_CARD_SIZE[size];
  const progressPercent = episode.watchProgress?.progressPercent ?? 0;
  const isCompleted = progressPercent >= COMPLETED_THRESHOLD && !isCurrent;
  const isInProgress = progressPercent > 0 && progressPercent < COMPLETED_THRESHOLD;
  const still = episode.thumbnailUrl ?? episode.posterUrl;
  const number = episode.episodeNumber != null ? String(episode.episodeNumber) : null;
  const displayTitle =
    episode.title.trim().length > 0
      ? episode.title
      : t.series.episodeFallbackTitle.replace("{n}", number ?? "—");
  const runtime = formatDuration(episode.duration) ?? UNKNOWN_DURATION;

  const spoken = [
    number
      ? t.player.episodeCardLabel.replace("{n}", number).replace("{title}", displayTitle)
      : displayTitle,
    formatDuration(episode.duration),
    isCurrent ? t.series.nowPlaying : null,
    isCompleted ? t.series.completed : null,
    isInProgress ? t.movie.watchedPercent.replace("{n}", String(Math.round(progressPercent))) : null,
  ]
    .filter(Boolean)
    .join(t.player.listSeparator);

  return (
    <PressableScale
      onPress={() => onPress(episode.id)}
      accessibilityLabel={spoken}
      style={{ width: dims.width }}
    >
      <View
        style={[
          styles.still,
          { width: dims.width, height: dims.height },
          isCurrent && size === "large" && styles.stillCurrentRing,
        ]}
      >
        {still ? (
          <Image
            source={{ uri: still }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={160}
            // Scrolled in and out of a horizontal rail; the disk-only default
            // would re-decode each still as it comes back.
            cachePolicy="memory-disk"
            accessible={false}
          />
        ) : (
          <View style={styles.fallback}>
            <Ionicons name="film-outline" size={22} color={theme.colors.textFaint} />
          </View>
        )}

        <LinearGradient colors={NUMBER_SCRIM} style={styles.scrim} pointerEvents="none" />
        {isCurrent && <View style={[StyleSheet.absoluteFill, styles.currentDim]} pointerEvents="none" />}

        {number && (
          <ThemedText
            weight="black"
            tabular
            allowFontScaling={false}
            style={[
              styles.number,
              { fontSize: dims.number, lineHeight: dims.numberLine },
              isInProgress ? styles.numberAboveBar : null,
            ]}
          >
            {number}
          </ThemedText>
        )}

        {isCurrent && (
          <View style={styles.nowPlaying}>
            <PlayerGlyph name="nowPlaying" size={12} color={theme.colors.onPrimary} />
            <ThemedText
              weight="extrabold"
              color={theme.colors.onPrimary}
              style={[styles.nowPlayingText, { lineHeight: leading(t.series.nowPlaying, 16) }]}
            >
              {t.series.nowPlaying}
            </ThemedText>
          </View>
        )}

        {isCompleted && (
          <View style={styles.doneBadge}>
            <PlayerGlyph name="check" size={13} color={theme.colors.onFinance} />
          </View>
        )}

        {isInProgress && (
          <View style={styles.progress} pointerEvents="none">
            <ProgressTrack progress={progressPercent / 100} height={3} />
          </View>
        )}
      </View>

      <ThemedText
        weight="bold"
        numberOfLines={3}
        style={[styles.title, { fontSize: dims.title, lineHeight: leading(displayTitle, dims.titleLine) }]}
      >
        {displayTitle}
      </ThemedText>
      <ThemedText variant="label" weight="medium" tabular color={theme.colors.textFaint} style={styles.meta}>
        {isCompleted ? `${runtime} · ${t.series.completed}` : runtime}
      </ThemedText>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  still: {
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    backgroundColor: theme.colors.skeleton,
  },
  stillCurrentRing: { borderWidth: 2, borderColor: theme.colors.primary },
  fallback: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "60%" },
  currentDim: { backgroundColor: "rgba(8,8,11,0.35)" },
  number: { position: "absolute", left: 10, bottom: 6, color: theme.colors.text, opacity: 0.92, letterSpacing: -1 },
  numberAboveBar: { bottom: 12 },
  nowPlaying: {
    position: "absolute",
    left: 8,
    top: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 22,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    maxWidth: "80%",
  },
  nowPlayingText: { fontSize: 11, flexShrink: 1 },
  doneBadge: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.finance,
  },
  progress: { position: "absolute", left: 8, right: 8, bottom: 6 },
  title: { marginTop: 10, color: theme.colors.text },
  meta: { marginTop: 2 },
});
