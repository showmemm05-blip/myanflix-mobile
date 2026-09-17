import { memo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { PressableScale } from "@/components/ui/PressableScale";
import { ThemedText } from "@/components/ui/ThemedText";
import { Skeleton } from "@/components/common/Skeleton";
import { theme, withAlpha } from "@/theme";

interface Props {
  title: string;
  author: string;
  coverUrl?: string | null;
  /**
   * The book's first category, rendered as the small line above the title —
   * the web card's `book.categories[0]?.name`. Optional because a book may
   * legitimately carry no category; the line is then simply absent.
   */
  category?: string | null;
  /** Fixed card width (rails). Omit to fill the parent (grid cells). */
  width?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Width of the spine crease, matching the web card's `w-[7px]`. */
const SPINE_WIDTH = 7;
/** Width of the page-edge highlight, matching the web card's `w-[3px]`. */
const PAGE_WIDTH = 3;

/**
 * The gradients' far stop must be a ZERO-ALPHA WHITE, never the string
 * "transparent": `transparent` is rgba(0,0,0,0), and Android interpolates
 * through it toward black — a clean fade would come out as a grey haze.
 */
const SPINE_COLORS = ["rgba(0,0,0,0.5)", "rgba(255,255,255,0.15)", "rgba(255,255,255,0)"] as const;
const PAGE_COLORS = ["rgba(255,255,255,0.3)", "rgba(255,255,255,0)"] as const;
const HORIZONTAL_START = { x: 0, y: 0.5 } as const;
const HORIZONTAL_END = { x: 1, y: 0.5 } as const;

/** The web's `text-primary/85` — violet, one notch back from full strength. */
const CATEGORY_COLOR = withAlpha(theme.colors.primary, 0.85);

/**
 * THE BOOK CARD — a hardcover on a shelf, not a movie poster. Mirrors the
 * web's components/media/BookCard, translated into this app's tokens:
 *
 *  - the COVER is a physical object. Its corners are ASYMMETRIC — rounded on
 *    the outer edge (`radius.md`), nearly square on the spine edge
 *    (`radius.xs`) — with a crease of light down the spine and a pale stack of
 *    page edges on the outer side, so a 5:7 rectangle reads as a book rather
 *    than as a tall poster;
 *  - the TYPE is literary, not cinematic: a small category over the title, the
 *    title with room to wrap to two lines, then the author — the line a reader
 *    actually scans a shelf by.
 *
 * WHAT THE WEB DOES THAT THIS DELIBERATELY DOES NOT. The web draws the shelf
 * shadow as a blurred ellipse (`rounded-[100%] blur-[5px]`). RN 0.86 does
 * expose `filter: [{blur}]` and percentage radii, so that IS buildable now —
 * it is just the wrong trade: a blur filter forces an offscreen pass per cell
 * on every scroll frame, and the grid mounts dozens. A real drop shadow on an
 * opaque wrapper — MediaCard's existing `posterShadow` pattern, a gaussian on
 * iOS and elevation on Android — costs nothing and says the same thing. (Note
 * expo-blur is not the alternative: BlurView blurs what is BEHIND it, never
 * its own fill, so it would read as a grey bar.) The hover lift and
 * tilt have no touch equivalent either; PressableScale's press scale-and-dim
 * is this platform's version of that gesture.
 */
export const BookCard = memo(function BookCard({
  title,
  author,
  coverUrl,
  category,
  width,
  onPress,
  style,
}: Props) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress}
      activeScale={0.96}
      dimOnPress
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${author}`}
      style={[width ? { width } : styles.stretch, style]}
    >
      {/* The shadow lives on its own wrapper: the cover below clips to its
          radii, and on iOS `overflow: "hidden"` clips a layer's own shadow
          away — the two can never share one view. */}
      <View style={styles.coverShadow}>
        <View style={styles.cover}>
          {coverUrl ? (
            <Image
              source={{ uri: coverUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={180}
              // Grid cells are unmounted outside the window; the disk-only
              // default re-decodes on every scroll back. See MediaCard.
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={styles.coverFallback}>
              <Ionicons name="book-outline" size={26} color={theme.colors.textFaint} />
            </View>
          )}

          {/* Spine crease: the fold of light where a hardcover's board meets
              the spine. Drawn over the artwork — and over the fallback glyph,
              so even a coverless book still reads as a book. */}
          <LinearGradient
            pointerEvents="none"
            colors={SPINE_COLORS}
            start={HORIZONTAL_START}
            end={HORIZONTAL_END}
            style={styles.spine}
          />
          {/* Page block: the pale stack of page edges past the board. */}
          <LinearGradient
            pointerEvents="none"
            colors={PAGE_COLORS}
            start={HORIZONTAL_END}
            end={HORIZONTAL_START}
            style={styles.pageEdge}
          />
        </View>
      </View>

      <View style={styles.text}>
        {category ? (
          <ThemedText variant="overline" numberOfLines={1} color={CATEGORY_COLOR}>
            {category.toUpperCase()}
          </ThemedText>
        ) : null}
        {/* Semibold, not medium: the web shelf sets its titles in the heading
            face at font-semibold, and this app has one font family — weight is
            the only lever left to keep a book title reading as a spine label
            rather than as a caption. */}
        <ThemedText variant="caption" weight="semibold" color={theme.colors.text} numberOfLines={2}>
          {title}
        </ThemedText>
        <ThemedText variant="caption" numberOfLines={1} style={styles.author}>
          {author}
        </ThemedText>
      </View>
    </PressableScale>
  );
});

/**
 * Matching placeholder so the loading grid keeps its layout — same asymmetric
 * corners and the same THREE text lines as the real card, or the grid would
 * visibly jump when the books land.
 */
export function BookCardSkeleton({ width, style }: { width?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[width ? { width } : styles.stretch, style]}>
      <View style={styles.skeletonCover} />
      <View style={styles.text}>
        <Skeleton width="40%" height={9} radius="sm" />
        <Skeleton width="70%" height={12} radius="sm" style={styles.skeletonMeta} />
        <Skeleton width="45%" height={10} radius="sm" style={styles.skeletonMeta} />
      </View>
    </View>
  );
}

/**
 * The book's corners, spelled once and spread onto all three surfaces (shadow
 * wrapper, cover, skeleton) — rounded on the outer edge, nearly square on the
 * spine edge, the web's 8px/4px ratio expressed in this app's radius tokens.
 * If these drift apart the shadow stops tracing the cover.
 */
const bookCorners = {
  borderTopLeftRadius: theme.radius.xs,
  borderBottomLeftRadius: theme.radius.xs,
  borderTopRightRadius: theme.radius.md,
  borderBottomRightRadius: theme.radius.md,
} as const;

const styles = StyleSheet.create({
  stretch: { alignSelf: "stretch", width: "100%" },
  coverShadow: {
    ...bookCorners,
    // Android's elevation casts nothing through a transparent view, so the
    // wrapper carries an opaque fill of its own.
    backgroundColor: theme.colors.surfaceSunken,
    ...theme.shadow.md,
  },
  cover: {
    width: "100%",
    aspectRatio: 5 / 7,
    ...bookCorners,
    overflow: "hidden",
    backgroundColor: theme.colors.skeleton,
    borderWidth: 1,
    borderColor: theme.colors.ring,
  },
  coverFallback: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  spine: { position: "absolute", left: 0, top: 0, bottom: 0, width: SPINE_WIDTH },
  pageEdge: { position: "absolute", right: 0, top: 0, bottom: 0, width: PAGE_WIDTH },
  text: { marginTop: theme.spacing.sm, gap: 2 },
  author: { fontSize: 12 },
  skeletonCover: {
    width: "100%",
    aspectRatio: 5 / 7,
    ...bookCorners,
    backgroundColor: theme.colors.skeleton,
  },
  skeletonMeta: { marginTop: 2 },
});
