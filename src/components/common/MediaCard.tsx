import { memo } from "react";
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
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
  const showRating = rating !== null && rating !== undefined;

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
      <View style={styles.poster}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} />
        ) : (
          <View style={styles.posterFallback}>
            <Ionicons name="film-outline" size={26} color={theme.colors.textFaint} />
          </View>
        )}

        {accessType === "SUBSCRIPTION" && (
          <View style={styles.crown} accessibilityLabel={t.movie.premium}>
            <MaterialCommunityIcons name="crown" size={12} color={theme.colors.onPremium} />
          </View>
        )}

        {cornerLabel ? (
          <View style={styles.cornerLabel} pointerEvents="none">
            <Pill tone="overlay">{cornerLabel}</Pill>
          </View>
        ) : null}

        {typeof progress === "number" && progress > 0 && (
          <ProgressTrack progress={progress} height={3} style={styles.progress} />
        )}
      </View>

      <View style={styles.text}>
        <ThemedText variant="caption" weight="medium" color={theme.colors.text} numberOfLines={1}>
          {title}
        </ThemedText>
        {(metaLine.length > 0 || showRating) && (
          <View style={styles.metaRow}>
            {metaLine.length > 0 && (
              <ThemedText variant="caption" numberOfLines={1} tabular style={styles.metaText}>
                {showRating ? `${metaLine} · ` : metaLine}
              </ThemedText>
            )}
            {showRating && (
              <>
                <Ionicons name="star" size={10} color={theme.colors.premium} />
                <ThemedText variant="caption" tabular style={styles.metaText}>
                  {rating!.toFixed(1)}
                </ThemedText>
              </>
            )}
          </View>
        )}
      </View>
    </PressableScale>
  );
});

/** Matching placeholder so loading rails/grids keep their layout. */
export function MediaCardSkeleton({ width, style }: { width?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[width ? { width } : styles.stretch, style]}>
      <View style={styles.skeletonPoster} />
      <View style={styles.text}>
        <Skeleton width="60%" height={12} radius="sm" />
        <Skeleton width="40%" height={10} radius="sm" style={styles.skeletonMeta} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stretch: { alignSelf: "stretch", width: "100%" },
  poster: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    backgroundColor: theme.colors.skeleton,
    borderWidth: 1,
    borderColor: theme.colors.ring,
  },
  posterFallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
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
  cornerLabel: { position: "absolute", bottom: 6, right: 6 },
  progress: { position: "absolute", left: 6, right: 6, bottom: 6, width: "auto" },
  text: { marginTop: theme.spacing.sm, gap: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaText: { fontSize: 12, flexShrink: 1 },
  skeletonPoster: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.skeleton,
  },
  skeletonMeta: { marginTop: 2 },
});
