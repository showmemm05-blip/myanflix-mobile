import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { ROW_INSET } from "@/hooks/useWalletLayout";
import { theme } from "@/theme";

interface Props {
  label: string;
  /**
   * "day" (default) — "Today" / "28 Sep 2026" in quiet 13pt Bold.
   * "awaiting" — the wallet's "Awaiting approval" group: amber ExtraBold with
   * an amber dot, the pending colour of the rows under it.
   */
  kind?: "day" | "awaiting";
}

/**
 * The line above a group of wallet rows (Wallet.dc.html / WalletHistory.dc.html):
 * a 36pt band with the label at its foot, in sentence case — Marquee does not
 * shout day names, and Burmese has no case anyway.
 */
export const DayHeader = memo(function DayHeader({ label, kind = "day" }: Props) {
  if (!label) return null;
  if (kind === "awaiting") {
    return (
      <View style={[styles.header, styles.awaiting]} accessible accessibilityRole="header" accessibilityLabel={label}>
        <View style={styles.dot} />
        <ThemedText variant="caption" weight="extrabold" style={styles.awaitingText}>
          {label}
        </ThemedText>
      </View>
    );
  }
  return (
    <ThemedText
      variant="caption"
      weight="bold"
      tabular
      accessibilityRole="header"
      accessibilityLabel={label}
      style={[styles.header, styles.dayText]}
    >
      {label}
    </ThemedText>
  );
});

const styles = StyleSheet.create({
  header: {
    minHeight: 36,
    paddingTop: 14,
    paddingHorizontal: ROW_INSET,
  },
  dayText: { color: theme.colors.textFaint },
  awaiting: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, paddingTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.warning },
  awaitingText: { flexShrink: 1, color: theme.colors.warning },
});
