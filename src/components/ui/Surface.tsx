import { View, StyleSheet, type ViewProps, type StyleProp, type ViewStyle } from "react-native";
import { theme } from "@/theme";

export type SurfaceTone = "default" | "sunken" | "flat" | "accent";

interface Props extends ViewProps {
  radius?: keyof typeof theme.radius;
  /**
   * default = a raised panel (#1C1C23 — also visible inside a #121217 sheet),
   * flat = the quieter page panel (#121217), sunken = an inset well,
   * accent = the crimson-tinted "selected" fill.
   */
  tone?: SurfaceTone;
  /** Adds the standard 16pt inner padding so callers stop re-declaring it. */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}

// The one shared card surface used everywhere (rows, tiles, stat cards) —
// solid, not blurred, so it always looks the same regardless of platform blur
// support. Marquee is flat: a panel is told apart from the page by its fill
// alone — no border, no shadow (a caller's own `style` may still add either).
export function Surface({ radius = "xl", tone = "default", padded, style, children, ...rest }: Props) {
  return (
    <View
      {...rest}
      style={[
        { borderRadius: theme.radius[radius] },
        tone === "default" && styles.toneDefault,
        tone === "sunken" && styles.toneSunken,
        tone === "flat" && styles.toneFlat,
        tone === "accent" && styles.toneAccent,
        padded && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  toneDefault: { backgroundColor: theme.colors.surfaceElevated },
  toneSunken: { backgroundColor: theme.colors.surfaceSunken },
  toneFlat: { backgroundColor: theme.colors.surface },
  toneAccent: { backgroundColor: theme.colors.accent },
  padded: { padding: theme.spacing.md },
});
