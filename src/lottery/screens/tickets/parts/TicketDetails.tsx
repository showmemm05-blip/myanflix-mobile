import { memo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { COMPONENT_COPY } from "@/lottery/components/copy";
import { LtText } from "@/lottery/components/LtText";
import { StatusPill } from "@/lottery/components/Pills";
import { LT_COPY } from "@/lottery/copy";
import { dateShort, ks, spaced } from "@/lottery/data/format";
import type { DrawInfo, TicketItem } from "@/lottery/data/sample";
import { TICKET_VIEW_COPY } from "@/lottery/screens/tickets/copy";
import { TextLink } from "@/lottery/screens/tickets/parts/TextLink";
import { LT, LT_RADIUS, LT_SHADOW } from "@/lottery/theme/tokens";

const C = TICKET_VIEW_COPY.details;

/**
 * "Ticket details" (TicketView board `tv-dl`): the ticket's record as term /
 * value rows in one white list — ID, number (Literata, read digit by
 * digit), draw, draw date, bought, price, purchase ref (a link to Lottery
 * history), status, and once the result is out, the prize it was paid and
 * the draw's winning number in gold text. Each plain row is read as ONE line
 * ("Number: 3 7 2 6 9 4"); the ref row keeps its link as its own stop.
 */
export const TicketDetails = memo(function TicketDetails({
  ticket,
  draw,
  winning,
  onOpenHistory,
}: {
  ticket: TicketItem;
  draw: DrawInfo;
  /** The draw's 1st prize number (its published sheet), once known. */
  winning?: string;
  onOpenHistory: () => void;
}) {
  const prize = ticket.status === "won" && ticket.prizeKs ? ks(ticket.prizeKs) : null;
  return (
    <View>
      <LtText role="title" accessibilityRole="header" style={styles.heading}>
        {C.title}
      </LtText>
      <View style={styles.list}>
        <Row term={C.id} spoken={ticket.id} first>
          <Value>{ticket.id}</Value>
        </Row>
        <Row term={C.number} spoken={spaced(ticket.number)}>
          <LtText role="num">{ticket.number}</LtText>
        </Row>
        <Row term={C.draw} spoken={COMPONENT_COPY.drawNo(ticket.drawNo)}>
          <Value>{COMPONENT_COPY.drawNo(ticket.drawNo)}</Value>
        </Row>
        <Row term={C.drawDate} spoken={COMPONENT_COPY.dayTime(dateShort(draw.dateIso), draw.drawTime)}>
          <Value>{COMPONENT_COPY.dayTime(dateShort(draw.dateIso), draw.drawTime)}</Value>
        </Row>
        <Row term={C.bought} spoken={ticket.boughtAt}>
          <Value>{ticket.boughtAt}</Value>
        </Row>
        <Row term={C.price} spoken={ks(draw.price)}>
          <Value>{ks(draw.price)}</Value>
        </Row>
        <Row term={C.ref}>
          <TextLink label={ticket.purchaseRef} accessibilityLabel={C.refA11y(ticket.purchaseRef)} onPress={onOpenHistory} />
        </Row>
        <Row term={C.status} spoken={LT_COPY.pills[ticket.status]}>
          <StatusPill kind={ticket.status} />
        </Row>
        {prize ? (
          <Row term={C.prize} spoken={prize}>
            <LtText role="metaB" tabular color={LT.goldText} style={styles.value}>
              {prize}
            </LtText>
          </Row>
        ) : null}
        {winning ? (
          <Row term={C.winning} spoken={spaced(winning)}>
            <LtText role="num" color={LT.goldText}>
              {winning}
            </LtText>
          </Row>
        ) : null}
      </View>
    </View>
  );
});

/** A semibold, tabular, right-aligned value (the board's `dd`). */
function Value({ children }: { children: string }) {
  return (
    <LtText role="metaB" tabular style={styles.value}>
      {children}
    </LtText>
  );
}

/**
 * One term / value row, 52 tall. With `spoken` the row is one accessible line
 * ("Bought: Tue 27 Oct 2026, 8:14 PM"); without it (the link row) the term and
 * the link are separate stops so the link stays reachable.
 */
function Row({ term, spoken, first = false, children }: { term: string; spoken?: string; first?: boolean; children: ReactNode }) {
  return (
    <View
      style={[styles.row, !first && styles.divided]}
      accessible={spoken !== undefined}
      accessibilityLabel={spoken !== undefined ? `${term}: ${spoken}` : undefined}
    >
      <LtText role="meta" color={LT.ink2} numberOfLines={1} style={styles.term}>
        {term}
      </LtText>
      <View style={styles.valueBox}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { marginBottom: 12 },
  list: {
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.card,
    overflow: "hidden",
    boxShadow: LT_SHADOW.s1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    minHeight: 52,
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  divided: { borderTopWidth: 1, borderTopColor: LT.line },
  term: { flexShrink: 0 },
  valueBox: { flexShrink: 1, alignItems: "flex-end" },
  value: { textAlign: "right" },
});
