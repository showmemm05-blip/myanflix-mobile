import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { onSolid, theme, withAlpha } from "@/theme";

export type IconButtonVariant = "outline" | "ghost" | "soft" | "solid";
export type IconButtonSize = "sm" | "md" | "lg";

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  color?: string;
  disabled?: boolean;
  /** Small dot in the top-right corner (unread / attention). */
  badge?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const SIZES: Record<IconButtonSize, { box: number; icon: number; radius: number }> = {
  sm: { box: theme.layout.minTouch, icon: 18, radius: theme.radius.lg },
  md: { box: 48, icon: 20, radius: theme.radius.xl },
  lg: { box: 56, icon: 24, radius: theme.radius["2xl"] },
};

/**
 * The one round/rounded icon control. Every size is at least 44pt so any
 * variant is safe to drop into a toolbar without extra hitSlop maths.
 */
export function IconButton({
  icon,
  onPress,
  variant = "outline",
  size = "md",
  color,
  disabled,
  badge,
  accessibilityLabel,
  style,
}: Props) {
  const dims = SIZES[size];
  const accent = color ?? theme.colors.primary;
  // Solid icons take their ink from the fill's role — same rule as Button, so a
  // gold or emerald solid IconButton isn't stamped with the violet foreground.
  const iconColor = variant === "solid" ? onSolid(accent) : variant === "soft" ? accent : color ?? theme.colors.text;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        { width: dims.box, height: dims.box, borderRadius: dims.radius },
        variant === "outline" && styles.outline,
        variant === "outline" && color && { borderColor: withAlpha(color, 0.4) },
        variant === "ghost" && styles.ghost,
        variant === "soft" && {
          backgroundColor: withAlpha(accent, 0.12),
          borderWidth: 1,
          borderColor: withAlpha(accent, 0.2),
        },
        variant === "solid" && { backgroundColor: accent },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
    >
      <Ionicons name={icon} size={dims.icon} color={iconColor} />
      {badge && <View style={styles.badge} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
  outline: { backgroundColor: "transparent", borderWidth: 1, borderColor: theme.colors.border },
  ghost: { backgroundColor: "transparent" },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
  badge: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    borderWidth: 1.5,
    borderColor: theme.colors.background,
  },
});
