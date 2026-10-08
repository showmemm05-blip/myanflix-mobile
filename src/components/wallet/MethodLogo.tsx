import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme } from "@/theme";

interface Props {
  logoUrl: string | null | undefined;
  size?: number;
  /**
   * The method's name, for the stand-in when it has no logo: its capital
   * letters ("KBZPay" → KBZ, "WavePay" → WP), as the boards draw them.
   */
  label?: string;
  /** A bank transfer: a bank glyph stands in instead of initials. */
  bank?: boolean;
}

/** Up to three capital Latin letters of a method's name, or null when it has fewer than two. */
function initialsOf(label: string | undefined): string | null {
  const capitals = (label ?? "").match(/[A-Z]/g);
  return capitals && capitals.length >= 2 ? capitals.slice(0, 3).join("") : null;
}

/**
 * A payment method's logo on a quiet rounded tile (radius 12; 10 on the small
 * tiles). With no logo: its initials, a bank glyph for a bank, or a card glyph.
 */
export function MethodLogo({ logoUrl, size = 20, label, bank }: Props) {
  const radius = size >= 44 ? theme.radius.button : size >= 32 ? theme.radius.md : Math.max(theme.radius.xs, size / 4);
  const initials = bank ? null : initialsOf(label);

  return (
    <View
      style={[styles.tile, { width: size, height: size, borderRadius: radius }]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {logoUrl ? (
        <Image source={{ uri: logoUrl }} style={{ width: size, height: size }} contentFit="cover" transition={100} />
      ) : initials && size >= 32 ? (
        <ThemedText
          weight="black"
          allowFontScaling={false}
          style={[styles.initials, { fontSize: Math.round(size * 0.28), lineHeight: Math.round(size * 0.4) }]}
        >
          {initials}
        </ThemedText>
      ) : (
        <Ionicons name={bank ? "business-outline" : "card-outline"} size={size * 0.5} color={theme.colors.textMuted} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.tonal,
  },
  initials: { color: theme.colors.textBody, letterSpacing: -0.3 },
});
