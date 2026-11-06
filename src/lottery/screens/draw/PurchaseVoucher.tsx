import { memo, type Ref } from "react";
import { StyleSheet, View, type ViewInstance } from "react-native";
import { LtIcon } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { DashedRule, DoubleRule, Guilloche } from "@/lottery/components/Ornaments";
import { StatusPill } from "@/lottery/components/Pills";
import { LtHelp } from "@/lottery/components/Surfaces";
import { dateLong } from "@/lottery/data/format";
import type { DrawInfo, PurchaseLine } from "@/lottery/data/sample";
import { DRAW_COPY } from "@/lottery/screens/draw/copy";
import { LT, LT_RADIUS, LT_SHADOW } from "@/lottery/theme/tokens";

const P = DRAW_COPY.printed;

/** The tear line's notches: a 24pt bite out of each side edge. */
const NOTCH = 24;

export interface VoucherRow {
  term: string;
  value: string;
  /** The spoken value when it differs. */
  spoken?: string;
}

/**
 * THE PURCHASE VOUCHER at the top of Printed — the purchase slip and its
 * receipt in ONE card (owner, 27 Oct 2026: "combine purchase complete and
 * purchase voucher, make it seem like a voucher"), torn in two by a dashed
 * line with a half-circle bite out of each side, like a ticket and its stub.
 *
 * Above the tear (the slip, board `lt-hero lt-done`): seal double rule,
 * guilloche corner, the green done badge and the "Waiting for draw" pill,
 * "Purchase complete", "2 tickets bought", then the numbers as a receipt's
 * lines (owner, 27 Oct 2026: "align left and right as on a real voucher"):
 * a NUMBER · TICKETS head, each number on the left and its "× n" on the
 * right — one number large, several one per line with a dashed rule
 * between — read out as one line; then the draw.
 *
 * Below it (the stub, board `lt-rcpt`): "PURCHASE VOUCHER" with its number
 * ("No. LP-261027-0042") across from it, the rows (when, tickets), "Amount
 * paid" in Literata 26, a cream box (paid from, balance now) and when the
 * result comes. The numbers are not repeated in the stub: the slip shows them.
 *
 * `titleRef` lets the page move a screen reader to the title once it opens
 * (the board focuses it after the purchase).
 */
export const PurchaseVoucher = memo(function PurchaseVoucher({
  draw,
  count,
  lines,
  titleRef,
  voucherNo,
  rows,
  total,
  box,
  note,
}: {
  draw: DrawInfo;
  count: number;
  lines: readonly PurchaseLine[];
  titleRef?: Ref<ViewInstance>;
  /** The purchase's ref. */
  voucherNo: string;
  rows: readonly VoucherRow[];
  total: VoucherRow;
  box: readonly VoucherRow[];
  note: string;
}) {
  const single = lines.length === 1 ? lines[0] : null;
  const title = P.title(count);
  return (
    <View style={styles.card}>
      <View style={styles.slip}>
        <DoubleRule tone="seal" style={styles.rule} />
        <Guilloche width={200} height={48} pathWidth={360} style={styles.guilloche} />

        <View style={styles.row}>
          <View style={styles.badge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <LtIcon name="check" size={24} color={LT.ok} />
          </View>
          <StatusPill kind="waiting" />
        </View>

        <View style={styles.kicker}>
          <LtText role="kicker">{P.kicker}</LtText>
        </View>
        <View ref={titleRef} accessible accessibilityRole="header" accessibilityLabel={title} style={styles.title}>
          <LtText role="h">{title}</LtText>
        </View>

        <View
          style={styles.lines}
          accessible
          accessibilityLabel={single ? P.numberA11y(single.number, single.quantity) : P.numbersA11y(lines)}
        >
          <View style={styles.linesHead}>
            <LtText role="kicker">{P.cols.number}</LtText>
            <LtText role="kicker">{P.cols.tickets}</LtText>
          </View>
          {single ? (
            <View style={[styles.lineRow, styles.singleRow]}>
              <LtText role="displayL" style={styles.big} maxFontSizeMultiplier={1.2}>
                {single.number}
              </LtText>
              <LtText role="title" color={LT.ink2} maxFontSizeMultiplier={1.2}>
                {`× ${single.quantity}`}
              </LtText>
            </View>
          ) : (
            lines.map((line, i) => (
              <View key={`${line.number}-${i}`}>
                {i > 0 ? <DashedRule /> : null}
                <View style={styles.lineRow}>
                  <LtText role="num" style={styles.lineNumber} maxFontSizeMultiplier={1.2}>
                    {line.number}
                  </LtText>
                  <LtText role="title" color={LT.ink2} style={styles.lineCount} maxFontSizeMultiplier={1.2}>
                    {`× ${line.quantity}`}
                  </LtText>
                </View>
              </View>
            ))
          )}
        </View>

        <LtText role="meta" color={LT.ink2} style={styles.meta}>
          {P.forDraw(draw.no, dateLong(draw.dateIso))}
        </LtText>
      </View>

      <Tear />

      <View style={styles.stub}>
        <View style={styles.stubHead} accessible accessibilityRole="header" accessibilityLabel={P.voucherA11y(voucherNo)}>
          <LtText role="kicker" color={LT.seal}>
            {P.voucher}
          </LtText>
          <LtText role="metaB" tabular>
            {P.voucherNo(voucherNo)}
          </LtText>
        </View>
        <View style={styles.sum}>
          {rows.map((row) => (
            <Row key={row.term} row={row} />
          ))}
          <View style={styles.total} accessible accessibilityLabel={`${total.term} ${total.spoken ?? total.value}`}>
            <LtText role="bodyB">{total.term}</LtText>
            <LtText role="h">{total.value}</LtText>
          </View>
        </View>
        <View style={styles.box}>
          {box.map((row) => (
            <Row key={row.term} row={row} bold />
          ))}
        </View>
        <LtHelp kind="info" text={note} style={styles.note} />
      </View>
    </View>
  );
});

/**
 * The tear between the slip and the stub: a dashed hairline with a
 * paper-coloured circle on each side edge. The card clips them, so each shows
 * as a half-circle bite out of the card, outlined like the card's own edge.
 */
function Tear() {
  return (
    <View style={styles.tear} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.notch, styles.notchLeft]} />
      <View style={styles.dash}>
        <DashedRule color={LT.lineStrong} dash="4 4" />
      </View>
      <View style={[styles.notch, styles.notchRight]} />
    </View>
  );
}

function Row({ row, bold }: { row: VoucherRow; bold?: boolean }) {
  return (
    <View style={styles.rowLine} accessible accessibilityLabel={`${row.term} ${row.spoken ?? row.value}`}>
      <LtText role="meta" color={LT.ink2}>
        {row.term}
      </LtText>
      <LtText role={bold ? "buttonSm" : "metaB"} tabular style={styles.value}>
        {row.value}
      </LtText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.card,
    boxShadow: LT_SHADOW.s2,
  },

  /* the slip */
  slip: { paddingTop: 20, paddingBottom: 16, paddingHorizontal: 16 },
  rule: { marginBottom: 14 },
  guilloche: { position: "absolute", top: 30, right: 0 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LT.okTint,
    borderWidth: 1,
    borderColor: LT.okLine,
  },
  kicker: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  title: { marginTop: 4 },
  /** The numbers as receipt lines: the NUMBER · TICKETS head over a hairline, then one line per number. */
  lines: { marginTop: 14 },
  linesHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: LT.line,
  },
  lineRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12, paddingVertical: 8 },
  singleRow: { paddingTop: 6, paddingBottom: 0 },
  /** The board's .04em on the 44pt number. */
  big: { letterSpacing: 1.76 },
  /** Literata 22 with the num role's spacing. */
  lineNumber: { fontSize: 22, lineHeight: 28 },
  lineCount: { fontSize: 17, lineHeight: 22 },
  meta: { marginTop: 6 },

  /* the tear: the card's 1pt border is outside the children, so -1 puts each circle's centre on the edge */
  tear: { height: NOTCH, flexDirection: "row", alignItems: "center" },
  notch: {
    width: NOTCH,
    height: NOTCH,
    borderRadius: NOTCH / 2,
    backgroundColor: LT.paper,
    borderWidth: 1,
    borderColor: LT.line,
  },
  notchLeft: { marginLeft: -NOTCH / 2 - 1 },
  notchRight: { marginRight: -NOTCH / 2 - 1 },
  dash: { flex: 1, marginHorizontal: 4 },

  /* the stub */
  stub: { paddingTop: 8, paddingBottom: 16, paddingHorizontal: 16 },
  stubHead: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    justifyContent: "space-between",
    columnGap: 12,
    rowGap: 2,
  },
  sum: { gap: 8, marginTop: 12 },
  rowLine: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  value: { flexShrink: 1, textAlign: "right" },
  total: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: LT.line,
  },
  box: {
    marginTop: 16,
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: LT.cream,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.button,
  },
  note: { marginTop: 12 },
});
