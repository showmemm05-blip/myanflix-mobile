import { memo } from "react";
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
// Deep subpaths, NOT `from "@expo/vector-icons"`. The package root
// (build/IconsLazy.js) ends in 15 unconditional require() calls, so importing
// from it bundles all 19 icon TTFs (4.0 MB) and 17 glyph maps no matter which
// glyphs we render. Importing each set by file ships only that set.
//
// MaterialCommunityIcons is here for exactly one glyph — the `crown` on the
// premium badge at :111 — and its TTF is 1.3 MB, the largest asset the app
// ships. That is a deliberate, owner-approved cost: the crown is the premium
// mark and is not being substituted. If it ever is, drop this import too.
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { PressableScale } from "@/components/ui/PressableScale";
import { ThemedText } from "@/components/ui/ThemedText";
import { Pill } from "@/components/ui/Pill";
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
  /** SUBSCRIPTION shows the gold crown disc; FREE shows nothing (web parity). */
  accessType?: AccessType | null;
  /** Non-null renders "· ★x.x" at the end of the meta line. */
  rating?: number | null;
  /** Meta segments joined with "·" — year, runtime, episode count. */
  meta?: Array<string | number | null | undefined>;
  /** 0–1 watch progress line along the bottom of the poster. */
  progress?: number | null;
  /** Small overlay pill bottom-right of the poster, e.g. "S1 · E3". */
  cornerLabel?: string | null;
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
  /** Fixed card width (rails). Omit to fill the parent (grid cells). */
  width?: number;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * THE card of the app — a portrait 2:3 poster with title + one quiet meta line
 * below it, matching the web's MediaCard. Used by rails (fixed `width`) and
 * poster grids (parent-sized cells).
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
  genre,
  width,
  onPress,
  onLongPress,
  style,
}: MediaCardProps) {
  const { t } = useLanguage();
  const imageUrl = posterUrl ?? coverUrl;
  const metaLine = (meta ?? [])
    .filter((part) => part !== null && part !== undefined && `${part}`.length > 0)
    .join(" · ");
  // A VALUE, not a boolean flag: `ratingValue !== null` narrows the type at the
  // render site, so the `.toFixed` below needs no assertion. `0 ?? null` is 0,
  // so a zero rating still renders, exactly as the old boolean allowed.
  const ratingValue = rating ?? null;

  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      activeScale={0.96}
      dimOnPress
      accessibilityRole="button"
      accessibilityLabel={title}
      style={[width ? { width } : styles.stretch, style]}
    >
      {/* The lift lives on a wrapper, not on the poster itself: `overflow:
          hidden` is what keeps the artwork inside the corner radius, and on
          iOS that same flag clips the layer's own shadow away. */}
      <View style={styles.posterShadow}>
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
            <View style={styles.posterFallback}>
              <Ionicons name="film-outline" size={26} color={theme.colors.textFaint} />
            </View>
          )}

          {/* Access changes what a tap can DO, so the crown owns the top-left
              corner unconditionally — the quality badge takes the other side
              rather than competing for the same slot. */}
          {accessType === "SUBSCRIPTION" && (
            <View style={styles.crown} accessibilityLabel={t.movie.premium}>
              <MaterialCommunityIcons name="crown" size={12} color={theme.colors.onPremium} />
            </View>
          )}

          {qualityLabel ? (
            <View style={styles.quality} pointerEvents="none">
              <Pill tone="overlay">{qualityLabel}</Pill>
            </View>
          ) : null}

          {cornerLabel ? (
            <View style={styles.cornerLabel} pointerEvents="none">
              <Pill tone="overlay">{cornerLabel}</Pill>
            </View>
          ) : null}

          {typeof progress === "number" && progress > 0 && (
            <ProgressTrack progress={progress} height={3} style={styles.progress} />
          )}
        </View>
      </View>

      <View style={styles.text}>
        <ThemedText variant="caption" weight="medium" color={theme.colors.text} numberOfLines={1}>
          {title}
        </ThemedText>
        {(metaLine.length > 0 || ratingValue !== null) && (
          <View style={styles.metaRow}>
            {metaLine.length > 0 && (
              <ThemedText variant="caption" numberOfLines={1} tabular style={styles.metaText}>
                {ratingValue !== null ? `${metaLine} · ` : metaLine}
              </ThemedText>
            )}
            {ratingValue !== null && (
              <>
                <Ionicons name="star" size={10} color={theme.colors.premium} />
                <ThemedText variant="caption" tabular style={styles.metaText}>
                  {ratingValue.toFixed(1)}
                </ThemedText>
              </>
            )}
          </View>
        )}
        {genre ? (
          <ThemedText variant="caption" numberOfLines={1} color={theme.colors.textFaint} style={styles.metaText}>
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
  /**
   * Carries the lift so the poster below can keep `overflow: hidden` — on iOS
   * that flag clips a layer's own shadow away, so the two cannot share a view.
   * The opaque fill is what Android's `elevation` needs to cast anything.
   */
  posterShadow: {
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surfaceSunken,
    ...theme.shadow.sm,
  },
  poster: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: theme.radius.card,
    overflow: "hidden",
    backgroundColor: theme.colors.skeleton,
    borderWidth: 1,
    borderColor: theme.colors.ring,
  },
  posterFallback: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  crown: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.premium,
    alignItems: "center",
    justifyContent: "center",
  },
  /** The crown owns the left corner, so quality takes the right one. */
  quality: { position: "absolute", top: 8, right: 8 },
  cornerLabel: { position: "absolute", bottom: 6, right: 6 },
  progress: { position: "absolute", left: 6, right: 6, bottom: 6, width: "auto" },
  text: { marginTop: theme.spacing.sm, gap: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaText: { fontSize: 12, flexShrink: 1 },
  skeletonPoster: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.skeleton,
  },
  skeletonMeta: { marginTop: 2 },
});
