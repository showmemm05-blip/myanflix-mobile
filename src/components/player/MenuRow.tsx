import { Pressable, StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { ThemedText } from "@/components/ui/ThemedText";
import { PlayerGlyph } from "@/components/player/PlayerGlyph";
import { theme } from "@/theme";

/** PlayerSettings.dc.html: quality rows are 48pt, subtitle rows 44pt. */
export const MENU_ROW_HEIGHT = 48;
export const MENU_ROW_HEIGHT_COMPACT = 44;

interface Props {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Lining figures, for rows whose label is numeric ("720p"). */
  tabular?: boolean;
  /** The 44pt subtitle row instead of the 48pt quality row. */
  compact?: boolean;
}

/**
 * One choice in the player's settings panel (quality and subtitle lists):
 * the label on the left and, once chosen, a crimson disc with a white check
 * on the right. The chosen row also sits on the raised fill in extra-bold
 * white; the rest are bare, in the body grey.
 *
 * One component, so the two lists cannot drift apart. A long label wraps
 * onto more lines rather than truncating or pushing the check out of the row.
 */
export function MenuRow({ label, selected, onPress, tabular, compact }: Props) {
  const reduceMotion = useReducedMotion();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { minHeight: compact ? MENU_ROW_HEIGHT_COMPACT : MENU_ROW_HEIGHT },
        selected && styles.rowSelected,
        pressed && (reduceMotion ? styles.pressedStill : styles.pressed),
      ]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
    >
      <ThemedText
        weight={selected ? "extrabold" : "medium"}
        tabular={tabular}
        color={selected ? theme.colors.text : theme.colors.textBody}
        style={styles.label}
      >
        {label}
      </ThemedText>
      {selected && (
        <View style={styles.check}>
          <PlayerGlyph name="check" size={14} color={theme.colors.onPrimary} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.radius.lg,
  },
  rowSelected: { backgroundColor: theme.colors.surfaceElevated },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.85 },
  pressedStill: { opacity: 0.75 },
  // In a row `flexShrink` is horizontal and 0 by default: without it a long
  // label would push the check out of the row instead of wrapping.
  label: { flexShrink: 1, fontSize: 16 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
  },
});
