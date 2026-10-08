import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme } from "@/theme";

interface Props {
  title: string;
  /** `play` — white fill, near-black words. `secondary` — white at 16%, white words. */
  variant: "play" | "secondary";
  icon?: keyof typeof Ionicons.glyphMap;
  /**
   * Omit to draw the button's LOOK only, inside a card that is itself the
   * button (the new-release spotlight) — one target, one spoken label, no
   * nested buttons.
   */
  onPress?: () => void;
  /** `md` 48pt / 16pt words (the hero); `sm` 44pt / 15pt (inside a banner). */
  size?: "md" | "sm";
  style?: StyleProp<ViewStyle>;
}

/**
 * The storefront's call to action. Unlike the shared Button, the label WRAPS
 * to a second line instead of ellipsizing — two of these share a row on a
 * 320pt phone, and the Burmese "Explore game" must never be cut.
 */
export function ArcadeCta({ title, variant, icon, onPress, size = "md", style }: Props) {
  const reduceMotion = useReducedMotion();
  const play = variant === "play";
  const ink = play ? theme.colors.onPlay : theme.colors.text;
  const small = size === "sm";

  const body = (
    <>
      {icon && <Ionicons name={icon} size={small ? 16 : 18} color={ink} />}
      <ThemedText
        weight={play ? "extrabold" : "bold"}
        numberOfLines={2}
        color={ink}
        style={[styles.label, small && styles.labelSmall]}
      >
        {title}
      </ThemedText>
    </>
  );

  const look = [
    styles.base,
    small ? styles.small : styles.medium,
    { backgroundColor: play ? theme.colors.play : theme.colors.tonalStrong },
  ];

  if (!onPress) {
    return (
      <View style={[look, style]} accessible={false} importantForAccessibility="no-hide-descendants">
        {body}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [look, pressed && (reduceMotion ? styles.pressedStill : styles.pressed), style]}
    >
      {body}
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
  },
  medium: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 10 },
  small: { minHeight: 44, paddingHorizontal: 18, paddingVertical: 8, alignSelf: "flex-start" },
  /** `flexShrink` lets a long label wrap inside the button instead of pushing it wider. */
  label: { flexShrink: 1, fontSize: 16, textAlign: "center" },
  labelSmall: { fontSize: 15 },
  pressed: { transform: [{ scale: 0.96 }] },
  pressedStill: { opacity: 0.8 },
});
