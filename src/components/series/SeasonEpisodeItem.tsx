import { memo } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { Pill } from "@/components/ui/Pill";
import { PressableScale } from "@/components/ui/PressableScale";
import { ProgressTrack } from "@/components/common/ProgressTrack";
import { Skeleton } from "@/components/common/Skeleton";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatDuration, UNKNOWN_DURATION } from "@/utils/format";
import { theme, withAlpha } from "@/theme";

/** SeriesDetail.dc.html: a 148 × 83 still. Narrow phones take 42% of the row instead. */
const THUMB_MAX = 148;
const THUMB_SHARE = 0.42;
/** Same rule as the player's list: 95% and over counts as watched. */
export const EPISODE_COMPLETED_THRESHOLD = 95;

function useThumbSize() {
  const { width } = useWindowDimensions();
  const thumbWidth = Math.min(THUMB_MAX, Math.round((width - theme.layout.screenPadding * 2) * THUMB_SHARE));
  return { width: thumbWidth, height: Math.round((thumbWidth * 9) / 16) };
}

/**
 * Whole minutes still to watch, or null when it cannot be said honestly
 * (unknown runtime, nothing watched, or already finished).
 */
export function minutesLeftOf(
  durationMinutes: number,
  progressPercent: number,
  lastPositionSeconds: number | null | undefined,
): number | null {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return null;
  if (progressPercent <= 0 || progressPercent >= EPISODE_COMPLETED_THRESHOLD) return null;
  const watchedMinutes =
    lastPositionSeconds != null && lastPositionSeconds > 0
      ? lastPositionSeconds / 60
      : (durationMinutes * progressPercent) / 100;
  return Math.max(1, Math.ceil(durationMinutes - watchedMinutes));
}

interface Props {
  episodeId: string;
  title: string;
  episodeNumber: number | null;
  /** Runtime in minutes — 0/unknown renders an em-dash, never "0m". */
  durationMinutes: number;
  thumbnailUrl?: string | null;
  description?: string | null;
  /** The gating decision stays with the screen. */
  locked: boolean;
  /** A locked row routes here (Subscribe) instead of the player. */
  onLockedPress: () => void;
  onPress: (episodeId: string) => void;
  /** 0–100 from GET /series/:id/player-episodes; null/undefined when unknown. */
  progressPercent?: number | null;
  lastPositionSeconds?: number | null;
}

/**
 * One episode on the series page (SeriesDetail.dc.html): the still with its
 * number tag, a play disc (or the gold lock), the green check once watched
 * and a crimson progress line while part-watched; the title, runtime and
 * "Completed" / "Nm left" beside it; two lines of synopsis under the row.
 *
 * The player draws its own episode cards (components/player/EpisodeCard) —
 * this is the page's reading-sized item. Memoized: a whole season renders in flow, and every
 * prop is a primitive bar the two handlers, which the screen keeps stable.
 */
export const SeasonEpisodeItem = memo(function SeasonEpisodeItem({
  episodeId,
  title,
  episodeNumber,
  durationMinutes,
  thumbnailUrl,
  description,
  locked,
  onLockedPress,
  onPress,
  progressPercent,
  lastPositionSeconds,
}: Props) {
  const { t } = useLanguage();
  const thumb = useThumbSize();
  const percent = locked ? 0 : (progressPercent ?? 0);
  const isCompleted = percent >= EPISODE_COMPLETED_THRESHOLD;
  const isInProgress = percent > 0 && !isCompleted;
  const minutesLeft = isInProgress ? minutesLeftOf(durationMinutes, percent, lastPositionSeconds) : null;
  const displayTitle =
    title.trim().length > 0
      ? title
      : t.series.episodeFallbackTitle.replace("{n}", episodeNumber != null ? String(episodeNumber) : "—");
  const duration = formatDuration(durationMinutes) ?? UNKNOWN_DURATION;
  const minutesLeftLabel = minutesLeft != null ? t.series.minutesLeft.replace("{n}", String(minutesLeft)) : null;

  const spokenTitle =
    episodeNumber != null
      ? t.series.episodeA11y.replace("{n}", String(episodeNumber)).replace("{title}", displayTitle)
      : displayTitle;
  const accessibilityLabel = locked
    ? `${spokenTitle} · ${t.series.lockedEpisode}`
    : [spokenTitle, formatDuration(durationMinutes), isCompleted ? t.series.completed : minutesLeftLabel]
        .filter(Boolean)
        .join(", ");

  return (
    <PressableScale
      onPress={() => (locked ? onLockedPress() : onPress(episodeId))}
      activeScale={0.98}
      dimOnPress
      accessibilityLabel={accessibilityLabel}
      style={styles.container}
    >
      <View style={styles.row}>
        <View style={[styles.thumb, thumb]}>
          {thumbnailUrl ? (
            <Image
              source={{ uri: thumbnailUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={160}
              cachePolicy="memory-disk"
              accessible={false}
            />
          ) : (
            <View style={styles.fill}>
              <Ionicons name="film-outline" size={20} color={theme.colors.textFaint} />
            </View>
          )}

          {locked ? (
            <View style={[styles.fill, styles.lockScrim]}>
              <View style={styles.lockDisc}>
                <Ionicons name="lock-closed" size={15} color={theme.colors.premium} />
              </View>
            </View>
          ) : (
            <View style={styles.fill} pointerEvents="none">
              <View style={styles.playDisc}>
                <Ionicons name="play" size={14} color={theme.colors.text} style={styles.playGlyph} />
              </View>
            </View>
          )}

          {episodeNumber != null && (
            <View style={styles.numberTag}>
              <ThemedText variant="overline" color={theme.colors.text} tabular style={styles.numberText}>
                {episodeNumber}
              </ThemedText>
            </View>
          )}

          {isCompleted && (
            <View style={styles.doneBadge}>
              <Ionicons name="checkmark" size={13} color={theme.colors.onFinance} />
            </View>
          )}

          {isInProgress && <ProgressTrack progress={percent / 100} height={3} style={styles.progress} />}
        </View>

        <View style={styles.info}>
          <ThemedText variant="body" weight="bold" numberOfLines={3}>
            {displayTitle}
          </ThemedText>
          <View style={styles.metaRow}>
            <ThemedText variant="caption" tabular color={theme.colors.textFaint}>
              {duration}
            </ThemedText>
            {isCompleted && (
              <ThemedText variant="caption" weight="bold" color={theme.colors.finance}>
                {t.series.completed}
              </ThemedText>
            )}
            {minutesLeftLabel && (
              <ThemedText variant="caption" weight="semibold" tabular color={theme.colors.textMuted}>
                {minutesLeftLabel}
              </ThemedText>
            )}
            {locked && (
              <Pill tone="premium" size="sm">
                {t.series.lockedEpisode}
              </Pill>
            )}
          </View>
        </View>
      </View>

      {description ? (
        <ThemedText variant="caption" weight="regular" numberOfLines={2} color={theme.colors.textMuted} style={styles.description}>
          {description}
        </ThemedText>
      ) : null}
    </PressableScale>
  );
});

/** Four of these stand in for a season while its episodes load. */
export function SeasonEpisodeSkeleton() {
  const thumb = useThumbSize();
  return (
    <View style={styles.row}>
      <Skeleton width={thumb.width} height={thumb.height} radius="lg" />
      <View style={styles.skeletonText}>
        <Skeleton width="80%" height={14} radius="xs" />
        <Skeleton width="36%" height={12} radius="xs" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%" },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  thumb: { borderRadius: theme.radius.lg, overflow: "hidden", backgroundColor: theme.colors.skeleton },
  fill: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  playDisc: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.onArt,
    borderWidth: 1.5,
    borderColor: withAlpha(theme.colors.text, 0.85),
  },
  playGlyph: { marginLeft: 2 },
  lockScrim: { backgroundColor: theme.colors.onArt },
  lockDisc: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha(theme.colors.background, 0.78),
  },
  numberTag: {
    position: "absolute",
    left: 6,
    top: 6,
    minWidth: 22,
    minHeight: 20,
    paddingHorizontal: 6,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.artBadge,
  },
  numberText: { letterSpacing: 0 },
  doneBadge: {
    position: "absolute",
    right: 6,
    top: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.finance,
  },
  progress: { position: "absolute", left: 8, right: 8, bottom: 6, width: "auto" },
  info: { flex: 1, minWidth: 0 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: theme.spacing.sm, rowGap: 4, marginTop: 4 },
  description: { marginTop: 10 },
  skeletonText: { flex: 1, gap: 10 },
});
