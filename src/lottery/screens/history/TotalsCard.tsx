import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { COMPONENT_COPY } from "@/lottery/components/copy";
import { LtIcon } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { LtCard } from "@/lottery/components/Surfaces";
import { ks } from "@/lottery/data/format";
import { HISTORY_COPY } from "@/lottery/screens/history/copy";
import { LT } from "@/lottery/theme/tokens";

export interface DrawTotal {
  drawNo: number;
  tickets: number;
  buys: number;
  amount: number;
}

const C = HISTORY_COPY.totals;

/**
 * "Totals by draw" (History board `hs-tot`): one row per draw — "Draw 24"
 * over "4 tickets in 4 purchases", the amount, a chevron to that draw's
 * tickets (My tickets, or History's "Tickets" once the draw is earlier) —
 * then "Total paid" in Literata 26 over a line-strong rule, and what it
 * counts. Only completed purchases count — and only the loaded pages; the
 * note says so when more are still to load.
 */
export const TotalsCard = memo(function TotalsCard({
  totals,
  hasFailed,
  partial = false,
  onOpenDraw,
  isEarlier,
}: {
  totals: readonly DrawTotal[];
  hasFailed: boolean;
  /** Not every purchase is loaded yet (more pages): the note says the totals cover the loaded ones. */
  partial?: boolean;
  /** A row opens its draw's tickets, wherever they are now. */
  onOpenDraw: (drawNo: number) => void;
  /** Whether a draw's tickets are History's (the row's spoken label says where it leads). */
  isEarlier: (drawNo: number) => boolean;
}) {
  const allTickets = totals.reduce((sum, t) => sum + t.tickets, 0);
  const allBuys = totals.reduce((sum, t) => sum + t.buys, 0);
  const allAmount = totals.reduce((sum, t) => sum + t.amount, 0);

  return (
    <LtCard>
      <View style={styles.head}>
        <LtText role="title" accessibilityRole="header">
          {C.title}
        </LtText>
      </View>

      <View style={styles.list}>
        {totals.map((total) => (
          <Pressable
            key={total.drawNo}
            onPress={() => onOpenDraw(total.drawNo)}
            accessibilityRole="button"
            accessibilityLabel={C.rowA11y(total.drawNo, total.tickets, total.buys, ks(total.amount), isEarlier(total.drawNo))}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <View style={styles.main}>
              <LtText role="title" style={styles.draw}>
                {COMPONENT_COPY.drawNo(total.drawNo)}
              </LtText>
              <LtText role="caption" tabular>
                {C.sub(total.tickets, total.buys)}
              </LtText>
            </View>
            <LtText role="h" style={styles.amount} numberOfLines={1}>
              {ks(total.amount)}
            </LtText>
            <LtIcon name="next" size={20} color={LT.ink3} />
          </Pressable>
        ))}
      </View>

      <View style={styles.sum} accessible accessibilityLabel={`${C.paid}: ${ks(allAmount)}`}>
        <LtText role="bodyB">{C.paid}</LtText>
        <LtText role="h">{ks(allAmount)}</LtText>
      </View>
      <LtText role="caption" style={styles.note}>
        {C.note(allTickets, allBuys, hasFailed, partial)}
      </LtText>
    </LtCard>
  );
});

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  list: { marginTop: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: LT.line,
  },
  rowPressed: { backgroundColor: LT.cream },
  main: { flex: 1, minWidth: 0 },
  /** Literata 600 16/20 (the board's `hs-tot__draw`). */
  draw: { fontSize: 16, lineHeight: 20 },
  /** Literata 700 16/20 (the board's `hs-tot__amt`). */
  amount: { fontSize: 16, lineHeight: 20 },
  sum: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: LT.lineStrong,
  },
  note: { marginTop: 6 },
});
