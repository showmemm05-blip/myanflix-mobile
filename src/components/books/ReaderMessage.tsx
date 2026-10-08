import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme } from "@/theme";
import type { ReaderThemeColors } from "@/components/books/readerThemes";

interface Props {
  colors: ReaderThemeColors;
  icon: keyof typeof Ionicons.glyphMap;
  message: string;
  /** Draws the icon in a 72pt disc of the page's rule tint (the "still being prepared" state). */
  disc?: boolean;
  /** An error's colour for the glyph; the page ink otherwise. */
  iconColor?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Anything that follows (the chapter way-on cards). */
  children?: ReactNode;
}

/**
 * A state message INSIDE a reader, set in the page's own inks — the app's
 * EmptyState is drawn for the dark ground and turns to white-on-cream on the
 * Paper and Sepia pages. Its action is filled with the page ink
 * (BookReader.dc.html / PageReader.dc.html "error").
 */
export function ReaderMessage({ colors, icon, message, disc, iconColor, actionLabel, onAction, children }: Props) {
  const reduceMotion = useReducedMotion();
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <View style={styles.body}>
        {disc ? (
          <View style={[styles.disc, { backgroundColor: colors.rule }]}>
            <Ionicons name={icon} size={30} color={iconColor ?? colors.ink} />
          </View>
        ) : (
          <Ionicons name={icon} size={36} color={iconColor ?? colors.muted} />
        )}
        <ThemedText variant="body" weight="bold" style={[styles.message, { color: colors.ink }]}>
          {message}
        </ThemedText>
        {actionLabel && onAction ? (
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            style={({ pressed }) => [
              styles.action,
              { backgroundColor: colors.ink },
              pressed && (reduceMotion ? styles.pressedStill : styles.pressed),
            ]}
          >
            <ThemedText variant="body" weight="extrabold" style={{ color: colors.bg }}>
              {actionLabel}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
      {/* Full width: the caller's own side padding is the only inset (no doubling). */}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "stretch" },
  body: { alignItems: "center", paddingHorizontal: theme.spacing.md },
  disc: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  message: { marginTop: theme.spacing.md, textAlign: "center", fontSize: 16 },
  action: {
    minHeight: 48,
    marginTop: 20,
    paddingHorizontal: 28,
    borderRadius: theme.radius.button,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { transform: [{ scale: 0.96 }] },
  pressedStill: { opacity: 0.7 },
});
