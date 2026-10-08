import { memo } from "react";
import { StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { PressableScale } from "@/components/ui/PressableScale";
import { ThemedText } from "@/components/ui/ThemedText";
import { ProgressTrack } from "@/components/common/ProgressTrack";
import { PosterThumb } from "@/components/library/PosterThumb";
import {
  historyA11yLabel,
  isWatched,
  percentOf,
  timeLeftLabel,
  timeOfDay,
} from "@/components/library/historyFormat";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatDuration } from "@/utils/format";
import { theme, withAlpha } from "@/theme";
import type { WatchHistoryEntry } from "@/types/video";

const POSTER_WIDTH = 80;

/**
 * One Watch History entry (WatchHistory.dc.html): an 80×120 poster with a
 * glass play disc and its progress line, then the title, "runtime · time of
 * day", and either "62% · 47m left" over a 4pt crimson bar or a ✓ Watched
 * line. A tap opens the title's page (the detail screen resumes it), as the
 * old grid cell did.
 */
export const HistoryRow = memo(function HistoryRow({
  entry,
  onOpen,
}: {
  entry: WatchHistoryEntry;
  onOpen: (movieId: string) => void;
}) {
  const { t } = useLanguage();
  const percent = percentOf(entry);
  const watched = isWatched(entry);
  const meta = [formatDuration(entry.durationMinutes), timeOfDay(entry.updatedAt)].filter(Boolean).join(" · ");
  const progressLine = [`${percent}%`, timeLeftLabel(entry, t)].filter(Boolean).join(" · ");

  return (
    <PressableScale onPress={() => onOpen(entry.movieId)} accessibilityLabel={historyA11yLabel(entry, t)} style={styles.row}>
      <PosterThumb
        uri={entry.posterUrl}
        width={POSTER_WIDTH}
        shade
        progress={percent / 100}
        progressColor={watched ? theme.colors.textFaint : theme.colors.primary}
      >
        <View style={styles.playDisc}>
          <Ionicons name="play" size={14} color={theme.colors.text} style={styles.playGlyph} />
        </View>
      </PosterThumb>

      <View style={styles.info}>
        <ThemedText variant="body" weight="extrabold" style={styles.title}>
          {entry.movieTitle}
        </ThemedText>
        {meta ? (
          <ThemedText variant="caption" weight="regular" tabular color={theme.colors.textFaint} style={styles.meta}>
            {meta}
          </ThemedText>
        ) : null}
        {watched ? (
          <View style={styles.watchedRow}>
            <Ionicons name="checkmark" size={15} color={theme.colors.textMuted} />
            <ThemedText variant="caption" weight="bold" color={theme.colors.textMuted}>
              {t.library.watched}
            </ThemedText>
          </View>
        ) : (
          <>
            <ThemedText variant="caption" weight="bold" tabular color={theme.colors.text} style={styles.left}>
              {progressLine}
            </ThemedText>
            <ProgressTrack
              progress={percent / 100}
              height={4}
              trackColor={withAlpha(theme.colors.text, 0.14)}
              style={styles.bar}
            />
          </>
        )}
      </View>
    </PressableScale>
  );
});

const PLAY_DISC = 36;

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 14, minHeight: 120 },
  playDisc: {
    position: "absolute",
    left: (POSTER_WIDTH - PLAY_DISC) / 2,
    top: (POSTER_WIDTH * 1.5 - PLAY_DISC) / 2,
    width: PLAY_DISC,
    height: PLAY_DISC,
    borderRadius: PLAY_DISC / 2,
    alignItems: "center",
    justifyContent: "center",
    // The board's glass disc, without a live blur: a BlurView per row of an
    // endless list costs more than the dark fill alone buys back.
    backgroundColor: withAlpha(theme.colors.background, 0.55),
  },
  /** The triangle's optical centre sits right of its box. */
  playGlyph: { marginLeft: 2 },
  info: { flex: 1, minWidth: 0, paddingTop: theme.spacing.xs },
  /**
   * WatchHistory: 17pt extra-bold — wraps rather than clipping a long title.
   * Size only: ThemedText keeps the line height (+4 for Burmese) and drops
   * tracking for Myanmar script, and a style override would undo both.
   */
  title: { fontSize: 17 },
  meta: { marginTop: 2 },
  left: { marginTop: 10 },
  bar: { marginTop: theme.spacing.sm },
  watchedRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
});
