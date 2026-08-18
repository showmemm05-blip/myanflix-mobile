import { StyleSheet, View, type ViewProps, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { theme } from "@/theme";

interface Props extends ViewProps {
  intensity?: number;
  /** Set false when the card provides its own padding (e.g. a full-bleed header). */
  padded?: boolean;
  /** Tints the glass and its ring with a role colour (violet, gold, emerald…). */
  tint?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Frosted panel used for hero/summary blocks. Real blur (expo-blur) plus a
 * translucent fill, so it still reads as a card where blur is weak.
 */
export function GlassCard({ intensity = 32, padded = true, tint, style, contentStyle, children, ...rest }: Props) {
  return (
    <View {...rest} style={[styles.container, tint ? { borderColor: tint + "33" } : null, style]}>
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.fill, tint ? { backgroundColor: tint + "14" } : null]} />
      <View style={[padded && styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: theme.radius["2xl"],
    borderWidth: 1,
    borderColor: theme.colors.ring,
    overflow: "hidden",
    backgroundColor: theme.colors.surfaceElevated + "B8",
    ...theme.shadow.md,
  },
  fill: { backgroundColor: "transparent" },
  content: { padding: theme.spacing.md },
});
