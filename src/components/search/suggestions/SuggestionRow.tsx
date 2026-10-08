import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme, withAlpha } from "@/theme";

/**
 * Artwork HEIGHT is the constant every kind shares, and the width follows the
 * real aspect: 36 for a 2:3 movie or series poster, 39 for a 5:7 book cover
 * (BookCard's own ratio). Holding the height fixed is what keeps ROW_HEIGHT,
 * the visible-row cap and the keyboard budget identical for all three — the
 * text column's 3pt shift is invisible, and a panel only ever lists one kind
 * at a time, so two widths are never seen side by side.
 */
export const THUMB_HEIGHT = 54;
export const POSTER_THUMB_WIDTH = 36;
export const BOOK_THUMB_WIDTH = 39;
/** The Marquee board's 64pt row: a 54pt thumbnail plus 5pt of air above and below. */
export const ROW_HEIGHT = 64;

interface Props {
  /** The row's headline — the matched part of it is picked out below. */
  title: string;
  /** The DEBOUNCED term, i.e. the one these rows actually answer. */
  term: string;
  /** Poster or cover; null falls through to the glyph. */
  imageUrl: string | null;
  /** The kind's own placeholder: film, tv or book. */
  fallbackIcon: keyof typeof Ionicons.glyphMap;
  /** See THUMB_HEIGHT — the kind's real aspect at a shared height. */
  thumbWidth: number;
  /** The quiet second line: "year · genre", "year · n episodes", the author. */
  meta: string | null;
  onPress: () => void;
}

/**
 * One suggestion: thumbnail, the title with the typed part picked out, meta.
 * No trailing chevron any more — the Marquee board drops it; the whole row is
 * the target and the highlight on press says so.
 */
export function SuggestionRow({ title, term, imageUrl, fallbackIcon, thumbWidth, meta, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      // A background tint rather than PressableScale's shrink: a 68pt row that
      // scales reads as the whole panel wobbling, where a highlight reads as
      // one row being picked.
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={[styles.thumb, { width: thumbWidth }]}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={140}
            // 38x56 thumb, remounted every time the panel reopens; the
            // disk-only default re-decodes each time. See MediaCard.
            cachePolicy="memory-disk"
          />
        ) : (
          <Ionicons name={fallbackIcon} size={16} color={theme.colors.textFaint} />
        )}
      </View>

      <View style={styles.rowText}>
        <HighlightedTitle title={title} term={term} />
        {meta ? (
          <ThemedText variant="caption" color={theme.colors.textFaint} tabular numberOfLines={1}>
            {meta}
          </ThemedText>
        ) : null}
      </View>

    </Pressable>
  );
}

/**
 * The matched substring, picked out by weight and ink.
 *
 * Only the FIRST occurrence is marked, case-insensitively. When the term is not
 * in the title at all — the row matched on an actor, a director, a description
 * or (on books) the author — the whole title renders at full brightness rather
 * than dimmed, so an honest hit never reads as a disabled row. That fallback is
 * the COMMON case on books, whose search covers the author line too.
 *
 * Colour and weight rather than a highlighted background: a nested Text with
 * its own backgroundColor paints a ragged block on Android under this app's
 * Myanmar font, whose line boxes are taller than the Latin glyphs inside them.
 */
function HighlightedTitle({ title, term }: { title: string; term: string }) {
  const at = term ? title.toLowerCase().indexOf(term.toLowerCase()) : -1;
  if (at < 0) {
    return (
      <ThemedText variant="body" weight="medium" numberOfLines={1}>
        {title}
      </ThemedText>
    );
  }
  return (
    <ThemedText variant="body" weight="medium" numberOfLines={1} color={theme.colors.textMuted}>
      {title.slice(0, at)}
      <ThemedText variant="body" weight="extrabold" color={theme.colors.text}>
        {title.slice(at, at + term.length)}
      </ThemedText>
      {title.slice(at + term.length)}
    </ThemedText>
  );
}

/**
 * Exported because the panel's SKELETON rows have to stand in exactly this
 * shape — same height, same padding, same gap — or the placeholder jumps when
 * the real rows land.
 */
export const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    height: ROW_HEIGHT,
    paddingLeft: 6,
    paddingRight: theme.spacing.sm,
    gap: 12,
    borderRadius: theme.radius.md,
  },
  rowPressed: { backgroundColor: withAlpha(theme.colors.text, 0.06) },
  thumb: {
    height: THUMB_HEIGHT,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: theme.colors.skeleton,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, gap: 2 },
});
