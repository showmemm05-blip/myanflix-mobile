import { memo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { containsMyanmar } from "@/components/books/RichText";
import { theme } from "@/theme";

/**
 * Marquee's two hardcover sizes (Books.dc.html / BookDetail.dc.html):
 *  - "sm" — shelf and grid cards: corners 3 (spine) / 10 (fore-edge), a 7pt crease;
 *  - "lg" — the hero cover on Books, BookDetail and the author page: 4 / 12, a 9pt crease.
 */
export type BookCoverSize = "sm" | "lg";

const CORNERS: Record<BookCoverSize, { spine: number; edge: number; crease: number }> = {
  sm: { spine: 3, edge: theme.radius.card, crease: 7 },
  lg: { spine: 4, edge: theme.radius.lg, crease: 9 },
};

/** The board's cover ratio — 5:7, never the 2:3 of a film poster. */
export const BOOK_COVER_RATIO = 5 / 7;

/**
 * The crease of light down the spine: dark at the hinge, a pale ridge, then
 * clear. The far stop is a ZERO-ALPHA WHITE, never "transparent" — that is
 * rgba(0,0,0,0) and Android interpolates through it toward black, so the
 * clean fade would come out as a grey haze.
 */
const CREASE = ["rgba(0,0,0,0.45)", "rgba(255,255,255,0.12)", "rgba(255,255,255,0)"] as const;
const LEFT = { x: 0, y: 0.5 } as const;
const RIGHT = { x: 1, y: 0.5 } as const;

/** The book's corners as a style — spine edge nearly square, fore-edge rounded. */
export function bookCorners(size: BookCoverSize = "sm") {
  const c = CORNERS[size];
  return {
    borderTopLeftRadius: c.spine,
    borderBottomLeftRadius: c.spine,
    borderTopRightRadius: c.edge,
    borderBottomRightRadius: c.edge,
  } as const;
}

interface Props {
  /** Set on the fallback cover only — a real cover prints its own title. */
  title: string;
  coverUrl?: string | null;
  size?: BookCoverSize;
  /**
   * A chapter that is not out yet: the art fades back (Marquee drops the old
   * whole-row opacity dim, which failed contrast on the words beside it).
   */
  faded?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * One hardcover: the REAL cover image from the catalogue (expo-image), with
 * the board's spine crease drawn over it so a 5:7 rectangle reads as a book.
 *
 * A book with no cover gets the board's drawn treatment instead — a raised
 * fill with the title set on the board's lower-left in black weight, so a
 * coverless title is still legible on a shelf. Purely visual: the caller's
 * pressable carries the spoken label.
 */
export const BookCover = memo(function BookCover({ title, coverUrl, size = "sm", faded, style }: Props) {
  const crease = CORNERS[size].crease;
  return (
    <View
      style={[styles.cover, bookCorners(size), style]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {coverUrl ? (
        <Image
          source={{ uri: coverUrl }}
          style={[StyleSheet.absoluteFill, faded && styles.faded]}
          contentFit="cover"
          transition={180}
          // Grid and shelf cells are unmounted outside the list window; the
          // disk-only default re-decodes on every scroll back. See MediaCard.
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[styles.fallback, faded && styles.faded]}>
          <Ionicons
            name="book-outline"
            size={size === "lg" ? 30 : 22}
            color={theme.colors.textFaint}
            style={styles.fallbackGlyph}
          />
          <ThemedText
            variant="caption"
            weight="black"
            numberOfLines={4}
            color={theme.colors.text}
            // The board's tight Latin setting; a Burmese title keeps ThemedText's
            // rule instead (no tracking, +4 line height for the stacked marks),
            // which this style would otherwise override.
            style={[
              styles.fallbackTitle,
              size === "lg" && styles.fallbackTitleLg,
              containsMyanmar(title) && (size === "lg" ? styles.fallbackTitleLgMyanmar : styles.fallbackTitleMyanmar),
              { left: crease + 6 },
            ]}
          >
            {title}
          </ThemedText>
        </View>
      )}
      <LinearGradient
        pointerEvents="none"
        colors={CREASE}
        locations={[0, 0.5, 1]}
        start={LEFT}
        end={RIGHT}
        style={[styles.crease, { width: crease }]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  cover: {
    width: "100%",
    aspectRatio: BOOK_COVER_RATIO,
    overflow: "hidden",
    backgroundColor: theme.colors.surfaceElevated,
  },
  faded: { opacity: 0.35 },
  fallback: { ...StyleSheet.absoluteFill, backgroundColor: theme.colors.surfaceElevated },
  fallbackGlyph: { position: "absolute", top: "30%", alignSelf: "center" },
  fallbackTitle: {
    position: "absolute",
    right: 8,
    bottom: 9,
    fontSize: 12,
    lineHeight: 14,
    letterSpacing: -0.2,
  },
  fallbackTitleLg: { fontSize: 18, lineHeight: 20, bottom: 14, right: 12 },
  fallbackTitleMyanmar: { lineHeight: 18, letterSpacing: 0 },
  fallbackTitleLgMyanmar: { lineHeight: 24, letterSpacing: 0 },
  crease: { position: "absolute", left: 0, top: 0, bottom: 0 },
});
