import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme, withAlpha } from "@/theme";

export type LedgerStatus = "PENDING" | "APPROVED" | "REJECTED";

/**
 * Also the wallet ledger's own states (types/wallet.ts TransactionStatus),
 * plus REFUNDED: a withdrawal hold that FAILED because the request was
 * rejected, whose money came straight back as a Refund row.
 */
export type ChipStatus = LedgerStatus | "FAILED" | "REFUNDED";

const STATUS_COLOR: Record<ChipStatus, string> = {
  PENDING: theme.colors.warning,
  APPROVED: theme.colors.finance,
  REJECTED: theme.colors.danger,
  FAILED: theme.colors.danger,
  // Grey, not red: nothing is wrong with the balance — the money is back.
  REFUNDED: theme.colors.textMuted,
};

interface Props {
  status: ChipStatus;
  label: string;
}

/**
 * The status badge shared by deposit, withdrawal and ledger rows — one dot +
 * one label, tinted by the status role so a long ledger can be scanned by
 * colour alone. Non-interactive, so it stays under 44pt.
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
