import { Fragment, memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { COMPONENT_COPY } from "@/lottery/components/copy";
import { LtIcon } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { LtChip, StatusPill } from "@/lottery/components/Pills";
import { LT_COPY } from "@/lottery/copy";
import { ks } from "@/lottery/data/format";
import type { PurchaseItem } from "@/lottery/data/sample";
import { HISTORY_COPY, spokenLine } from "@/lottery/screens/history/copy";
import { LT, LT_RADIUS } from "@/lottery/theme/tokens";

const C = HISTORY_COPY.purchases;
const R = COMPONENT_COPY.purchaseRow;
/** A Dream Number pick can buy many numbers at once: two are printed, the rest counted. */
const LINES_SHOWN = 2;

/**
 * One purchase in Lottery history (lt-base `.lt-hrow` + the board's `hs-row`):
 * a cream disc with the tickets icon, "Draw 24 · 004821 × 1" over
 * "6:20 PM · LP-261028-0144" and "Show ticket ID ›", the amount in Literata
 * over the Paid pill. Tapping it opens the purchase in place onto its ticket
 * IDs — each ticket bought is its own record — and each ID opens the ticket.
 *
 * The attempt that did not complete is not a button: an err-tinted disc, "No
 * purchase ref", the amount struck through (read as "not charged") and the
 * line "Not completed · nothing was charged". (The API records paid purchases
 * only, so this row is the design's; it is kept for the shape's "failed".)
 */
export const PurchaseRow = memo(function PurchaseRow({
  purchase,
  expanded,
  onToggle,
  onOpenTicket,
}: {
  purchase: PurchaseItem;
  expanded: boolean;
  onToggle: (ref: string) => void;
  onOpenTicket: (ticketId: string) => void;
}) {
  const amount = ks(purchase.total);
  const shown = purchase.lines.slice(0, LINES_SHOWN);
  const rest = purchase.lines.length - shown.length;
  const spokenLines = purchase.lines.map((line) => spokenLine(line.number, line.quantity)).join(R.spokenSep);

  const title = (
    <LtText role="metaB">
      {`${COMPONENT_COPY.drawNo(purchase.drawNo)} · `}
      {shown.map((line, i) => (
        <Fragment key={`${line.number}-${i}`}>
          {i > 0 ? R.lineSep : ""}
          <LtText role="num" style={styles.num}>
            {line.number}
          </LtText>
          {` × ${line.quantity}`}
        </Fragment>
      ))}
      {rest > 0 ? C.moreNumbers(rest) : ""}
    </LtText>
  );

  if (purchase.status === "failed") {
    return (
      <View
        accessible
        accessibilityLabel={R.failedA11y(purchase.drawNo, spokenLines, purchase.time, C.noRef, C.notCharged(amount), C.failed)}
      >
        <View style={styles.row}>
          <View style={[styles.disc, styles.discFailed]}>
            <LtIcon name="alert" size={18} color={LT.err} />
          </View>
          <View style={styles.main}>
            {title}
            <LtText role="caption">{`${purchase.time} · ${C.noRef}`}</LtText>
          </View>
          <View style={styles.end}>
            <LtText role="title" color={LT.ink3} style={[styles.amount, styles.void]}>
              {amount}
            </LtText>
          </View>
        </View>
        <View style={styles.failLine}>
          <LtIcon name="alert" size={14} color={LT.err} />
          <LtText role="micro" color={LT.err} style={styles.flexText}>
            {C.failed}
          </LtText>
        </View>
      </View>
    );
  }

  const n = purchase.ticketIds.length;
  const more = C.more(n, expanded);
  return (
    <View>
      <Pressable
        onPress={() => onToggle(purchase.ref)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={R.paidA11y(purchase.drawNo, spokenLines, purchase.time, purchase.ref, amount, LT_COPY.pills.paid)}
        accessibilityHint={more}
        style={({ pressed }) => [styles.row, expanded && styles.rowOpen, pressed && styles.rowPressed]}
      >
        <View style={styles.disc}>
          <LtIcon name="tickets" size={18} color={LT.ink2} />
        </View>
        <View style={styles.main}>
          {title}
          <LtText role="caption" tabular>{`${purchase.time} · ${purchase.ref}`}</LtText>
          <View style={styles.more}>
            <LtText role="micro" color={LT.indigo}>
              {more}
            </LtText>
            <View style={expanded && styles.moreOpen}>
              <LtIcon name="next" size={14} color={LT.indigo} />
            </View>
          </View>
        </View>
        <View style={styles.end}>
          <LtText role="title" style={styles.amount}>
            {amount}
          </LtText>
          <StatusPill kind="paid" />
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.panel}>
          <LtText role="micro" color={LT.ink3}>
            {C.panel(n)}
          </LtText>
          <View style={styles.ids}>
            {purchase.ticketIds.map((id, i) => {
              const nth = n > 1 ? C.nth(i + 1, n) : null;
              return (
                <Pressable
                  key={id}
                  onPress={() => onOpenTicket(id)}
                  accessibilityRole="button"
                  accessibilityLabel={C.idA11y(id, nth)}
                  style={({ pressed }) => [styles.id, i > 0 && styles.idDivided, pressed && styles.idPressed]}
                >
                  <LtText role="metaB" tabular style={styles.idText}>
                    {id}
                  </LtText>
                  {nth ? <LtChip text={nth} /> : null}
                  <LtIcon name="next" size={18} color={LT.ink3} />
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  rowOpen: { backgroundColor: LT.paper },
  rowPressed: { backgroundColor: LT.cream },
  /** The 36pt cream disc (lt-base `.lt-hrow__icon`), 2 down to sit on the title's line. */
  disc: {
    width: 36,
    height: 36,
    marginTop: 2,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LT.cream,
  },
  discFailed: { backgroundColor: LT.errTint },
  main: { flex: 1, minWidth: 0 },
  /** The board's `hs-num`: Literata 600 15/20, +.04em. */
  num: { fontSize: 15, lineHeight: 20, letterSpacing: 0.6 },
  more: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  moreOpen: { transform: [{ rotate: "90deg" }] },
  end: { alignItems: "flex-end", gap: 6, flexShrink: 0 },
  /** Literata 600 16/20 (lt-base `.lt-hrow__amt`). */
  amount: { fontSize: 16, lineHeight: 20 },
  void: { textDecorationLine: "line-through" },
  failLine: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 64, paddingRight: 16, paddingBottom: 14 },
  flexText: { flex: 1 },
  /** Hangs under the title, past the disc (64 = 16 + 36 + 12). */
  panel: { paddingLeft: 64, paddingRight: 16, paddingBottom: 14, backgroundColor: LT.paper },
  ids: {
    marginTop: 6,
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.input,
    overflow: "hidden",
  },
  id: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, paddingLeft: 12, paddingRight: 8 },
  idDivided: { borderTopWidth: 1, borderTopColor: LT.line },
  idPressed: { backgroundColor: LT.cream },
  idText: { flex: 1, minWidth: 0, letterSpacing: 0.28 },
});
