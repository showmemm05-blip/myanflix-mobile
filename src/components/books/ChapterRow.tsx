import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ui/ThemedText";
import { Pill } from "@/components/ui/Pill";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme, withAlpha } from "@/theme";
import type { BookChapterSummary } from "@/types/book";

interface Props {
  chapter: BookChapterSummary;
  /** PDF books show the chapter's page count under the title. */
  isPdf: boolean;
  /** The reader's bookmark sits in this chapter — tinted row + continue pill. */
  bookmarked?: boolean;
  onPress?: () => void;
}

/**
 * One row of a book's chapter list. Rows that aren't READY are dimmed and
 * inert — a chapter still converting is shown, not hidden, so serialised
 * releases read as a schedule rather than a bug.
 */
export const ChapterRow = memo(function ChapterRow({ chapter, isPdf, bookmarked, onPress }: Props) {
  const { t } = useLanguage();
  const ready = chapter.status === "READY";
  const pageCountLabel =
    chapter.pageCount === 1 ? t.books.pageCountOne : t.books.pageCount.replace("{n}", String(chapter.pageCount));

  return (
    <Pressable
      onPress={ready ? onPress : undefined}
      disabled={!ready || !onPress}
      accessibilityRole="button"
      accessibilityLabel={chapter.title}
      accessibilityState={{ disabled: !ready }}
      style={({ pressed }) => [
        styles.row,
        bookmarked && styles.bookmarked,
        !ready && styles.dimmed,
        pressed && ready && styles.pressed,
      ]}
    >
      <View style={styles.thumb}>
        {chapter.imageUrl ? (
          <Image source={{ uri: chapter.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={160} />
        ) : (
          <View style={styles.thumbFallback}>
            <Ionicons name="book-outline" size={16} color={theme.colors.textFaint} />
          </View>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <ThemedText variant="caption" tabular style={styles.order}>
            {`#${chapter.number.padStart(3, "0")}`}
          </ThemedText>
          <ThemedText variant="caption" weight="medium" color={theme.colors.text} numberOfLines={2} style={styles.title}>
            {chapter.title}
          </ThemedText>
        </View>
        {isPdf && chapter.pageCount > 0 && (
          <ThemedText variant="caption" tabular numberOfLines={1}>
            {pageCountLabel}
          </ThemedText>
        )}
      </View>

      {!ready ? (
        <ThemedText variant="caption" color={theme.colors.textFaint} numberOfLines={1}>
          {t.books.chapterComingSoon}
        </ThemedText>
      ) : bookmarked ? (
        <Pill tone="primary">{t.books.continueReading}</Pill>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={theme.colors.textFaint} />
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm + 4,
    minHeight: 64,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: "transparent",
  },
  bookmarked: {
    backgroundColor: withAlpha(theme.colors.primary, 0.1),
    borderColor: withAlpha(theme.colors.primary, 0.35),
  },
  dimmed: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
  thumb: {
    width: 72,
    height: 48,
    borderRadius: theme.radius.sm,
    overflow: "hidden",
    backgroundColor: theme.colors.skeleton,
    borderWidth: 1,
    borderColor: theme.colors.ring,
  },
  thumbFallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
  order: { fontSize: 12, color: theme.colors.textFaint, marginTop: 1 },
  title: { flex: 1 },
});
