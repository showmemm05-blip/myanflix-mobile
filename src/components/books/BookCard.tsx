import { memo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { ThemedText } from "@/components/ui/ThemedText";
import { Skeleton } from "@/components/common/Skeleton";
import { BookCover, bookCorners, BOOK_COVER_RATIO, type BookCoverSize } from "@/components/books/BookCover";
import { theme } from "@/theme";

interface Props {
  title: string;
  author: string;
  coverUrl?: string | null;
  /**
   * The book's first category — the quiet second line under the cover.
   * Optional because a book may legitimately carry no category; the line is
   * then simply absent.
   */
  category?: string | null;
  /**
   * The author line. On by default; the author's own page turns it off,
   * where every card would repeat the name in the page title.
   */
  showAuthor?: boolean;
  /** "lg" draws the author page's larger 4/12 corners and crease. */
  coverSize?: BookCoverSize;
  /** Fixed card width (rails). Omit to fill the parent (grid cells). */
  width?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * THE BOOK CARD (Marquee, Books.dc.html): a hardcover with the author in bold
 * and the category in the quiet ink under it. The title is the one printed on
 * the cover itself — a coverless book has it set on its fallback cover — and
 * it always leads the spoken label, so nothing a reader needs is lost.
 *
 * Flat like every Marquee card: no ring, no border, no shadow. Press scales to
 * 0.96 (an opacity dip under reduce motion, via PressableScale).
 */
export const BookCard = memo(function BookCard({
  title,
  author,
  coverUrl,
  category,
  showAuthor = true,
  coverSize = "sm",
  width,
  onPress,
  style,
}: Props) {
  const label = [title, author].filter(Boolean).join(", ");
  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress}
      activeScale={0.96}
      dimOnPress
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[width ? { width } : styles.stretch, style]}
    >
      <BookCover title={title} coverUrl={coverUrl} size={coverSize} />
      <View style={styles.text}>
        {showAuthor ? (
          <ThemedText variant="caption" weight="bold" color={theme.colors.text} numberOfLines={1}>
            {author}
          </ThemedText>
        ) : null}
        {category ? (
          <ThemedText
            variant={showAuthor ? "label" : "caption"}
            weight={showAuthor ? "regular" : "semibold"}
            color={showAuthor ? theme.colors.textFaint : theme.colors.textMuted}
            numberOfLines={1}
            style={showAuthor ? styles.category : undefined}
          >
            {category}
          </ThemedText>
        ) : null}
      </View>
    </PressableScale>
  );
});

/** Taller than the largest cover the app draws; the 5:7 box clips it. */
const COVER_SKELETON_HEIGHT = 600;

/**
 * Matching placeholder so a loading shelf or grid keeps its layout — the same
 * corners and the same two lines as the real card, or the grid would visibly
 * jump when the books land.
 */
export function BookCardSkeleton({
  width,
  coverSize = "sm",
  lines = 2,
  style,
}: {
  width?: number;
  coverSize?: BookCoverSize;
  lines?: 1 | 2;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[width ? { width } : styles.stretch, style]}>
      {/* The pulse block is taller than any cover and clipped by the 5:7 box,
          so the placeholder takes the cover's exact shape at any width. */}
      <View style={[styles.skeletonCover, bookCorners(coverSize)]}>
        <Skeleton height={COVER_SKELETON_HEIGHT} radius="xs" />
      </View>
      <View style={styles.text}>
        <Skeleton width="72%" height={12} radius="xs" />
        {lines === 2 && <Skeleton width="48%" height={10} radius="xs" style={styles.skeletonMeta} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stretch: { alignSelf: "stretch", width: "100%" },
  text: { marginTop: 10 },
  /** The label role's tracking is for Latin keys; a category is plain words. */
  category: { letterSpacing: 0 },
  skeletonCover: { width: "100%", aspectRatio: BOOK_COVER_RATIO, overflow: "hidden" },
  skeletonMeta: { marginTop: 6 },
});
