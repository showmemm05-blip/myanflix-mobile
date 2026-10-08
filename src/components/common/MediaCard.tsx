import { memo, type ReactNode } from "react";
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
// Deep subpaths, NOT `from "@expo/vector-icons"`. The package root
// (build/IconsLazy.js) ends in 15 unconditional require() calls, so importing
// from it bundles all 19 icon TTFs (4.0 MB) and 17 glyph maps no matter which
// glyphs we render. Importing each set by file ships only that set.
//
// The premium chip's crown is CrownGlyph — the same Material crown, drawn as
// an SVG, so the 1.3 MB icon font it used to come from no longer ships.
import Ionicons from "@expo/vector-icons/Ionicons";
import { CrownGlyph } from "@/components/common/CrownGlyph";
import { PressableScale } from "@/components/ui/PressableScale";
import { ThemedText } from "@/components/ui/ThemedText";
import { ProgressTrack } from "@/components/common/ProgressTrack";
import { Skeleton } from "@/components/common/Skeleton";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { AccessType } from "@/types/movie";

/** Width for a portrait card in a horizontally scrolling rail, clamped on tablets. */
export function useRailCardWidth(): number {
  const { width } = useWindowDimensions();
  return Math.round(Math.min(width * 0.36, 160));
}

export interface MediaCardProps {
  title: string;
  /** 2:3 portrait art — the primary source now that the poster IS the card. */
  posterUrl?: string | null;
  /** 16:9 art, used only when no poster exists. */
  coverUrl?: string | null;
  /** SUBSCRIPTION shows the gold crown chip; FREE shows nothing (web parity). */
  accessType?: AccessType | null;
  /** Non-null renders "· ★x.x" at the end of the meta line. */
  rating?: number | null;
  /** Meta segments joined with "·" — year, runtime, episode count. */
  meta?: Array<string | number | null | undefined>;
  /** 0–1 watch progress line along the bottom of the poster. */
  progress?: number | null;
  /** Small overlay tag bottom-right of the poster, e.g. "S1 · E3". */
  cornerLabel?: string | null;
  /**
   * The crimson NEW tab on the poster's left edge. Opt-in: only pass it from
   * data that actually says the title is new — never a guess.
   */
  isNew?: boolean;
  /**
   * Stream quality badge top-right of the poster, e.g. "1080p". Opt-in and
   * nullable on purpose: it must only appear when the API actually reports a
   * transcoded rendition, never as a guess. Omitted everywhere it isn't known.
   */
  qualityLabel?: string | null;
  /**
   * A third, quieter line under the meta row. The catalogue stores one genre
   * per title, so this is a single value — do not synthesise a list.
   */
  genre?: string | null;
  /**
   * Drawn in place of the film glyph when there is no art — the hubs pass
   * their HubFallbackArt so a title without a picture still gets a scene.
   * Omitted, the quiet glyph as before.
   */
  fallbackArt?: ReactNode;
  /** Fixed card width (rails). Omit to fill the parent (grid cells). */
  width?: number;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * THE card of the app — a portrait 2:3 poster with title + one quiet meta line
 * below it. Used by rails (fixed `width`) and poster grids (parent-sized cells).
 *
 * Marquee: radius 10 and NOTHING around the art — no ring, no border, no
 * shadow. Marks on the art are small dark-glass chips: the gold crown
 * top-left, quality top-right, an episode/percent tag bottom-right, the
 * crimson NEW tab on the left edge, and a 3pt crimson progress line inset 8.
 */
export const MediaCard = memo(function MediaCard({
  title,
  posterUrl,
  coverUrl,
  accessType,
  rating,
  meta,
  progress,
  cornerLabel,
  qualityLabel,
  isNew,
  genre,
  fallbackArt,
  width,
  onPress,
  onLongPress,
  style,
}: MediaCardProps) {
  const { t } = useLanguage();
  const isPremium = accessType === "SUBSCRIPTION";
  const hasProgress = typeof progress === "number" && progress > 0;
  const imageUrl = posterUrl ?? coverUrl;
  const metaLine = (meta ?? [])
    .filter((part) => part !== null && part !== undefined && `${part}`.length > 0)
    .join(" · ");
  // A VALUE, not a boolean flag: `ratingValue !== null` narrows the type at the
  // render site, so the `.toFixed` below needs no assertion. `0 ?? null` is 0,
  // so a zero rating still renders, exactly as the old boolean allowed.
  const ratingValue = rating ?? null;
  // The progress line is drawn inside the card's button, so a screen reader
  // merges it away — the card has to say it. Whole percent, never 0%.
  const watchedLabel = hasProgress
    ? t.movie.watchedPercent.replace("{n}", String(Math.max(1, Math.min(100, Math.round((progress ?? 0) * 100)))))
    : null;

  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      activeScale={0.96}
      dimOnPress
      accessibilityRole="button"
      // The marks on the art are part of what the card SAYS, not decoration.
      accessibilityLabel={[title, isPremium ? t.movie.premium : null, isNew ? t.movie.newBadge : null, watchedLabel]
        .filter(Boolean)
        .join(", ")}
      style={[width ? { width } : styles.stretch, style]}
    >
      <View style={styles.poster}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={180}
            // Cells are unmounted outside the list window and remounted on
            // the way back; expo-image's disk-only default re-reads and
            // re-decodes the file each time. A poster is at most 200pt wide,
            // so the memory tier is cheap — and expo-image purges it under
            // pressure.
            cachePolicy="memory-disk"
          />
        ) : (
          (fallbackArt ?? (
            <View style={styles.posterFallback}>
              <Ionicons name="film-outline" size={26} color={theme.colors.textFaint} />
            </View>
          ))
        )}

        {/* Access changes what a tap can DO, so the crown owns the top-left
            corner unconditionally — the quality tag takes the other side
            rather than competing for the same slot. */}
        {isPremium && (
          <View style={styles.crown} pointerEvents="none">
            <CrownGlyph size={12} color={theme.colors.premium} />
          </View>
        )}

        {/* The NEW tab hangs off the left edge, below the crown when both apply. */}
        {isNew ? (
          <View style={[styles.newTab, isPremium && styles.newTabBelowCrown]} pointerEvents="none">
            <ThemedText variant="overline" color={theme.colors.onPrimary} style={styles.newTabText}>
              {t.movie.newBadge.toUpperCase()}
            </ThemedText>
          </View>
        ) : null}

        {qualityLabel ? (
          <View style={[styles.artTag, styles.quality]} pointerEvents="none">
            <ThemedText variant="overline" color={theme.colors.text} tabular>
              {qualityLabel}
            </ThemedText>
          </View>
        ) : null}

        {cornerLabel ? (
          <View style={[styles.artTag, styles.cornerLabel, hasProgress && styles.cornerLabelAboveProgress]} pointerEvents="none">
            <ThemedText variant="overline" color={theme.colors.text} tabular>
              {cornerLabel}
            </ThemedText>
          </View>
        ) : null}

        {hasProgress && (
          <ProgressTrack progress={progress ?? 0} height={3} trackColor={theme.colors.track} style={styles.progress} />
        )}
      </View>

      <View style={styles.text}>
        <ThemedText variant="caption" weight="bold" color={theme.colors.text} numberOfLines={1}>
          {title}
        </ThemedText>
        {(metaLine.length > 0 || ratingValue !== null) && (
          <View style={styles.metaRow}>
            {metaLine.length > 0 && (
              <ThemedText variant="caption" weight="regular" numberOfLines={1} tabular color={theme.colors.textFaint} style={styles.metaText}>
                {ratingValue !== null ? `${metaLine} · ` : metaLine}
              </ThemedText>
            )}
            {ratingValue !== null && (
              <>
                <Ionicons name="star" size={10} color={theme.colors.premium} />
                <ThemedText variant="caption" weight="regular" tabular color={theme.colors.textFaint} style={styles.metaText}>
                  {ratingValue.toFixed(1)}
                </ThemedText>
              </>
            )}
          </View>
        )}
        {genre ? (
          <ThemedText variant="caption" weight="regular" numberOfLines={1} color={theme.colors.textFaint} style={styles.metaText}>
            {genre}
          </ThemedText>
        ) : null}
      </View>
    </PressableScale>
  );
});

/** Matching placeholder so loading rails/grids keep their layout. */
export function MediaCardSkeleton({
  width,
  metaLines = 1,
  style,
}: {
  width?: number;
  /**
   * Quiet lines under the title, matching whatever the real card will show —
   * one for a rail (meta only), two where the genre line is switched on. The
   * placeholder has to be the same height as its replacement or the grid
   * shifts under the user's thumb the moment results land.
   */
  metaLines?: 1 | 2;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[width ? { width } : styles.stretch, style]}>
      <View style={styles.skeletonPoster} />
      <View style={styles.text}>
        <Skeleton width="60%" height={12} radius="sm" />
        <Skeleton width="40%" height={10} radius="sm" style={styles.skeletonMeta} />
        {metaLines === 2 && <Skeleton width="50%" height={10} radius="sm" style={styles.skeletonMeta} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stretch: { alignSelf: "stretch", width: "100%" },
  /** No ring, no border, no shadow: the art meets the page directly. */
  poster: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: theme.radius.card,
    overflow: "hidden",
    backgroundColor: theme.colors.skeleton,
  },
  posterFallback: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  /** DesignSystem: 22pt chip, radius 6, dark glass, gold crown. */
  crown: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: theme.colors.artBadge,
    alignItems: "center",
    justifyContent: "center",
  },
  /** DesignSystem: a crimson tab flush with the left edge, square on that side. */
  newTab: {
    position: "absolute",
    left: 0,
    top: 10,
    minHeight: 20,
    paddingHorizontal: 7,
    justifyContent: "center",
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  newTabBelowCrown: { top: 36 },
  newTabText: { fontSize: 10 },
  /** The quality and corner tags: the crown's dark glass, sized to their text. */
  artTag: {
    position: "absolute",
    minHeight: 22,
    paddingHorizontal: 6,
    borderRadius: 6,
    justifyContent: "center",
    backgroundColor: theme.colors.artBadge,
  },
  /** The crown owns the left corner, so quality takes the right one. */
  quality: { top: 8, right: 8 },
  cornerLabel: { bottom: 8, right: 8 },
  cornerLabelAboveProgress: { bottom: 15 },
  /** DesignSystem: 3pt, inset 8 from the sides, 6 from the bottom. */
  progress: { position: "absolute", left: 8, right: 8, bottom: 6, width: "auto" },
  text: { marginTop: theme.spacing.sm, gap: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  /** DesignSystem: the line under a poster title is 12pt, #8C8C99. */
  metaText: { fontSize: 12, flexShrink: 1 },
  skeletonPoster: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.skeleton,
  },
  skeletonMeta: { marginTop: 2 },
});
