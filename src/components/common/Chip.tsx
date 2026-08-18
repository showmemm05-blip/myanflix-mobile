import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
  /** "md" (default) is a 44pt touch target; "sm" is for static metadata only. */
  size?: ChipSize;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const TONE_COLORS: Record<ChipTone, string> = {
  neutral: theme.colors.primary,
  primary: theme.colors.primary,
  premium: theme.colors.premium,
  finance: theme.colors.finance,
  danger: theme.colors.danger,
  warning: theme.colors.warning,
  info: theme.colors.info,
};

/**
 * Tappable filter/genre chip. Selected chips fill with their tone; unselected
 * ones stay quiet so a long filter row doesn't shout. Interactive chips are
 * 44pt tall — drop to `size="sm"` only for non-tappable metadata.
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
  style,
}: Props) {
  const accent = TONE_COLORS[tone];
  // A selected chip is filled with its tone, so its ink has to follow the fill —
  // gold and emerald need their own foregrounds, not violet's.
  const contentColor = selected ? onSolid(accent) : tone === "neutral" ? theme.colors.textMuted : accent;
  const iconSize = size === "sm" ? 12 : 14;

  const inner = (
    <>
      {icon && <Ionicons name={icon} size={iconSize} color={contentColor} />}
      <ThemedText variant={size === "sm" ? "caption" : "label"} weight={selected ? "bold" : "semibold"} numberOfLines={1} style={{ color: contentColor }}>
        {label}
      </ThemedText>
      {trailingIcon && <Ionicons name={trailingIcon} size={iconSize} color={contentColor} />}
    </>
  );

  const containerStyle = [
    styles.base,
    size === "sm" ? styles.sm : styles.md,
    selected ? { backgroundColor: accent, borderColor: accent } : styles.unselected,
    disabled && styles.disabled,
    style,
  ];

  if (!onPress) return <View style={containerStyle}>{inner}</View>;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [containerStyle, pressed && !disabled && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
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
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  sm: { minHeight: 26, paddingHorizontal: 10, paddingVertical: 3 },
  md: { minHeight: theme.layout.minTouch, paddingHorizontal: theme.spacing.md },
  unselected: { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
});
