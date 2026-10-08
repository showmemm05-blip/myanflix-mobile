import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ProgressTrack } from "@/components/common/ProgressTrack";
import { theme, withAlpha } from "@/theme";

interface Props {
  /** The real 2:3 poster. Null/undefined draws the quiet film-glyph tile. */
  uri?: string | null;
  width: number;
  /** Defaults to the 2:3 poster height. */
  height?: number;
  radius?: number;
  /**
   * Darkens the bottom of the art (Marquee's poster recipe: the ground at ~35%
   * over the lower third), so a progress line or a mark stays legible on a
   * bright poster.
   */
  shade?: boolean;
  /** 0–1. Draws the 3pt line inset 8 from the sides and 6 from the bottom. */
  progress?: number | null;
  /** The line's fill — crimson while in progress, grey once watched. */
  progressColor?: string;
  /** Glyph size of the no-image fallback. */
  fallbackIconSize?: number;
  /** Extra marks drawn over the art (a play disc, a crown). */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

const SHADE = [withAlpha(theme.colors.background, 0), withAlpha(theme.colors.background, 0.5)] as const;
const SHADE_STOPS = [0.55, 1] as const;

/**
 * The library's small poster: real artwork through expo-image (memory-disk
 * cached, a short cross-fade), radius 10 by default and nothing around it —
 * no ring, no border, no shadow, exactly like the shared MediaCard. Purely
 * visual: the row or card that holds it owns the press and the spoken label.
 */
export function PosterThumb({
  uri,
  width,
  height,
  radius = theme.radius.card,
  shade,
  progress,
  progressColor = theme.colors.primary,
  fallbackIconSize = 22,
  children,
  style,
}: Props) {
  const showProgress = typeof progress === "number" && progress > 0;
  return (
    <View
      style={[styles.box, { width, height: height ?? Math.round(width * 1.5), borderRadius: radius }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={180}
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={styles.fallback}>
          <Ionicons name="film-outline" size={fallbackIconSize} color={theme.colors.textFaint} />
        </View>
      )}
      {shade || showProgress ? (
        <LinearGradient colors={SHADE} locations={SHADE_STOPS} style={StyleSheet.absoluteFill} pointerEvents="none" />
      ) : null}
      {children}
      {showProgress ? (
        <ProgressTrack
          progress={progress ?? 0}
          height={3}
          color={progressColor}
          trackColor={theme.colors.track}
          style={styles.progress}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: "hidden", backgroundColor: theme.colors.skeleton },
  fallback: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  progress: { position: "absolute", left: 8, right: 8, bottom: 6, width: "auto" },
});
