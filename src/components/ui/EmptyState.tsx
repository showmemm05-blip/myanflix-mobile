import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { Button } from "@/components/ui/Button";
import { theme, withAlpha } from "@/theme";

interface Props {
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
  /** Bold line above the message. */
  title?: string;
  /** Tints the icon disc — e.g. danger for an error state. */
  tone?: string;
  /** Set false inside a scroll view so the block doesn't try to fill the page. */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * The one empty / error / no-results block, as Marquee draws it:
 *  - no `tone` (an EMPTY page): an 88pt #121217 disc with a faint 10pt halo
 *    and a muted glyph; its action is the white primary button;
 *  - with a `tone` (an ERROR): a 64pt disc of the tone at 12% with the glyph
 *    in the tone; its action (Retry) is the quieter secondary button.
 * The message is 15/23 body copy in the secondary grey.
 */
export function EmptyState({ message, icon, actionLabel, onAction, title, tone, fill = true, style }: Props) {
  const toned = tone !== undefined;

  return (
    <View style={[styles.container, fill && styles.fill, style]}>
      {icon &&
        (tone !== undefined ? (
          <View style={[styles.tonedDisc, { backgroundColor: withAlpha(tone, 0.12) }]}>
            <Ionicons name={icon} size={28} color={tone} />
          </View>
        ) : (
          <View style={styles.halo}>
            <View style={styles.neutralDisc}>
              <Ionicons name={icon} size={36} color={theme.colors.textMuted} />
            </View>
          </View>
        ))}
      {title && (
        <ThemedText variant="section" style={styles.center}>
          {title}
        </ThemedText>
      )}
      <ThemedText variant="body" color={theme.colors.textMuted} style={[styles.center, styles.message]}>
        {message}
      </ThemedText>
      {actionLabel && onAction && (
        <Button
          title={actionLabel}
          onPress={onAction}
          variant={toned ? "secondary" : "play"}
          style={styles.action}
        />
      )}
    </View>
  );
}

const NEUTRAL_DISC = 88;
/** DesignSystem: `box-shadow: 0 0 0 10px rgba(255,255,255,0.03)` — drawn as a ring view. */
const HALO = 10;
const TONED_DISC = 64;

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", padding: theme.spacing.lg, gap: theme.spacing.sm },
  fill: { flex: 1 },
  halo: {
    width: NEUTRAL_DISC + HALO * 2,
    height: NEUTRAL_DISC + HALO * 2,
    borderRadius: (NEUTRAL_DISC + HALO * 2) / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha(theme.colors.text, 0.03),
    marginBottom: theme.spacing.sm,
  },
  neutralDisc: {
    width: NEUTRAL_DISC,
    height: NEUTRAL_DISC,
    borderRadius: NEUTRAL_DISC / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
  },
  tonedDisc: {
    width: TONED_DISC,
    height: TONED_DISC,
    borderRadius: TONED_DISC / 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.xs,
  },
  center: { textAlign: "center" },
  message: { maxWidth: 320 },
  action: { marginTop: theme.spacing.md },
});
