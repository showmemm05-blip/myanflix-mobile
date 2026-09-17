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
  /** Tints the icon halo — e.g. danger for an error state. */
  tone?: string;
  /** Set false inside a scroll view so the block doesn't try to fill the page. */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** The one empty / error / no-results block. */
export function EmptyState({ message, icon, actionLabel, onAction, title, tone, fill = true, style }: Props) {
  const accent = tone ?? theme.colors.primary;

  return (
    <View style={[styles.container, fill && styles.fill, style]}>
      {icon && (
        <View style={[styles.halo, { backgroundColor: withAlpha(accent, 0.08), borderColor: withAlpha(accent, 0.16) }]}>
          <View style={[styles.iconTile, { backgroundColor: withAlpha(accent, 0.12) }]}>
            <Ionicons name={icon} size={26} color={accent} />
          </View>
        </View>
      )}
      {title && (
        <ThemedText variant="section" style={styles.center}>
          {title}
        </ThemedText>
      )}
      <ThemedText variant="muted" style={[styles.center, styles.message]}>
        {message}
      </ThemedText>
      {actionLabel && onAction && <Button title={actionLabel} onPress={onAction} variant="soft" style={styles.action} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", padding: theme.spacing.lg, gap: theme.spacing.sm },
  fill: { flex: 1 },
  halo: {
    width: 84,
    height: 84,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.xs,
  },
  iconTile: {
    width: 58,
    height: 58,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { textAlign: "center" },
  message: { maxWidth: 300 },
  action: { marginTop: theme.spacing.sm },
});
