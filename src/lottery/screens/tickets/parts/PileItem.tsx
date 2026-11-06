import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { LtText } from "@/lottery/components/LtText";
import { DashedRule } from "@/lottery/components/Ornaments";
import { LtChip, StatusPill } from "@/lottery/components/Pills";
import { claimChipKind, claimChipWord } from "@/lottery/components/claim/copy";
import { TicketPile } from "@/lottery/components/ticket/TicketPile";
import type { TicketDraw } from "@/lottery/components/ticket/Ticket";
import { LT_COPY } from "@/lottery/copy";
import { dayTimeLabel, ks } from "@/lottery/data/format";
import type { TicketPile as TicketPileData } from "@/lottery/data/piles";
import { TICKETS_COPY } from "@/lottery/screens/tickets/copy";
import { ltStop } from "@/lottery/i18n";
import { LT } from "@/lottery/theme/tokens";

const C = TICKETS_COPY.pile;

/**
 * One number in one draw, as an item of a draw card on My tickets and
 * History's "Tickets" (Tickets.dc.html `tk-pile`): the cascade (TicketPile —
 * every strip and the front open their own ticket), then ONE status pill for
 * the whole pile (+ New) — one number in one draw has one result — then the
 * bought list. While the draw is still to come the pile shows no "Waiting for
 * draw" pill (owner, 27 Oct 2026): the draw card's head already says it, so
 * only Won / Not won (+ the claim chip) and New appear here. No "372694 × 3 · 3,000 Ks" line (owner, 27 Oct 2026: not
 * needed — the papers show the number, the seal and the list the count, the
 * draw card's head the amount); a screen reader still hears it.
 *
 * A number bought ONCE is an item the same way (owner, 27 Oct 2026: "show the
 * same even if I bought just one ticket"): its one paper, tagged "1 · ID"
 * like a pile's, no seal. The bought list (same day): a TICKET · BOUGHT head,
 * then one receipt line per ticket in buying order — "1 · MFL-25-000123" on
 * the left (the red figure is the paper's tag), "Tue 27 Oct, 10:41 AM" on the
 * right. The time cannot go on the tag: it stops 4 short of the QR.
 *
 * Won: the board's gold Won treatment round the WHOLE pile — gold tint and
 * the gold double rule standing beside it, plus the Won pill and, since
 * prizes are paid by request (PrizeClaim board, 24 Oct 2026), the claim chip
 * from the tickets' `claimStatus` (one draw, one claim: every ticket on the
 * pile carries the same one); the papers themselves never change.
 *
 * New: the chip shows when any ticket of the pile was bought in this session
 * (the board only has all-new piles; a mixed pile is the build's call — each
 * new paper's own label also ends ", new").
 */
export const PileItem = memo(function PileItem({
  pile,
  draw,
  newIds,
  onOpenTicket,
}: {
  pile: TicketPileData;
  draw: TicketDraw;
  newIds: ReadonlySet<string>;
  onOpenTicket: (ticketId: string) => void;
}) {
  const won = pile.status === "won";
  const claim = won ? (pile.front.claimStatus ?? null) : null;
  const isNew = pile.tickets.some((t) => newIds.has(t.id));
  const cost = ks(pile.cost);
  const status = `${LT_COPY.pills[pile.status]}${claim ? `${ltStop()} ${claimChipWord(claim)}` : ""}`;
  // "Waiting for draw" is the draw card's head's to say; a result is this number's own.
  const showStatus = pile.status !== "waiting";

  return (
    <View style={[styles.item, won && styles.won]}>
      {won ? <View style={styles.wonRule} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" /> : null}
      <TicketPile pile={pile} draw={draw} newIds={newIds} onOpenTicket={onOpenTicket} tagSingle />
      {/* One line for a screen reader: the number digit by digit, the count, the cost, new, the result (+ the claim). */}
      <View accessible accessibilityLabel={C.capA11y(pile.number, pile.count, cost, isNew, status)}>
        {showStatus || isNew ? (
          <View style={styles.pills} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {showStatus ? <StatusPill kind={pile.status} /> : null}
            {claim ? <StatusPill kind={claimChipKind(claim)} /> : null}
            {isNew ? <LtChip text={C.newChip} tone="new" /> : null}
          </View>
        ) : null}
      </View>
      <View style={styles.bought}>
        <View style={styles.boughtHead} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <LtText role="kicker">{C.cols.ticket}</LtText>
          <LtText role="kicker">{C.cols.bought}</LtText>
        </View>
        {pile.tickets.map((ticket, i) => {
          const at = dayTimeLabel(ticket.boughtIso);
          return (
            <View key={ticket.id}>
              <DashedRule />
              <View style={styles.boughtRow} accessible accessibilityLabel={C.boughtA11y(i + 1, ticket.id, at)}>
                <View style={styles.boughtTicket}>
                  <LtText role="microB" color={LT.seal} tabular>
                    {String(i + 1)}
                  </LtText>
                  <LtText role="micro" color={LT.ink2}>
                    ·
                  </LtText>
                  <LtText role="metaB" tabular style={styles.boughtId} numberOfLines={1}>
                    {ticket.id}
                  </LtText>
                </View>
                <LtText role="meta" color={LT.ink2} tabular style={styles.boughtAt}>
                  {at}
                </LtText>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  /** The board's `.tk-pile{padding:18px 16px 14px}`: 18 on top leaves room for the seal reaching 9 over the corner. */
  item: { position: "relative", paddingTop: 18, paddingHorizontal: 16, paddingBottom: 14 },
  won: { backgroundColor: LT.goldTint },
  /** The gold double rule standing upright, 5 in from the item's edge, as long as the pile's padding box. */
  wonRule: {
    position: "absolute",
    left: 5,
    top: 18,
    bottom: 14,
    width: 4,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: LT.goldEdge,
  },
  /** Under the pile: its one status mark, the claim chip beside it on a won pile, and New. */
  pills: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 12, paddingHorizontal: 2 },
  /** The bought list: the TICKET · BOUGHT head, then one dashed-ruled line per ticket. */
  bought: { marginTop: 12, paddingHorizontal: 2 },
  boughtHead: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingBottom: 6 },
  boughtRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    flexWrap: "wrap",
    columnGap: 12,
    rowGap: 2,
    paddingVertical: 6,
  },
  boughtTicket: { flexDirection: "row", alignItems: "baseline", columnGap: 4, flexShrink: 1 },
  boughtId: { letterSpacing: 0.28, flexShrink: 1 },
  boughtAt: { marginLeft: "auto", textAlign: "right" },
});
