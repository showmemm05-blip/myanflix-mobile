import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { theme, withAlpha } from "@/theme";

export type AuroraTone = "violet" | "emerald" | "gold" | "crimson" | "night";

interface Props {
  /** Which role the wash belongs to — violet for content, emerald for money, gold for premium. */
  tone?: AuroraTone;
  /** How tall the wash is before it dissolves into the page background. */
  height?: number;
  /** 0–1 multiplier on the wash strength. */
  intensity?: number;
  /** Anchors the wash to the bottom of its parent instead of the top. */
  anchor?: "top" | "bottom";
  style?: StyleProp<ViewStyle>;
}

const TONES: Record<AuroraTone, [string, string]> = {
  violet: [theme.colors.aurora.violet, theme.colors.aurora.indigo],
  emerald: [theme.colors.aurora.emerald, theme.colors.aurora.indigo],
  gold: [theme.colors.aurora.gold, theme.colors.aurora.violet],
  crimson: [theme.colors.aurora.crimson, theme.colors.aurora.violet],
  night: [theme.colors.aurora.indigo, theme.colors.aurora.violet],
};

/**
 * The ambient light wash behind hero areas, auth screens and empty pages.
 * Two crossing linear gradients (no blur, no images) fading to transparent, so
 * it costs nothing to render and never blocks touches.
 */
export function AuroraBackdrop({ tone = "violet", height = 340, intensity = 1, anchor = "top", style }: Props) {
  const [primaryHue, secondaryHue] = TONES[tone];
  const fromTop = anchor === "top";
  const glowColors: readonly [string, string, string] = [
    withAlpha(primaryHue, 0.42 * intensity),
    withAlpha(primaryHue, 0.1 * intensity),
    "transparent",
  ];
  const sweepColors: readonly [string, string, string] = [
    "transparent",
    withAlpha(secondaryHue, 0.26 * intensity),
    "transparent",
  ];
  const fadeColors: readonly [string, string] = fromTop
    ? ["transparent", theme.colors.background]
    : [theme.colors.background, "transparent"];
  const fadeLocations: readonly [number, number] = fromTop ? [0.35, 1] : [0, 0.65];

  return (
    <View
      pointerEvents="none"
      style={[styles.container, { height }, fromTop ? styles.top : styles.bottom, style]}
    >
      <LinearGradient
        colors={glowColors}
        locations={[0, 0.45, 1]}
        start={{ x: 0.15, y: fromTop ? 0 : 1 }}
        end={{ x: 0.75, y: fromTop ? 1 : 0 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={sweepColors}
        locations={[0, 0.3, 1]}
        start={{ x: 1, y: fromTop ? 0 : 1 }}
        end={{ x: 0.1, y: fromTop ? 0.9 : 0.1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient colors={fadeColors} locations={fadeLocations} style={StyleSheet.absoluteFill} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "absolute", left: 0, right: 0 },
  top: { top: 0 },
  bottom: { bottom: 0 },
});
