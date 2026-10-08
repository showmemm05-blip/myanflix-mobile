import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme } from "@/theme";

interface InfoItem {
  label: string;
  value: string;
}

interface Props {
  items: InfoItem[];
  /**
   * "wells" (default) — each pair in a quiet sunken well.
   * "plain" — Player.dc.html's dt/dd: an overline label over its value on the
   * page itself, two columns 16pt apart, no fill, radius or border. Labels and
   * values wrap to two lines instead of clipping long Burmese.
   */
  variant?: "wells" | "plain";
}

/** Two-column key/value block under a detail synopsis — tabular values. */
export function InfoGrid({ items, variant = "wells" }: Props) {
  const plain = variant === "plain";
  const lines = plain ? 2 : 1;
  return (
    <View style={plain ? styles.plainGrid : styles.grid}>
      {items.map((item) => (
        <View key={item.label} style={plain ? styles.plainCell : styles.cell}>
          <ThemedText variant="overline" numberOfLines={lines}>
            {item.label.toUpperCase()}
          </ThemedText>
          <ThemedText variant="body" weight="semibold" numberOfLines={lines} tabular>
            {item.value}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  cell: {
    flexGrow: 1,
    flexBasis: "45%",
    gap: 3,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceSunken,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  plainGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: theme.spacing.md, columnGap: theme.spacing.md },
  /** A basis just under half (the 16pt gap takes the rest); the label sits 4pt over its value. */
  plainCell: { flexGrow: 1, flexBasis: "40%", gap: theme.spacing.xs },
});
