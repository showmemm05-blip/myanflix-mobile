import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { ROW_INSET } from "@/hooks/useWalletLayout";
import { theme } from "@/theme";

interface Props {
  /** `color` tints a value — the deposit's amount is money in, so it reads green. */
  rows: { label: string; value: string; color?: string }[];
}

/**
 * What was just submitted, under a flow's success message — a receipt, not a
 * form: a quiet 13pt label left, the 15pt ExtraBold value right, hairlines
 * between, no box around it. A long value wraps under its label instead of
 * being cut.
 */
export function SubmittedSummary({ rows }: Props) {
  return (
    <View style={styles.list}>
      {rows.map((row, index) => (
        <View
          key={row.label}
          accessible
          accessibilityLabel={`${row.label}, ${row.value}`}
          style={[styles.row, index > 0 && styles.divided]}
        >
          <ThemedText variant="caption" weight="regular" style={styles.label}>
            {row.label}
          </ThemedText>
          <ThemedText weight="extrabold" tabular style={[styles.value, row.color ? { color: row.color } : null]}>
            {row.value}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: ROW_INSET },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: theme.spacing.md,
    rowGap: 2,
    minHeight: 52,
    paddingVertical: 12,
  },
  divided: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  label: { color: theme.colors.textFaint },
  value: { flexShrink: 1, textAlign: "right" },
});
