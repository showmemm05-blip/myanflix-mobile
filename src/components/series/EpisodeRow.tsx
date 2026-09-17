import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { Pill } from "@/components/ui/Pill";
import { PressableScale } from "@/components/ui/PressableScale";
import { ProgressTrack } from "@/components/common/ProgressTrack";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatDuration, UNKNOWN_DURATION } from "@/utils/format";
import { theme, withAlpha } from "@/theme";

const THUMB_WIDTH = 112;
const THUMB_HEIGHT = Math.round((THUMB_WIDTH * 9) / 16);
const COMPLETED_THRESHOLD = 95;

/**
 * Fixed row height for DESCRIPTION-LESS rows — the 16:9 still is the tallest
 * element there (a two-line title plus its meta line measures exactly the
 * still's 63pt), so those rows never grow. The in-player list never passes a
 * description and relies on this constant to virtualize with exact offsets;
 * SeriesDetails passes one, and its rows treat this as a minimum instead.
 */
export const EPISODE_ROW_HEIGHT = THUMB_HEIGHT + theme.spacing.sm * 2 + 2;

interface Props {
  episodeId: string;
  title: string;
  episodeNumber: number | null;
  /** Runtime in minutes — 0/unknown renders an em-dash, never "0m". */
  durationMinutes: number;
  thumbnailUrl?: string | null;
  /** One or two lines of synopsis under the meta line (SeriesDetails only). */
  description?: string | null;
  /** The gating decision stays with the screen. */
  locked?: boolean;
  /**
   * Locked rows stay PRESSABLE when this is provided — the tap routes to the
   * subscribe flow instead of the player. Without it a locked row is inert
   * (the in-player list's behavior).
   */
  onLockedPress?: () => void;
  /** The episode currently playing — violet ring, violet title, "Now Playing". */
  isCurrent?: boolean;
  /** 0–100 watch progress, when the list knows it. */
  progressPercent?: number;
  onPress: (episodeId: string) => void;
}

/**
 * THE episode row — one design for every episode list in the app (the season
 * list on SeriesDetails and the list under / beside the player), so the same
 * content never wears two looks. States it carries: locked (pressable into
 * Subscribe when the screen wires it), current, watched, part-watched.
 *
 * Memoized for SeriesDetails, which renders a whole season of these in flow
 * (no virtualization there) — a favourite toggle or a settling query must not
 * re-render rows whose data did not change. Every prop is a primitive bar the
 * two handlers, which that screen keeps stable. In the player's FlatList the
 * memo is inert, and that is fine: cells there re-render either way.
 */
export const EpisodeRow = memo(function EpisodeRow({
  episodeId,
  title,
  episodeNumber,
  durationMinutes,
  thumbnailUrl,
  description,
  locked = false,
  onLockedPress,
  isCurrent = false,
  progressPercent = 0,
  onPress,
}: Props) {
  const { t } = useLanguage();
  const isCompleted = progressPercent >= COMPLETED_THRESHOLD;
  const isInProgress = progressPercent > 0 && !isCompleted;
  const displayTitle =
    title.trim().length > 0
      ? title
      : t.series.episodeFallbackTitle.replace("{n}", episodeNumber != null ? String(episodeNumber) : "—");

  return (
    <PressableScale
      onPress={() => {
        if (locked) onLockedPress?.();
        else onPress(episodeId);
      }}
      disabled={locked && !onLockedPress}
      activeScale={0.98}
      dimOnPress
      accessibilityLabel={locked ? `${displayTitle} · ${t.series.lockedEpisode}` : displayTitle}
      style={styles.container}
    >
      <View style={[styles.row, description ? styles.rowGrows : styles.rowFixed, isCurrent && styles.rowCurrent]}>
        <View style={[styles.thumb, isCurrent && styles.thumbCurrent]}>
          {thumbnailUrl ? (
            <Image
              source={{ uri: thumbnailUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={160}
              // 112x63 still, unmounted and remounted as the episode list
              // scrolls; the disk-only default re-decodes each time.
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={styles.thumbFallback}>
              <Ionicons name="film-outline" size={18} color={theme.colors.textFaint} />
            </View>
          )}

          {isCurrent && (
            <View style={styles.nowPlayingOverlay}>
              <View style={styles.nowPlayingPill}>
                <Ionicons name="pulse" size={11} color={theme.colors.onPrimary} />
                <ThemedText variant="caption" weight="bold" style={styles.nowPlayingText}>
                  {t.series.nowPlaying}
                </ThemedText>
              </View>
            </View>
          )}

          {locked && (
            <View style={styles.lockScrim}>
              <View style={styles.lockDisc}>
                <Ionicons name="lock-closed" size={14} color={theme.colors.premium} />
              </View>
            </View>
          )}

          {isCompleted && !isCurrent && !locked && (
            <View style={styles.completedBadge}>
              <Ionicons name="checkmark" size={12} color={theme.colors.onFinance} />
            </View>
          )}

          {!isCurrent && episodeNumber != null && (
            <View style={styles.numberTag}>
              <ThemedText variant="caption" weight="bold" tabular style={styles.numberText}>
                {episodeNumber}
              </ThemedText>
            </View>
          )}

          {isInProgress && <ProgressTrack progress={progressPercent / 100} height={3} style={styles.progress} />}
        </View>

        <View style={styles.info}>
          <ThemedText
            variant="body"
            weight="semibold"
            numberOfLines={description ? 1 : 2}
            style={isCurrent ? styles.titleCurrent : undefined}
          >
            {displayTitle}
          </ThemedText>
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={12} color={theme.colors.textFaint} />
            <ThemedText variant="caption" tabular numberOfLines={1} style={styles.meta}>
              {formatDuration(durationMinutes) ?? UNKNOWN_DURATION}
            </ThemedText>
            {isCompleted && !locked && (
              <ThemedText variant="caption" weight="semibold" numberOfLines={1} style={styles.completedText}>
                {t.series.completed}
              </ThemedText>
            )}
          </View>
          {description ? (
            <ThemedText variant="caption" numberOfLines={2} color={theme.colors.textMuted}>
              {description}
            </ThemedText>
          ) : null}
        </View>

        {locked ? (
          <Pill tone="premium">{t.series.lockedEpisode}</Pill>
        ) : (
          <View style={styles.trailing}>
            <Ionicons name={isCurrent ? "pulse" : "play"} size={16} color={theme.colors.primary} />
          </View>
        )}

        {isCurrent && <View style={styles.currentRail} pointerEvents="none" />}
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  container: { width: "100%" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  /** The virtualization contract — every description-less row is exactly this tall. */
  rowFixed: { height: EPISODE_ROW_HEIGHT },
  /** A synopsis may add a line or two; the height becomes a floor, not a cage. */
  rowGrows: { minHeight: EPISODE_ROW_HEIGHT },
  rowCurrent: { backgroundColor: theme.colors.accent, borderColor: withAlpha(theme.colors.primary, 0.24) },
  thumb: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: theme.radius.md,
    overflow: "hidden",
    backgroundColor: theme.colors.skeleton,
    borderWidth: 1,
    borderColor: theme.colors.ring,
  },
  thumbCurrent: { borderColor: theme.colors.primary },
  thumbFallback: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  nowPlayingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.scrimSoft,
  },
  nowPlayingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
  },
  nowPlayingText: { color: theme.colors.onPrimary },
  lockScrim: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.scrimSoft,
  },
  lockDisc: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.overlay,
    borderWidth: 1,
    borderColor: theme.colors.ring,
  },
  completedBadge: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.finance,
  },
  numberTag: {
    position: "absolute",
    left: 5,
    bottom: 5,
    minWidth: 22,
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.overlay,
    borderWidth: 1,
    borderColor: theme.colors.ring,
  },
  numberText: { color: theme.colors.text },
  progress: { position: "absolute", left: 0, right: 0, bottom: 0, borderRadius: 0 },
  info: { flex: 1, gap: 3 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  meta: { color: theme.colors.textFaint, flexShrink: 1 },
  titleCurrent: { color: theme.colors.primary },
  completedText: { color: theme.colors.finance, marginLeft: theme.spacing.xs },
  trailing: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    backgroundColor: theme.colors.primarySoft,
    borderColor: withAlpha(theme.colors.primary, 0.24),
  },
  currentRail: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: theme.colors.primary,
  },
});
