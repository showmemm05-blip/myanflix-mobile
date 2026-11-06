import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { LtButton } from "@/lottery/components/LtButton";
import { LtText } from "@/lottery/components/LtText";
import { DoubleRule } from "@/lottery/components/Ornaments";
import { LtCard } from "@/lottery/components/Surfaces";
import { dateTimeLabel, ks } from "@/lottery/data/format";
import { HISTORY_COPY } from "@/lottery/screens/history/copy";
import { LT } from "@/lottery/theme/tokens";
import type { Transaction } from "@/types/wallet";

const C = HISTORY_COPY.prizes;

/**
 * "Prizes received" (phase 3, 2026-10-19; not on the History board): the
 * wallet ledger's "Lottery prize" rows — one line each, newest first, with
 * when it was paid and the Ks — then "Total prizes" over a gold rule, what
 * it counts, and "See wallet" to the MyanFlix wallet. Gold is for winning
 * only: the card is the gold-lined one, the amounts gold text. Shown only
 * when there is at least one prize.
 */
export const PrizesCard = memo(function PrizesCard({
  prizes,
  partial,
  onOpenWallet,
}: {
  /** LOTTERY_PRIZE rows, newest first. */
  prizes: readonly Transaction[];
  /** The ledger holds more entries than were read: older prizes may be missing. */
  partial: boolean;
  onOpenWallet: () => void;
}) {
  const total = prizes.reduce((sum, t) => sum + t.amount, 0);

  return (
    <LtCard tone="gold">
      <DoubleRule tone="gold" style={styles.rule} />
      <LtText role="title" accessibilityRole="header">
        {C.title}
      </LtText>

      <View style={styles.list}>
        {prizes.map((prize) => {
          const amount = ks(prize.amount);
          const at = dateTimeLabel(prize.createdAt);
          return (
            <View key={prize.id} style={styles.row} accessible accessibilityLabel={C.rowA11y(amount, at)}>
              <View style={styles.main}>
                <LtText role="metaB">{C.row}</LtText>
                <LtText role="micro" color={LT.ink3} tabular>
                  {at}
                </LtText>
              </View>
              <LtText role="h" color={LT.goldText} style={styles.amount} numberOfLines={1}>
                {amount}
              </LtText>
            </View>
          );
        })}
      </View>

      <View style={styles.sum} accessible accessibilityLabel={`${C.total}: ${ks(total)}`}>
        <LtText role="bodyB">{C.total}</LtText>
        <LtText role="h" color={LT.goldText}>
          {ks(total)}
        </LtText>
      </View>
      <LtText role="caption" style={styles.note}>
        {C.note(prizes.length, partial)}
      </LtText>
      <LtButton
        variant="ghost"
        size="sm"
        label={C.wallet}
        iconRight="next"
        accessibilityLabel={C.walletA11y}
        onPress={onOpenWallet}
        style={styles.wallet}
      />
    </LtCard>
  );
});

const styles = StyleSheet.create({
  /** lt-base `.lt-rule` keeps 14 under it. */
  rule: { marginBottom: 14 },
  list: { marginTop: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: LT.goldLine,
  },
  main: { flex: 1, minWidth: 0 },
  /** Literata 700 16/20, tabular (the totals card's `hs-tot__amt`). */
  amount: { fontSize: 16, lineHeight: 20 },
  sum: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: LT.goldEdge,
  },
  note: { marginTop: 6 },
  /** The ghost button's text lines up with the card's text. */
  wallet: { alignSelf: "flex-start", marginTop: 6, marginLeft: -14 },
});
