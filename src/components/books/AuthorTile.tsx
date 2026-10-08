import { memo } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PressableScale } from "@/components/ui/PressableScale";
import { ThemedText } from "@/components/ui/ThemedText";
import { Skeleton } from "@/components/common/Skeleton";
import { personInitials } from "@/components/common/ActorAvatar";
import { authorTone } from "@/components/books/AuthorPortrait";
import { containsMyanmar } from "@/components/books/RichText";
import { theme, withAlpha } from "@/theme";

/** Authors.dc.html: a 171 × 214 tile — portrait art, name and count set on it. */
const TILE_RATIO = 171 / 214;
const GAP = 16;
/** A tile narrower than this stops reading as a portrait, so a column is dropped. */
const MIN_TILE = 170;
const MAX_COLUMNS = 6;

/** Fades the art into the ground under the name — the board's bottom scrim, 0 → 88%. */
const NAME_SCRIM_ALPHA = 0.88;
const NAME_SCRIM = [withAlpha(theme.colors.background, 0), withAlpha(theme.colors.background, NAME_SCRIM_ALPHA)] as const;

export interface AuthorGridLayout {
  columns: number;
  gap: number;
  cellWidth: number;
}

/**
 * Two tiles a row on a phone (171pt each on the 390pt board), more on a
 * tablet or a landscape phone — driven by the resulting tile width, so an
 * unusual window still lands on a sensible tile.
 */
export function useAuthorGrid(): AuthorGridLayout {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const track = width - insets.left - insets.right - 2 * theme.layout.screenPadding;
  const columns = Math.min(MAX_COLUMNS, Math.max(2, Math.floor((track + GAP) / (MIN_TILE + GAP))));
  return { columns, gap: GAP, cellWidth: Math.floor((track - (columns - 1) * GAP) / columns) };
}

interface Props {
  id: string;
  name: string;
  imageUrl: string | null;
  /** The localized count line ("6 books"). */
  countLabel: string;
  width: number;
  onPress: () => void;
}

/** Authors.dc.html: the initials start 52pt down the 214pt tile. */
const INITIALS_TOP = 52 / 214;
/** The initials' line box (56pt glyphs on a 72pt line). */
const INITIALS_LINE = 72;
/** How far the name scrim fades in above the caption (the board's 100pt scrim over a one-line caption). */
const SCRIM_LEAD = 48;

/**
 * One author in the Authors grid: their photo filling the tile when the
 * catalogue has one, otherwise the board's large tinted initials — with the
 * name and book count set on a scrim at the foot.
 *
 * The tile is the board's 171 × 214 at the least, never a fixed box: the
 * caption sits in flow at the foot and may rise only to the middle of the
 * initials. A three-line name at a large OS text size makes the tile (and,
 * through the grid row's stretch, its neighbour) taller instead of running
 * the name over the initials and out of the clipped top.
 */
export const AuthorTile = memo(function AuthorTile({ id, name, imageUrl, countLabel, width, onPress }: Props) {
  const tone = authorTone(id);
  const minHeight = Math.round(width / TILE_RATIO);
  const initialsTop = Math.round(minHeight * INITIALS_TOP);
  const initials = personInitials(name);
  return (
    <PressableScale onPress={onPress} accessibilityLabel={`${name}, ${countLabel}`} style={{ width }}>
      <View style={[styles.tile, { minHeight, backgroundColor: tone.fill }]}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={180}
            cachePolicy="memory-disk"
          />
        ) : (
          <ThemedText
            weight="extrabold"
            color={tone.ink}
            numberOfLines={1}
            allowFontScaling={false}
            // The board's -0.02em, never on Myanmar letters (ThemedText's rule —
            // a style's own tracking would override it).
            style={[styles.initials, { top: initialsTop }, !containsMyanmar(initials) && styles.initialsTracked]}
          >
            {initials}
          </ThemedText>
        )}
        {/* In-flow clearance: the caption never climbs past the initials' middle. */}
        <View style={{ height: initialsTop + INITIALS_LINE / 2 }} />
        <View style={styles.caption}>
          <LinearGradient colors={NAME_SCRIM} style={styles.scrimLead} pointerEvents="none" />
          <View style={styles.scrimBody} pointerEvents="none" />
          <ThemedText
            weight="extrabold"
            color={theme.colors.text}
            numberOfLines={3}
            // A Burmese name needs the +4 room for its stacked marks.
            style={[styles.name, containsMyanmar(name) && styles.nameMyanmar]}
          >
            {name}
          </ThemedText>
          <ThemedText variant="caption" tabular color={theme.colors.textBody} numberOfLines={1}>
            {countLabel}
          </ThemedText>
        </View>
      </View>
    </PressableScale>
  );
});

/** The loading tile — the same box, one pulse. */
export function AuthorTileSkeleton({ width }: { width: number }) {
  return (
    <View style={[styles.skeletonTile, { width }]}>
      <Skeleton height={600} radius="lg" />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    // Grows with the grid row (the row stretches every tile to its tallest).
    flexGrow: 1,
    justifyContent: "flex-end",
    borderRadius: theme.radius.lg,
    overflow: "hidden",
  },
  skeletonTile: {
    aspectRatio: TILE_RATIO,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    backgroundColor: theme.colors.skeleton,
  },
  initials: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 56,
    lineHeight: INITIALS_LINE,
  },
  initialsTracked: { letterSpacing: -1 },
  caption: { paddingHorizontal: 14, paddingBottom: 12 },
  /** The fade above the caption; the caption itself sits on the scrim's full strength. */
  scrimLead: { position: "absolute", left: 0, right: 0, top: -SCRIM_LEAD, height: SCRIM_LEAD },
  scrimBody: {
    ...StyleSheet.absoluteFill,
    backgroundColor: withAlpha(theme.colors.background, NAME_SCRIM_ALPHA),
  },
  name: { fontSize: 17, lineHeight: 22 },
  nameMyanmar: { lineHeight: 26 },
});
