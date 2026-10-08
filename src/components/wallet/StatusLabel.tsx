import { StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme } from "@/theme";

export type LedgerStatus = "PENDING" | "APPROVED" | "REJECTED";

/**
 * Also the wallet ledger's own states (types/wallet.ts TransactionStatus),
 * plus REFUNDED: a withdrawal hold that FAILED because the request was
 * rejected, whose money came straight back as a Refund row.
 */
export type RowStatus = LedgerStatus | "COMPLETED" | "FAILED" | "REFUNDED";

/** pending = amber dot; done = green check; settled = muted word; ended = red cross. */
type Mark = "dot" | "check" | "none" | "cross";

const LOOK: Record<RowStatus, { color: string; mark: Mark }> = {
  PENDING: { color: theme.colors.warning, mark: "dot" },
  APPROVED: { color: theme.colors.finance, mark: "check" },
  // A settled ledger row: nothing to act on, so it stays quiet.
  COMPLETED: { color: theme.colors.textFaint, mark: "none" },
  REJECTED: { color: theme.colors.danger, mark: "cross" },
  FAILED: { color: theme.colors.danger, mark: "cross" },
  REFUNDED: { color: theme.colors.danger, mark: "cross" },
};

interface Props {
  status: RowStatus;
  label: string;
}

/**
 * The status under a row's amount — a mark and a 12pt Bold word (Marquee's
 * Wallet board), never colour alone,
 * and no chip box around it. The mark is decoration for screen readers (the
 * word carries the meaning). A long word wraps rather than being cut: a
 * status must never be the part that loses its ending.
 */
export function StatusLabel({ status, label }: Props) {
  const { color, mark } = LOOK[status];

  return (
    <View style={styles.line}>
      {mark === "dot" ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      {mark === "check" || mark === "cross" ? (
        <Ionicons
          name={mark === "check" ? "checkmark" : "close"}
          size={12}
          color={color}
          importantForAccessibility="no"
          accessibilityElementsHidden
        />
      ) : null}
      <ThemedText variant="label" weight="bold" style={[styles.text, { color }]}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: "row", alignItems: "center", flexShrink: 1, gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  /** Status words are sentence case, not the label role's tracked caps. */
  text: { flexShrink: 1, letterSpacing: 0 },
});
