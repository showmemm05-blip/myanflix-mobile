import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { onSolid, theme, withAlpha } from "@/theme";

export type ButtonVariant = "solid" | "outline" | "ghost" | "soft";
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
}

/**
 * Solid = the one primary action on a screen (electric violet by default; pass
 * `color` for a role fill and the label ink follows the role automatically).
 * Soft = a secondary action that still needs presence (tinted fill, tinted label).
 * Outline / ghost = tertiary. Every size clears the 44pt touch minimum.
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
}: Props) {
  const isDisabled = disabled || loading;
  const accent = color ?? theme.colors.primary;

  const textColor =
    variant === "solid"
      ? // The ink has to come from the fill's role: near-black-on-violet is
        // unreadable on a gold `premium` or emerald `finance` button.
        onSolid(accent)
      : variant === "soft"
        ? accent
        : color ?? (variant === "outline" ? theme.colors.text : theme.colors.textMuted);

  const iconSize = size === "lg" ? 20 : 18;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        size === "lg" ? styles.sizeLg : styles.sizeMd,
        fullWidth && styles.fullWidth,
        variant === "solid" && [styles.solid, { backgroundColor: accent, shadowColor: accent }],
        // 0.133/0.24 are the exact fractions that round back to the "22"/"3D"
        // this used to concatenate — same pixels, minus the rgba-token trap.
        variant === "soft" && [
          styles.soft,
          { backgroundColor: withAlpha(accent, 0.133), borderColor: withAlpha(accent, 0.24) },
        ],
        variant === "outline" && styles.outline,
        variant === "outline" && color && { borderColor: withAlpha(color, 0.4) },
        variant === "ghost" && styles.ghost,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={iconSize} color={textColor} />}
          {/* `flexShrink: 1` is load-bearing, not decoration. Yoga defaults
              shrink to 0, so without it a label too long for its pill does not
              ellipsize — it overflows the centred row and is clipped by the
              pill's own border radius. */}
          <ThemedText weight="semibold" numberOfLines={1} style={[styles.label, { color: textColor }]}>
            {title}
          </ThemedText>
          {trailingIcon && (
            <View style={styles.trailing}>
              <Ionicons name={trailingIcon} size={iconSize} color={textColor} />
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
    gap: theme.spacing.xs + 2,
    borderRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  sizeMd: { minHeight: theme.layout.minTouch, paddingVertical: 12 },
  sizeLg: { minHeight: 54, paddingVertical: 16, borderRadius: theme.radius["2xl"] },
  fullWidth: { alignSelf: "stretch", flexGrow: 1 },
  solid: {
    ...theme.shadow.sm,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  soft: { borderWidth: 1 },
  outline: { backgroundColor: "transparent", borderWidth: 1, borderColor: theme.colors.borderStrong },
  ghost: { backgroundColor: "transparent" },
  label: { flexShrink: 1 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  trailing: { marginLeft: -2 },
});
