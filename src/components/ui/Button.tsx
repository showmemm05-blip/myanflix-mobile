import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { BusyDots } from "@/components/ui/BusyDots";
import { ThemedText, type ThemedTextWeight } from "@/components/ui/ThemedText";
import { onSolid, theme, withAlpha } from "@/theme";

/**
 * - `solid` — a filled commit action: crimson by default ("Continue", "Save"),
 *   or any role fill via `color`; the ink follows the fill (onSolid).
 * - `play` — THE primary action of a title: white fill, near-black ink.
 * - `secondary` — the white-at-16% partner beside Play ("My List").
 * - `premium` — gold, for Subscribe.
 * - `destructive` — the deep red fill with white ink (Delete account).
 * - `soft` — tinted fill + tinted label for a role (`color`); without a
 *   `color` it is the neutral `secondary` look.
 * - `outline` / `ghost` — tertiary.
 */
export type ButtonVariant = "solid" | "outline" | "ghost" | "soft" | "play" | "secondary" | "premium" | "destructive";
export type ButtonSize = "md" | "lg";

interface Props {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Icon rendered after the label instead of before it. */
  trailingIcon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  /** Stretches the button to fill its row. */
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** Overrides the variant's default accent (text/icon, plus border for "outline"/"soft", background for "solid"). */
  color?: string;
  /**
   * Lines the label may wrap to before it ellipsizes. Defaults to 1 (the
   * button keeps its height). Raise it where a long Burmese label at a large
   * text size would otherwise be cut; the label then centres on each line.
   */
  labelLines?: number;
}

/** Fill + ink + label weight, resolved once per render. */
interface Look {
  fill: string;
  ink: string;
  weight: ThemedTextWeight;
  border?: string;
}

/**
 * A role colour used as LABEL ink on a dark or tinted ground. Crimson words
 * are 4.1:1 on the page and 3.7:1 on their own tint, so a crimson role reads
 * as `link` (#FF4D55) wherever it is text rather than a fill.
 */
function textInk(color: string): string {
  return color === theme.colors.primary ? theme.colors.link : color;
}

function resolveLook(variant: ButtonVariant, color: string | undefined): Look {
  switch (variant) {
    case "play":
      return { fill: theme.colors.play, ink: theme.colors.onPlay, weight: "extrabold" };
    case "secondary":
      return { fill: theme.colors.tonalStrong, ink: theme.colors.text, weight: "bold" };
    case "premium":
      return { fill: theme.colors.premium, ink: theme.colors.onPremium, weight: "extrabold" };
    case "destructive":
      return { fill: theme.colors.dangerStrong, ink: theme.colors.onDangerStrong, weight: "extrabold" };
    case "soft": {
      // No role → Marquee's neutral secondary.
      if (!color) return { fill: theme.colors.tonalStrong, ink: theme.colors.text, weight: "bold" };
      return { fill: withAlpha(color, 0.133), ink: textInk(color), weight: "bold" };
    }
    case "outline":
      return {
        fill: "transparent",
        ink: color ? textInk(color) : theme.colors.text,
        weight: "bold",
        border: color ? withAlpha(color, 0.4) : theme.colors.borderStrong,
      };
    case "ghost":
      return { fill: "transparent", ink: color ? textInk(color) : theme.colors.textMuted, weight: "bold" };
    case "solid":
    default: {
      // Marquee draws a FILLED destructive action in the deep red that carries
      // white ink; `danger` itself is for error text and icons.
      const fill = color === theme.colors.danger ? theme.colors.dangerStrong : color ?? theme.colors.primary;
      return { fill, ink: onSolid(fill), weight: "extrabold" };
    }
  }
}

/**
 * The one rectangular button: radius 12, 48pt (`md`) or 52pt (`lg`) tall, a
 * 16pt label, no shadow. Press = scale to 0.96 (an opacity dip under reduce
 * motion). Busy = three pulsing dots in the label's ink, never a spinner.
 * Every size clears the 44pt touch minimum.
 */
export function Button({
  title,
  onPress,
  variant = "solid",
  size = "md",
  icon,
  trailingIcon,
  loading,
  disabled,
  fullWidth,
  style,
  accessibilityLabel,
  color,
  labelLines = 1,
}: Props) {
  const reduceMotion = useReducedMotion();
  const isDisabled = disabled || loading;
  const look = resolveLook(variant, color);
  const iconSize = size === "lg" ? 20 : 18;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        size === "lg" ? styles.sizeLg : styles.sizeMd,
        fullWidth && styles.fullWidth,
        { backgroundColor: look.fill },
        look.border ? { borderWidth: 1, borderColor: look.border } : null,
        isDisabled && styles.disabled,
        pressed && !isDisabled && (reduceMotion ? styles.pressedStill : styles.pressed),
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
    >
      {loading ? (
        <BusyDots color={look.ink} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={iconSize} color={look.ink} />}
          {/* `flexShrink: 1` is load-bearing, not decoration. Yoga defaults
              shrink to 0, so without it a label too long for its button does
              not ellipsize — it overflows the centred row and is clipped by
              the button's own corner radius. */}
          <ThemedText
            weight={look.weight}
            numberOfLines={labelLines}
            style={[styles.label, labelLines > 1 && styles.labelWrapping, { color: look.ink }]}
          >
            {title}
          </ThemedText>
          {trailingIcon && (
            <View style={styles.trailing}>
              <Ionicons name={trailingIcon} size={iconSize} color={look.ink} />
            </View>
          )}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    borderRadius: theme.radius.button,
    paddingHorizontal: 20,
  },
  sizeMd: { minHeight: 48, paddingVertical: 10 },
  sizeLg: { minHeight: 52, paddingVertical: 12 },
  fullWidth: { alignSelf: "stretch", flexGrow: 1 },
  /** 16pt label. The line height comes from ThemedText (+4 for Burmese). */
  label: { flexShrink: 1, fontSize: 16 },
  labelWrapping: { textAlign: "center" },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.96 }] },
  pressedStill: { opacity: 0.8 },
  trailing: { marginLeft: -2 },
});
