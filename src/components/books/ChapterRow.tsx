import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useReducedMotion } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { useLanguage } from "@/localization/LanguageProvider";
import { clamp } from "@/utils/format";
import { theme, withAlpha } from "@/theme";
import type { BookChapterSummary } from "@/types/book";

/** BookDetail.dc.html: a 104 × 58 chapter still, radius 8. */
export const CHAPTER_THUMB_WIDTH = 104;
const THUMB_HEIGHT = 58;
/** Thumb + the 14pt gap — where a chapter's section rows indent to. */
export const CHAPTER_TEXT_INSET = CHAPTER_THUMB_WIDTH + 14;

/** Keeps the white chapter number legible on any still. */
const NUMBER_SCRIM = [withAlpha(theme.colors.background, 0), withAlpha(theme.colors.background, 0.7)] as const;

interface Props {
  chapter: BookChapterSummary;
  /** PDF books show the chapter's page count under the title. */
  isPdf: boolean;
  /** The reader's bookmark sits in this chapter — "Continue reading" + the depth line. */
  bookmarked?: boolean;
  /**
   * How far into THIS chapter the bookmark is (0–1), drawn as the crimson
   * line inset on the still. Recovered from the whole-book percentage the
   * same way BookReader recovers it.
   */
  progress?: number;
  /**
   * Takes the chapter id rather than a bound closure, so the caller can hand
   * every row ONE stable handler. With a per-row arrow the `memo` below never
   * held, and BookDetails maps the whole (uncapped) chapter list in flow.
   */
  onPress?: (chapterId: string) => void;
}

/**
 * One row of a book's chapter list (BookDetail.dc.html): the chapter's still
 * with its number set on it, the title, and what the row means right now —
 * "Continue reading" on the bookmarked chapter, a page count on a scanned
 * book, a clock and "Coming soon" on one still being prepared.
 *
 * A chapter that is not READY is shown, not hidden — serialised releases read
 * as a schedule rather than a bug — and stays inert. It is no longer dimmed
 * as a whole (that put its words under contrast): its still fades and its
 * words take the secondary inks instead.
 */
export const ChapterRow = memo(function ChapterRow({ chapter, isPdf, bookmarked, progress, onPress }: Props) {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const ready = chapter.status === "READY";
  const pageCountLabel =
    chapter.pageCount === 1 ? t.books.pageCountOne : t.books.pageCount.replace("{n}", String(chapter.pageCount));
  const depth = bookmarked && typeof progress === "number" ? clamp(progress, 0, 1) : null;

  return (
    <Pressable
      onPress={ready && onPress ? () => onPress(chapter.id) : undefined}
      disabled={!ready || !onPress}
      accessibilityRole="button"
      accessibilityLabel={chapter.title}
      accessibilityState={{ disabled: !ready }}
      style={({ pressed }) => [styles.row, pressed && ready && (reduceMotion ? styles.pressedStill : styles.pressed)]}
    >
      <View style={[styles.thumb, !ready && styles.thumbSoon]}>
        {chapter.imageUrl ? (
          <Image
            source={{ uri: chapter.imageUrl }}
            style={[StyleSheet.absoluteFill, !ready && styles.faded]}
            contentFit="cover"
            transition={160}
            // A small still — the memory tier costs almost nothing and saves a
            // disk read plus a decode on every scroll back. See MediaCard.
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.thumbFallback}>
            <Ionicons name="book-outline" size={18} color={theme.colors.textDecor} />
          </View>
        )}
        {chapter.imageUrl && ready ? (
          <LinearGradient colors={NUMBER_SCRIM} style={styles.numberScrim} pointerEvents="none" />
        ) : null}
        <ThemedText
          weight="black"
          tabular
          allowFontScaling={false}
          color={ready ? theme.colors.text : theme.colors.textMuted}
          style={[styles.number, depth !== null && styles.numberRaised]}
        >
          {chapter.number.padStart(2, "0")}
        </ThemedText>
        {depth !== null && (
          <View style={styles.depthTrack}>
            <View style={[styles.depthFill, { width: `${depth * 100}%` }]} />
          </View>
        )}
      </View>

      <View style={styles.body}>
        <ThemedText
          variant="body"
          weight="bold"
          color={ready ? theme.colors.text : theme.colors.textMuted}
          numberOfLines={2}
        >
          {chapter.title}
        </ThemedText>
        {!ready ? (
          <View style={styles.soon}>
            <Ionicons name="time-outline" size={14} color={theme.colors.textFaint} />
            <ThemedText variant="caption" color={theme.colors.textFaint} numberOfLines={1}>
              {t.books.chapterComingSoon}
            </ThemedText>
          </View>
        ) : (
          <>
            {bookmarked && (
              <ThemedText variant="caption" weight="bold" color={theme.colors.link} numberOfLines={1}>
                {t.books.continueReading}
              </ThemedText>
            )}
            {isPdf && chapter.pageCount > 0 && (
              <ThemedText variant="caption" tabular color={theme.colors.textFaint} numberOfLines={1}>
                {pageCountLabel}
              </ThemedText>
            )}
          </>
        )}
      </View>

      {ready && !bookmarked ? <Ionicons name="chevron-forward" size={18} color={theme.colors.textFaint} /> : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 78,
    paddingVertical: 10,
  },
  pressed: { transform: [{ scale: 0.98 }] },
  pressedStill: { opacity: 0.7 },
  thumb: {
    width: CHAPTER_THUMB_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: theme.radius.sm + 1,
    overflow: "hidden",
    backgroundColor: theme.colors.surfaceElevated,
  },
  thumbSoon: { backgroundColor: theme.colors.surface },
  faded: { opacity: 0.35 },
  thumbFallback: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  numberScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 30 },
  number: { position: "absolute", left: 7, bottom: 6, fontSize: 13, lineHeight: 14 },
  numberRaised: { bottom: 10 },
  depthTrack: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.colors.track,
    overflow: "hidden",
  },
  depthFill: { height: 3, borderRadius: 2, backgroundColor: theme.colors.primary },
  body: { flex: 1, gap: 2 },
  soon: { flexDirection: "row", alignItems: "center", gap: 5 },
});
