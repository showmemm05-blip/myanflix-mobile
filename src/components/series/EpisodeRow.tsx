import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ui/ThemedText";
import { PressableScale } from "@/components/ui/PressableScale";
import { ProgressTrack } from "@/components/common/ProgressTrack";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatDuration } from "@/utils/format";
import { theme } from "@/theme";

const THUMB_WIDTH = 128;
const THUMB_HEIGHT = Math.round((THUMB_WIDTH * 9) / 16);
const COMPLETED_THRESHOLD = 95;

/**
 * Fixed row height — the 16:9 still is always the tallest element (a two-line
 * title plus its meta line measures 63pt against the still's 72pt), so the row
 * never grows. The in-player list relies on this being constant to virtualize
 * with exact offsets.
 */
export const EPISODE_ROW_HEIGHT = THUMB_HEIGHT + theme.spacing.sm * 2 + 2;

interface Props {
  episodeId: string;
  title: string;
  episodeNumber: number | null;
  /** Runtime in minutes. */
  durationMinutes: number;
  thumbnailUrl?: string | null;
  /** The gating decision stays with the screen; a locked row is not pressable. */
  locked?: boolean;
  /** The episode currently playing — violet ring, violet title, "Now Playing". */
  isCurrent?: boolean;
  /** 0–100 watch progress, when the list knows it. */
  progressPercent?: number;
  onPress: (episodeId: string) => void;
}

/**
 * THE episode row — one design for every episode list in the app (the season
 * list on SeriesDetails and the list under / beside the player), so the same
 * content never wears two looks. States it carries: locked (visible but not
 * pressable), current, watched, part-watched.
 */
export function EpisodeRow({
  episodeId,
  title,
  episodeNumber,
  durationMinutes,
  thumbnailUrl,
  locked = false,
  isCurrent = false,
  progressPercent = 0,
  onPress,
}: Props) {
  const { t } = useLanguage();
  const isCompleted = progressPercent >= COMPLETED_THRESHOLD;
  const isInProgress = progressPercent > 0 && !isCompleted;

  return (
    <PressableScale
      onPress={() => {
        if (!locked) onPress(episodeId);
      }}
      disabled={locked}
      activeScale={0.98}
      dimOnPress
      accessibilityLabel={title}
      style={styles.container}
    >
      <View style={[styles.row, isCurrent && styles.rowCurrent]}>
        <View style={[styles.thumb, isCurrent && styles.thumbCurrent]}>
          {thumbnailUrl ? (
            <Image source={{ uri: thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={160} />
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
              <Ionicons name="lock-closed" size={16} color={theme.colors.premium} />
            </View>
          )}

          {isCompleted && !isCurrent && !locked && (
            <View style={styles.completedBadge}>
              <Ionicons name="checkmark" size={12} color={theme.colors.onFinance} />
            </View>
          )}

          {!isCurrent && (
            <View style={styles.numberTag}>
              <ThemedText variant="caption" weight="bold" tabular style={styles.numberText}>
                {episodeNumber ?? "-"}
              </ThemedText>
            </View>
          )}

          {isInProgress && <ProgressTrack progress={progressPercent / 100} height={3} style={styles.progress} />}
        </View>

        <View style={styles.info}>
          <ThemedText variant="body" weight="semibold" numberOfLines={2} style={isCurrent ? styles.titleCurrent : undefined}>
            {title}
          </ThemedText>
          <View style={styles.metaRow}>
            <ThemedText variant="caption" tabular numberOfLines={1} style={styles.meta}>
              {locked ? t.series.subscribeToWatch : formatDuration(durationMinutes)}
            </ThemedText>
            {isCompleted && !locked && (
              <ThemedText variant="caption" weight="semibold" numberOfLines={1} style={styles.completedText}>
                {t.series.completed}
              </ThemedText>
            )}
          </View>
        </View>

        <View style={[styles.trailing, locked ? styles.trailingLocked : styles.trailingActive]}>
          <Ionicons
            name={locked ? "lock-closed" : isCurrent ? "pulse" : "play"}
            size={16}
            color={locked ? theme.colors.textFaint : theme.colors.primary}
          />
        </View>

        {isCurrent && <View style={styles.currentRail} pointerEvents="none" />}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%" },
  row: {
    height: EPISODE_ROW_HEIGHT,
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
  rowCurrent: { backgroundColor: theme.colors.accent, borderColor: theme.colors.primary + "3D" },
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
  thumbFallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  nowPlayingOverlay: {
    ...StyleSheet.absoluteFillObject,
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
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.scrimSoft,
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
  metaRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  meta: { color: theme.colors.textFaint, flexShrink: 1 },
  titleCurrent: { color: theme.colors.primary },
  completedText: { color: theme.colors.finance },
  trailing: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  trailingActive: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary + "3D" },
  trailingLocked: { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border },
  currentRail: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: theme.colors.primary,
  },
});
