import { View, StyleSheet, type ViewProps, type StyleProp, type ViewStyle } from "react-native";
import { theme } from "@/theme";

export type SurfaceTone = "default" | "sunken" | "flat" | "accent";

interface Props extends ViewProps {
  radius?: keyof typeof theme.radius;
  /** default = lifted card, sunken = inset well, flat = no shadow, accent = violet-tinted selection. */
  tone?: SurfaceTone;
  /** Adds the standard 16pt inner padding so callers stop re-declaring it. */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}

// The one shared card surface used everywhere (rows, tiles, stat cards) —
// solid, not blurred, so it always looks the same regardless of platform
// blur support, with a soft shadow so cards read as "lifted" rather than flat.
export function Surface({ radius = "xl", tone = "default", padded, style, children, ...rest }: Props) {
  return (
    <View
      {...rest}
      style={[
        styles.base,
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
  base: { borderWidth: 1 },
  toneDefault: {
    backgroundColor: theme.colors.surfaceElevated,
    borderColor: theme.colors.border,
    ...theme.shadow.sm,
  },
  toneSunken: { backgroundColor: theme.colors.surfaceSunken, borderColor: theme.colors.border },
  toneFlat: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
  toneAccent: { backgroundColor: theme.colors.accent, borderColor: theme.colors.primary + "3D" },
  padded: { padding: theme.spacing.md },
});
