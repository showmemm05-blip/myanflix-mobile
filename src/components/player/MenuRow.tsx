import { Pressable, StyleSheet } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme, withAlpha } from "@/theme";

export const MENU_ROW_HEIGHT = 52;

/**
 * The fullscreen height cap the three player sheets share. Landscape locks the
 * window to the phone's WIDTH (~390dp); the 140 pays for the grabber header and
 * the sheet's own padding, and 0.8 turns an overflow into a scroll instead of a
 * clip — the rows that would fall off the bottom are the ones a viewer opened
 * the sheet to reach (240p, 2x). `extra` is for a sheet that carries something
 * below its rows, like the subtitle appearance block.
 *
 * One formula, so the three sheets cannot drift apart.
 */
export function menuSnapHeight(rowCount: number, windowHeight: number, extra = 0): number {
  return Math.min(rowCount * (MENU_ROW_HEIGHT + theme.spacing.sm) + 140 + extra, windowHeight * 0.8);
}

interface Props {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Lining figures, for rows whose label is numeric ("720p", "1.5x"). */
  tabular?: boolean;
}

/**
 * One selectable row of a player sheet: label on the left, a violet checkmark
 * on the right once it is the chosen one.
 *
 * This is the shape `SpeedSheet`, `QualitySheet` and `SubtitleSheet` all used
 * to spell out for themselves — down to the same 52dp minimum, the same violet
 * fill and the same `flexShrink` note. It is one component now so the three
 * cannot drift; their prose used to ask a maintainer to keep them aligned by
 * hand, which is a maintenance instruction where an invariant belongs.
 */
export function MenuRow({ label, selected, onPress, tabular }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.rowPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <ThemedText
        variant="body"
        weight={selected ? "bold" : "regular"}
        tabular={tabular}
        numberOfLines={1}
        style={[styles.label, selected ? styles.labelSelected : undefined]}
      >
        {label}
      </ThemedText>
      {selected && <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The bottom padding is what lets the last row scroll clear of the sheet's
  // own edge instead of stopping flush against it.
  list: { gap: theme.spacing.sm, paddingTop: theme.spacing.xs, paddingBottom: theme.spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    minHeight: MENU_ROW_HEIGHT,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rowSelected: { backgroundColor: theme.colors.accent, borderColor: withAlpha(theme.colors.primary, 0.24) },
  rowPressed: { opacity: 0.75 },
  // A long label must truncate instead of pushing the checkmark out of the
  // row: in a row `flexShrink` is horizontal, and it is 0 by default.
  label: { flexShrink: 1 },
  labelSelected: { color: theme.colors.primary },
});

/** The scroll body the three sheets put their rows in. */
export const menuListStyle = styles.list;
