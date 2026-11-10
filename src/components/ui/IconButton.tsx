import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { GlassFace } from "@/components/layout/GlassFace";
import { onSolid, theme, withAlpha } from "@/theme";

/**
 * - `tonal` — the Marquee round control: white at 12%, no border (Share).
 * - `outline` — kept for existing callers; Marquee draws no borders, so it
 *   renders exactly like `tonal` (with `color`, a faint tint of it instead).
 * - `soft` — tinted fill + tinted icon for a role (a saved heart).
 * - `solid` — a role fill with its own ink (onSolid).
 * - `ghost` — no fill at all.
 */
export type IconButtonVariant = "outline" | "ghost" | "soft" | "solid" | "tonal";
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
  /**
   * A top-bar control over artwork (the Subscribe sheet's close): the top
   * bars' Liquid Glass circle (GlassFace) instead of the variant's fill, so
   * the glyph stays legible on any image. Pressed, it shrinks but never dims
   * (an iOS blur under a parent with alpha < 1 renders broken); disabled, its
   * glass is solid for the same reason.
   */
  overlay?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const SIZES: Record<IconButtonSize, { box: number; icon: number }> = {
  sm: { box: theme.layout.minTouch, icon: 18 },
  md: { box: theme.layout.minTouch, icon: 20 },
  lg: { box: 56, icon: 24 },
};

/**
 * The one round icon control. Every size is at least 44pt so any variant is
 * safe to drop into a toolbar without extra hitSlop maths.
 */
export function IconButton({
  icon,
  onPress,
  variant = "outline",
  size = "md",
  color,
  disabled,
  badge,
  overlay,
  accessibilityLabel,
  style,
}: Props) {
  const reduceMotion = useReducedMotion();
  const dims = SIZES[size];
  const accent = color ?? theme.colors.primary;
  // Solid icons take their ink from the fill's role — same rule as Button, so a
  // gold or white solid IconButton isn't stamped with the wrong foreground.
  const iconColor = overlay
    ? (color ?? theme.colors.text)
    : variant === "solid"
      ? onSolid(accent)
      : variant === "soft"
        ? accent
        : (color ?? theme.colors.text);

  const fill = overlay
    ? null
    : variant === "tonal" || variant === "outline"
      ? { backgroundColor: color ? withAlpha(color, 0.14) : theme.colors.tonal }
      : variant === "soft"
        ? { backgroundColor: withAlpha(accent, 0.14) }
        : variant === "solid"
          ? { backgroundColor: accent }
          : null;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        { width: dims.box, height: dims.box, borderRadius: dims.box / 2 },
        fill,
        disabled && styles.disabled,
        pressed && !disabled && (reduceMotion ? (overlay ? null : styles.pressedStill) : styles.pressed),
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
    >
      {({ pressed }) => (
        <>
          {overlay && (
            <GlassFace radius={dims.box / 2} solid={disabled} pressed={reduceMotion && pressed && !disabled} />
          )}
          <Ionicons name={icon} size={dims.icon} color={iconColor} />
          {badge && <View style={styles.badge} />}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.96 }] },
  pressedStill: { opacity: 0.7 },
  badge: {
    position: "absolute",
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
});
