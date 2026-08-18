import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { PressableScale } from "@/components/ui/PressableScale";
import { ThemedText } from "@/components/ui/ThemedText";
import { AccessBadge } from "@/components/common/AccessBadge";
import { ProgressTrack } from "@/components/common/ProgressTrack";
import { Skeleton } from "@/components/common/Skeleton";
import { theme } from "@/theme";
import type { AccessType } from "@/types/movie";

/** Fraction of the screen a rail card occupies — a 16:9 still needs the room. */
export const MEDIA_CARD_RAIL_RATIO = 0.78;
export const MEDIA_CARD_POSTER_WIDTH = 48;
const POSTER_HEIGHT = Math.round(MEDIA_CARD_POSTER_WIDTH * 1.5);
/** How far the poster tile rises above the artwork/info seam. */
const POSTER_RISE = 26;

/** Width for a card in a horizontally scrolling rail, clamped on tablets. */
export function useRailCardWidth(ratio: number = MEDIA_CARD_RAIL_RATIO): number {
  const { width } = useWindowDimensions();
  return Math.round(Math.min(width * ratio, 420));
}

export interface MediaCardAction {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  /** Tints the control — e.g. danger for "remove". */
  color?: string;
}

export interface MediaCardProps {
  title: string;
  /** 16:9 artwork — pass `coverUrl ?? posterUrl`. */
  imageUrl?: string | null;
  /** 2:3 poster for the overlapping tile. Omit to hide the tile. */
  posterUrl?: string | null;
  /** Drives the FREE / PREMIUM badge. Omit to hide it. */
  accessType?: AccessType | null;
  rating?: number | null;
  /** Meta segments joined with "·" — year, runtime, episode count, genre. */
  meta?: Array<string | number | null | undefined>;
  /** 0–1 watch progress; renders a violet line across the bottom of the artwork. */
  progress?: number | null;
  /** Small overlay label bottom-right of the artwork, e.g. "S1 · E4". */
  cornerLabel?: string | null;
  /** Fixed card width (rails). Omit to fill the parent (grids/lists). */
  width?: number;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Trailing control on the info row (remove, play, menu…). */
  action?: MediaCardAction;
  /** Hide the overlapping poster tile (e.g. when no poster art exists). */
  showPoster?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * THE card of the app — a landscape "dossier": 16:9 still, a small poster tile
 * straddling the seam below it, then title + meta that are always visible.
 * Used by rails (fixed `width`), grids (one column, no `width`) and list rows.
 */
export function MediaCard({
  title,
  imageUrl,
  posterUrl,
  accessType,
  rating,
  meta,
  progress,
  cornerLabel,
  width,
  onPress,
  onLongPress,
  action,
  showPoster = true,
  style,
}: MediaCardProps) {
  const withPoster = showPoster && !!posterUrl;
  const metaLine = (meta ?? [])
    .filter((part) => part !== null && part !== undefined && `${part}`.length > 0)
    .join("  ·  ");

  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      activeScale={0.975}
      dimOnPress
      accessibilityLabel={title}
      style={[width ? { width } : styles.stretch, style]}
    >
      <View style={styles.artwork}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} />
        ) : (
          <View style={styles.artworkFallback}>
            <Ionicons name="film-outline" size={26} color={theme.colors.textFaint} />
          </View>
        )}

        <LinearGradient
          colors={["transparent", theme.colors.scrimSoft, theme.colors.scrim]}
          locations={[0.45, 0.75, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {accessType && (
          <View style={styles.topLeft}>
            <AccessBadge accessType={accessType} />
          </View>
        )}

        {typeof rating === "number" && rating > 0 && (
          <View style={styles.topRight}>
            <View style={styles.overlayPill}>
              <Ionicons name="star" size={11} color={theme.colors.premium} />
              <ThemedText variant="caption" weight="semibold" tabular>
                {rating.toFixed(1)}
              </ThemedText>
            </View>
          </View>
        )}

        {cornerLabel && (
          <View style={styles.bottomRight}>
            <View style={styles.overlayPill}>
              <ThemedText variant="caption" weight="semibold" tabular numberOfLines={1}>
                {cornerLabel}
              </ThemedText>
            </View>
          </View>
        )}

        {typeof progress === "number" && progress > 0 && (
          <ProgressTrack progress={progress} height={3} style={styles.progress} />
        )}
      </View>

      <View style={[styles.info, withPoster && styles.infoWithPoster]}>
        {withPoster && (
          <View style={styles.posterTile}>
            <Image source={{ uri: posterUrl! }} style={styles.posterImage} contentFit="cover" transition={180} />
          </View>
        )}

        <View style={styles.text}>
          <ThemedText variant="body" weight="semibold" numberOfLines={1}>
            {title}
          </ThemedText>
          {metaLine.length > 0 && (
            <ThemedText variant="caption" numberOfLines={1} tabular>
              {metaLine}
            </ThemedText>
          )}
        </View>

        {action && (
          <PressableScale
            onPress={action.onPress}
            accessibilityLabel={action.label}
            activeScale={0.9}
            style={styles.action}
          >
            <View style={styles.actionInner}>
              <Ionicons name={action.icon} size={18} color={action.color ?? theme.colors.textMuted} />
            </View>
          </PressableScale>
        )}
      </View>
    </PressableScale>
  );
}

/** Matching placeholder so loading rails/grids keep their layout. */
export function MediaCardSkeleton({ width, style }: { width?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[width ? { width } : styles.stretch, style]}>
      <View style={styles.skeletonArtwork} />
      <View style={[styles.info, styles.infoWithPoster]}>
        <View style={[styles.posterTile, styles.skeletonPoster]} />
        <View style={styles.text}>
          <Skeleton width="70%" height={14} radius="sm" />
          <Skeleton width="45%" height={11} radius="sm" style={styles.skeletonMeta} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stretch: { alignSelf: "stretch", width: "100%" },
  artwork: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: theme.radius.card,
    overflow: "hidden",
    backgroundColor: theme.colors.skeleton,
    borderWidth: 1,
    borderColor: theme.colors.ring,
  },
  artworkFallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  topLeft: { position: "absolute", top: theme.spacing.sm, left: theme.spacing.sm },
  topRight: { position: "absolute", top: theme.spacing.sm, right: theme.spacing.sm },
  bottomRight: { position: "absolute", bottom: theme.spacing.sm, right: theme.spacing.sm },
  overlayPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.overlay,
    borderWidth: 1,
    borderColor: theme.colors.ring,
  },
  progress: { position: "absolute", left: 0, right: 0, bottom: 0, borderRadius: 0 },
  info: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    minHeight: 52,
  },
  infoWithPoster: { paddingLeft: MEDIA_CARD_POSTER_WIDTH + theme.spacing.md + theme.spacing.xs },
  posterTile: {
    position: "absolute",
    left: theme.spacing.md,
    top: -POSTER_RISE,
    width: MEDIA_CARD_POSTER_WIDTH,
    height: POSTER_HEIGHT,
    borderRadius: theme.radius.md,
    overflow: "hidden",
    backgroundColor: theme.colors.skeleton,
    borderWidth: 2,
    borderColor: theme.colors.background,
    ...theme.shadow.md,
  },
  posterImage: { width: "100%", height: "100%" },
  text: { flex: 1, gap: 2 },
  action: { width: theme.layout.minTouch, height: theme.layout.minTouch },
  actionInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.secondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  skeletonArtwork: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.skeleton,
  },
  skeletonPoster: { borderColor: theme.colors.background },
  skeletonMeta: { marginTop: 4 },
});
