import { memo, useMemo } from "react";
import { StyleSheet, View, type ViewInstance } from "react-native";
import { COMPONENT_COPY } from "@/lottery/components/copy";
import { DateStamp } from "@/lottery/components/DateStamp";
import { LtButton } from "@/lottery/components/LtButton";
import { LtText } from "@/lottery/components/LtText";
import { StatusPill } from "@/lottery/components/Pills";
import { dateLong, dayOf, ks, monthShort, nTickets } from "@/lottery/data/format";
import { pilesForDraw, type TicketPile } from "@/lottery/data/piles";
import type { PrizeSheet } from "@/lottery/data/prizes";
import type { DrawInfo, TicketItem } from "@/lottery/data/sample";
import { TICKETS_COPY } from "@/lottery/screens/tickets/copy";
import { PileItem } from "@/lottery/screens/tickets/parts/PileItem";
import { WinLine } from "@/lottery/screens/tickets/parts/WinLine";
import { LT, LT_RADIUS, LT_SHADOW } from "@/lottery/theme/tokens";

export interface TicketGroupData {
  drawNo: number;
  /** The draw itself (GET /lottery/draws/:drawNo): its date, times, price, status. */
  draw: DrawInfo;
  /** This draw's tickets, any order: the piles sort them (buying time, then ticket ID). */
  tickets: TicketItem[];
  /** Completed purchases for this draw (the distinct purchase refs among its tickets). */
  buys: number;
  /** The draw's published sheet (GET /lottery/draws/:drawNo/results), once loaded; undefined before or while waiting. */
  sheet?: PrizeSheet;
}

const C = TICKETS_COPY.group;

/**
 * One draw's card on My tickets and on History's "Tickets" (DrawGroupList;
 * lt-base 6.15 `lt-group` + the board's
 * `tk-ghead`): a cream head — date stamp, "Draw 24" and its date, the
 * amount and ticket count on the right, the draw's pill, and for a published
 * draw the winning number in gold text (+ the gold win line when any of
 * these tickets won) — then one item per NUMBER, then the footer "Bought in
 * 4 purchases · Purchases ›".
 *
 * Items (Tickets.dc.html `build`, owner 15 Oct 2026): the same number bought
 * 2+ times is ONE pile (PileItem: the cascade + "372694 × 3 · 3,000 Ks" + one
 * pill + the bought list); since 27 Oct 2026 (owner) a number bought once is
 * a PileItem too — its full paper, tagged — no longer the thumbnail row.
 * Items come in the order each number was first bought; piles never mix
 * draws. Each strip and the front open THAT ticket in TicketView.
 *
 * A published draw's head shows its 1st prize from the draw's sheet and, when
 * any of these tickets won (the API's verdict on each ticket, or the sheet
 * when it is here), the gold win line (phase 3, 2026-10-19).
 */
export const DrawGroup = memo(function DrawGroup({
  group,
  newIds,
  onOpenTicket,
  onPurchases,
  registerRow,
}: {
  group: TicketGroupData;
  /** Tickets bought in this session: their rows carry the New chip. */
  newIds: ReadonlySet<string>;
  onOpenTicket: (ticketId: string) => void;
  onPurchases: () => void;
  /** The screen keeps each row's view, to scroll "Show the new tickets" to the first new one. */
  registerRow?: (ticketId: string, node: ViewInstance | null) => void;
}) {
  const { drawNo, draw, tickets, buys, sheet } = group;
  const published = draw.status === "published";
  const winning = published ? sheet?.first : undefined;

  // One item per number, in first-purchase order (a pile of one looks like any other).
  const piles = useMemo(() => pilesForDraw(drawNo, tickets, draw.price, sheet), [drawNo, tickets, draw.price, sheet]);
  const win = useMemo(() => winSummary(piles), [piles]);

  const pillNote = published
    ? draw.publishedAt
      ? C.published(draw.publishedAt)
      : null
    : C.drawAt(draw.drawTime);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headTop}>
          <DateStamp month={monthShort(draw.dateIso)} day={dayOf(draw.dateIso)} />
          <View style={styles.title}>
            <LtText role="title" accessibilityRole="header">
              {COMPONENT_COPY.drawNo(drawNo)}
            </LtText>
            <LtText role="caption">{dateLong(draw.dateIso)}</LtText>
          </View>
          <View style={styles.sum}>
            <LtText role="h" style={styles.amount} numberOfLines={1}>
              {ks(tickets.length * draw.price)}
            </LtText>
            <LtText role="micro" color={LT.ink2} tabular numberOfLines={1}>
              {nTickets(tickets.length)}
            </LtText>
          </View>
        </View>

        <View style={styles.pillRow}>
          <StatusPill kind={published ? "published" : "waiting"} />
          {pillNote ? (
            <LtText role="micro" color={LT.ink2}>
              {pillNote}
            </LtText>
          ) : null}
        </View>

        {winning ? (
          <View style={styles.win} accessible accessibilityLabel={C.winningA11y(winning)}>
            <LtText role="metaB" color={LT.ink2}>
              {C.winning}
            </LtText>
            <LtText role="num" color={LT.goldText} style={styles.winNum}>
              {winning}
            </LtText>
          </View>
        ) : null}

        {win ? (
          win.tickets === 1 ? (
            <WinLine
              title={C.wonTitle}
              sub={C.wonSub(win.open.id, win.open.number)}
              spoken={C.wonA11y(win.open.id, win.open.number)}
              accessibilityHint={C.wonHint}
              onPress={() => onOpenTicket(win.open.id)}
            />
          ) : (
            <WinLine
              title={C.wonTitleMany(win.tickets)}
              sub={C.wonSubMany(win.piles)}
              spoken={C.wonA11yMany(win.tickets, win.piles)}
              accessibilityHint={C.wonHintMany}
              onPress={() => onOpenTicket(win.open.id)}
            />
          )
        ) : null}
      </View>

      <View>
        {piles.map((pile, i) => (
          <View
            key={pile.key}
            // "Show the new tickets" looks a ticket up by ID: every ticket of a pile points at the pile.
            ref={
              registerRow
                ? (node) => {
                    for (const t of pile.tickets) registerRow(t.id, node);
                  }
                : undefined
            }
            style={i > 0 && styles.divided}
          >
            <PileItem pile={pile} draw={draw} newIds={newIds} onOpenTicket={onOpenTicket} />
          </View>
        ))}
      </View>

      <View style={styles.foot}>
        <LtText role="metaB" color={LT.ink2} tabular style={styles.footText}>
          {C.buys(buys)}
        </LtText>
        <LtButton
          variant="ghost"
          size="sm"
          label={C.purchases}
          iconRight="next"
          accessibilityLabel={C.purchasesA11y}
          onPress={onPurchases}
          style={styles.footButton}
        />
      </View>
    </View>
  );
});

interface WinSummary {
  /** Won tickets in this draw (a pile counts every ticket on it). */
  tickets: number;
  /** The won numbers, biggest prize first (ties: first bought first). */
  piles: readonly TicketPile[];
  /** The line opens this one: the first ticket of the biggest prize. */
  open: TicketItem;
}

/** Every won pile of a draw; null when nothing won (or the draw has no result yet). */
function winSummary(piles: readonly TicketPile[]): WinSummary | null {
  const won = piles.filter((p) => p.status === "won").sort((a, b) => b.each - a.each);
  if (!won.length) return null;
  return { tickets: won.reduce((n, p) => n + p.count, 0), piles: won, open: won[0].tickets[0] };
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.card,
    overflow: "hidden",
    boxShadow: LT_SHADOW.s1,
  },
  /** The cream band; its rows are 10 apart (the board grid's row gap). */
  head: {
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: LT.cream,
    borderBottomWidth: 1,
    borderBottomColor: LT.line,
  },
  headTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { flex: 1, minWidth: 0 },
  sum: { alignItems: "flex-end", flexShrink: 0 },
  /** Literata 700 16/20, tabular (the board's `tk-ghead__amt`). */
  amount: { fontSize: 16, lineHeight: 20 },
  pillRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: 10, rowGap: 8, minHeight: 26 },
  win: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: LT.line,
  },
  winNum: { fontSize: 20, lineHeight: 26 },
  divided: { borderTopWidth: 1, borderTopColor: LT.line },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 8,
    backgroundColor: LT.paper,
    borderTopWidth: 1,
    borderTopColor: LT.line,
  },
  footText: { flex: 1 },
  footButton: { marginVertical: -2 },
});
