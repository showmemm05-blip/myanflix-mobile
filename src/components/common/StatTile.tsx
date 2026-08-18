import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PressableScale } from "@/components/ui/PressableScale";
import { Surface } from "@/components/ui/Surface";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme } from "@/theme";

export type StatTileTone = "neutral" | "primary" | "finance" | "premium" | "danger" | "warning" | "info";

interface Props {
  label: string;
  value: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: StatTileTone;
  /** Quiet third line, e.g. "this month". */
  caption?: string;
  /** Makes the whole tile a 44pt+ touch target. */
  onPress?: () => void;
  /** Lays the tile out as a row (icon | label+value) instead of a stack. */
  horizontal?: boolean;
  style?: StyleProp<ViewStyle>;
}

const TONE_COLORS: Record<StatTileTone, string> = {
  neutral: theme.colors.textMuted,
  primary: theme.colors.primary,
  finance: theme.colors.finance,
  premium: theme.colors.premium,
  danger: theme.colors.danger,
  warning: theme.colors.warning,
  info: theme.colors.info,
};

/**
 * A single number with its label — wallet stats, counts, totals. Values render
 * with tabular figures so a row of tiles never jitters as data refreshes.
 */
export function StatTile({ label, value, icon, tone = "neutral", caption, onPress, horizontal, style }: Props) {
  const accent = TONE_COLORS[tone];

  const body = (
    <Surface padded style={[styles.surface, horizontal && styles.horizontal, style]}>
      {icon && (
        <View style={[styles.iconTile, { backgroundColor: accent + "1F", borderColor: accent + "33" }]}>
          <Ionicons name={icon} size={16} color={accent} />
        </View>
      )}
      <View style={styles.textBlock}>
        <ThemedText variant="overline" numberOfLines={1}>
          {label.toUpperCase()}
        </ThemedText>
        <ThemedText variant="title" tabular numberOfLines={1} color={tone === "neutral" ? theme.colors.text : accent}>
          {value}
        </ThemedText>
        {caption && (
          <ThemedText variant="caption" numberOfLines={1}>
            {caption}
          </ThemedText>
        )}
      </View>
    </Surface>
  );

  if (!onPress) return body;

  return (
    <PressableScale onPress={onPress} accessibilityLabel={`${label}: ${value}`} style={styles.pressable}>
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  surface: { gap: theme.spacing.sm, minHeight: 92, justifyContent: "center" },
  horizontal: { flexDirection: "row", alignItems: "center", minHeight: 72 },
  pressable: { flex: 1 },
  iconTile: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: { flex: 1, gap: 2 },
});
