import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme, withAlpha } from "@/theme";

export type LedgerStatus = "PENDING" | "APPROVED" | "REJECTED";

const STATUS_COLOR: Record<LedgerStatus, string> = {
  PENDING: theme.colors.warning,
  APPROVED: theme.colors.finance,
  REJECTED: theme.colors.danger,
};

interface Props {
  status: LedgerStatus;
  label: string;
}

/**
 * The pending/approved/rejected badge shared by deposit and withdrawal rows —
 * one dot + one label, tinted by the status role so a long ledger can be
 * scanned by colour alone. Non-interactive, so it stays under 44pt.
 */
export function StatusChip({ status, label }: Props) {
  const color = STATUS_COLOR[status];

  return (
    <View style={[styles.chip, { backgroundColor: withAlpha(color, 0.12), borderColor: withAlpha(color, 0.25) }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <ThemedText variant="caption" weight="semibold" style={{ color }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
});
