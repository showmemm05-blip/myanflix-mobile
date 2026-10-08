import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { PressScale } from "@/components/wallet/PressScale";
import { theme } from "@/theme";

interface Props {
  title: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Locks the action while what it would start is already running. */
  disabled?: boolean;
  /** 14pt (default, beside a line of text) or 15pt (a sheet's Clear filters). */
  size?: "sm" | "md";
  style?: StyleProp<ViewStyle>;
}

/**
 * The wallet's quiet action: crimson-link words on the page, ExtraBold, no
 * fill (a page error's Retry, Clear filters). 44pt tall with 12pt either side,
 * so the words line up with the column's text edge when the button hangs 12pt
 * into the margin. The label wraps at large text sizes instead of ending in "…".
 */
export function TextAction({ title, onPress, icon, disabled, size = "sm", style }: Props) {
  return (
    <PressScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled }}
      style={[styles.button, disabled && styles.disabled, style]}
    >
      {icon ? <Ionicons name={icon} size={16} color={theme.colors.link} /> : null}
      <ThemedText weight="extrabold" style={[styles.label, size === "md" && styles.labelMd]}>
        {title}
      </ThemedText>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: theme.layout.minTouch,
    maxWidth: "100%",
    paddingHorizontal: 12,
    paddingVertical: theme.spacing.xs,
  },
  label: { flexShrink: 1, fontSize: 14, color: theme.colors.link, textAlign: "center" },
  labelMd: { fontSize: 15 },
  disabled: { opacity: 0.45 },
});
