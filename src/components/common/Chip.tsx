import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { onSolid, theme } from "@/theme";

export type ChipTone = "neutral" | "primary" | "premium" | "finance" | "danger" | "warning" | "info";
export type ChipSize = "sm" | "md";

interface Props {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Trailing icon — e.g. "close" on a removable filter. */
  trailingIcon?: keyof typeof Ionicons.glyphMap;
  selected?: boolean;
  onPress?: () => void;
  tone?: ChipTone;
  /** "md" (default) is a 34pt chip with a 44pt touch target; "sm" is for static metadata only. */
  size?: ChipSize;
  disabled?: boolean;
  accessibilityLabel?: string;
  /**
   * "button" (default): a pick, spoken "selected" while chosen. "checkbox": an
   * independent on/off (a hub's "Free only"), spoken "checked" / "not checked"
   * — `selected` is then its on state.
   */
  accessibilityRole?: "button" | "checkbox";
  style?: StyleProp<ViewStyle>;
  /**
   * Lines the label may wrap to before it ellipsizes (default 1). Above 1 the
   * label shrinks to the chip, so pair it with a `maxWidth` on the chip: a
   * long label then wraps inside the row instead of running past its edge.
   */
  labelLines?: number;
}

/**
 * What a SELECTED chip fills with. Neutral and primary chips select to WHITE
 * (Marquee: "selected = white fill, near-black text"); a role chip keeps its
 * role colour so a gold or green filter still reads as that role.
 */
const SELECTED_FILL: Record<ChipTone, string> = {
  neutral: theme.colors.play,
  primary: theme.colors.play,
  premium: theme.colors.premium,
  finance: theme.colors.finance,
  danger: theme.colors.danger,
  warning: theme.colors.warning,
  info: theme.colors.info,
};

/** Label ink of an UNSELECTED chip on the #1C1C23 fill. Crimson words use `link`. */
const RESTING_INK: Record<ChipTone, string> = {
  neutral: theme.colors.text,
  primary: theme.colors.link,
  premium: theme.colors.premium,
  finance: theme.colors.finance,
  danger: theme.colors.danger,
  warning: theme.colors.warning,
  info: theme.colors.info,
};

/** md: the visual chip is 34pt; this slop puts the 44pt touch target back. */
const MD_HIT_SLOP = { top: 5, bottom: 5, left: 0, right: 0 };

/**
 * Tappable filter/genre chip (Marquee): a 34pt fully-round chip on the raised
 * #1C1C23 fill, no border. Selected chips turn white with near-black ink (role
 * chips fill with their role). The touch target stays 44pt via hitSlop — drop
 * to `size="sm"` only for non-tappable metadata.
 */
export function Chip({
  label,
  icon,
  trailingIcon,
  selected,
  onPress,
  tone = "neutral",
  size = "md",
  disabled,
  accessibilityLabel,
  accessibilityRole = "button",
  style,
  labelLines = 1,
}: Props) {
  const reduceMotion = useReducedMotion();
  const fill = SELECTED_FILL[tone];
  // A selected chip is filled, so its ink has to follow the fill —
  // white needs near-black, gold and green need their own foregrounds.
  const contentColor = selected ? onSolid(fill) : RESTING_INK[tone];
  const iconSize = size === "sm" ? 12 : 14;

  const inner = (
    <>
      {icon && <Ionicons name={icon} size={iconSize} color={contentColor} />}
      <ThemedText
        variant={size === "sm" ? "caption" : "muted"}
        weight={selected ? "bold" : "semibold"}
        numberOfLines={labelLines}
        style={[{ color: contentColor }, labelLines > 1 && styles.wrappingLabel]}
      >
        {label}
      </ThemedText>
      {trailingIcon && <Ionicons name={trailingIcon} size={iconSize} color={contentColor} />}
    </>
  );

  const containerStyle = [
    styles.base,
    size === "sm" ? styles.sm : styles.md,
    labelLines > 1 && styles.wrapping,
    { backgroundColor: selected ? fill : theme.colors.surfaceElevated },
    disabled && styles.disabled,
    style,
  ];

  if (!onPress) return <View style={containerStyle}>{inner}</View>;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={size === "md" ? MD_HIT_SLOP : undefined}
      style={({ pressed }) => [
        containerStyle,
        pressed && !disabled && (reduceMotion ? styles.pressedStill : styles.pressed),
      ]}
      accessibilityRole={accessibilityRole}
      accessibilityState={
        accessibilityRole === "checkbox"
          ? { checked: !!selected, disabled: !!disabled }
          : { selected: !!selected, disabled: !!disabled }
      }
      accessibilityLabel={accessibilityLabel ?? label}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    // 17 = half the 34pt chip: a capsule on one line, a soft rectangle when a
    // long label wraps (a 999 radius would make a two-line chip a lozenge).
    borderRadius: theme.radius.xl,
    alignSelf: "flex-start",
  },
  sm: { minHeight: 26, paddingHorizontal: 10, paddingVertical: 3 },
  md: { minHeight: 34, paddingHorizontal: 14 },
  /** A wrapped label still gets breathing room above and below. */
  wrapping: { paddingVertical: 6 },
  wrappingLabel: { flexShrink: 1, textAlign: "center" },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.96 }] },
  pressedStill: { opacity: 0.75 },
});
