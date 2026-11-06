import { memo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { COMPONENT_COPY } from "@/lottery/components/copy";
import { LtButton } from "@/lottery/components/LtButton";
import { LtText } from "@/lottery/components/LtText";
import { DoubleRule } from "@/lottery/components/Ornaments";
import { StatusPill } from "@/lottery/components/Pills";
import { LtCard, LtNote } from "@/lottery/components/Surfaces";
import { WinningTiles } from "@/lottery/components/WinningTiles";
import { dateLong, dateShort, ks } from "@/lottery/data/format";
import { matchNumber, prizeTotal, winsFromGroups, type PrizeSheet } from "@/lottery/data/prizes";
import type { DrawInfo, TicketItem } from "@/lottery/data/sample";
import { DreamLoadingLine } from "@/lottery/screens/dreams/DreamStates";
import { TICKET_VIEW_COPY } from "@/lottery/screens/tickets/copy";
import { WinLine } from "@/lottery/screens/tickets/parts/WinLine";
import { LT } from "@/lottery/theme/tokens";

const C = TICKET_VIEW_COPY;

/**
 * What the draw did for THIS ticket (TicketView board): waiting — an info
 * note saying when the number is published; won — the gold result card, the
 * winning number in gold tiles over the ticket's own number in white
 * gold-edged tiles, the win line, and "See all results".
 *
 * Not won has no board (its levers are Waiting and Won only): the build shows
 * the same card without any gold on the ticket's side — a white card, the
 * winning number still in its gold tiles (the published number is always
 * gold), the ticket's number in plain white tiles and a mist "Not won" line.
 *
 * Nine prize groups (15 Oct 2026): "Winning number" is the draw's 1st prize
 * (from its published sheet, GET /lottery/draws/:drawNo/results); the win
 * line says what the ticket won (the API's `prizeKs`) and the groups it won
 * in (its `wonGroups`, or the sheet when it is here — e.g. "Last 2 digits").
 * The ticket's own status is the API's verdict.
 *
 * Prize payment by request (PrizeClaim board, 24 Oct 2026): a won ticket's
 * card ends with the prize-claim block (`claim`, over a gold hairline) —
 * Request payment · Requested · Paid · Rejected · Expired for the WHOLE
 * draw's claim, which covers every winning ticket of the customer in it.
 */
export const TicketResult = memo(function TicketResult({
  ticket,
  draw,
  sheet,
  sheetLoading = false,
  onSeeResults,
  claim,
}: {
  ticket: TicketItem;
  draw: DrawInfo;
  /** The draw's published sheet, once loaded. */
  sheet?: PrizeSheet;
  sheetLoading?: boolean;
  onSeeResults: () => void;
  /** The prize-claim section (components/claim/PrizeClaim) for a won ticket; null otherwise. */
  claim?: ReactNode;
}) {
  if (ticket.status === "waiting" || draw.status !== "published") {
    return (
      <LtNote kind="info" icon="clock">
        <LtText role="meta" color={LT.ink2}>
          <LtText role="metaB" color={LT.ink}>
            {C.waiting.lead}
          </LtText>
          {C.waiting.text(draw.drawTime, dateLong(draw.dateIso))}
        </LtText>
      </LtNote>
    );
  }

  const won = ticket.status === "won";
  const wins = won ? (sheet ? matchNumber(sheet, ticket.number) : winsFromGroups(ticket.number, ticket.wonGroups)) : [];
  const amount = ticket.prizeKs ?? prizeTotal(wins);
  const names = [...new Set(wins.map((w) => w.group.name))];
  const publishedAt = draw.publishedAt
    ? COMPONENT_COPY.dayTime(dateShort(draw.dateIso), draw.publishedAt)
    : dateShort(draw.dateIso);
  const published = C.result.published(publishedAt);
  const title = !won ? C.result.notWonTitle : amount > 0 ? C.result.wonKs(ks(amount)) : C.result.wonPrize(names);
  const sub = won ? C.result.wonSub(amount > 0 ? names : [], published) : published;
  const winning = sheet?.first;

  return (
    <LtCard tone={won ? "gold" : "default"}>
      {won ? <DoubleRule tone="gold" style={styles.rule} /> : null}
      <View style={styles.row}>
        <LtText role="kicker">{C.result.kicker}</LtText>
        <StatusPill kind="published" />
      </View>
      <LtText role="title" accessibilityRole="header" style={styles.title}>
        {C.result.title(ticket.drawNo)}
      </LtText>

      {winning ? (
        <>
          <View style={styles.labelRow}>
            <LtText role="metaB" color={LT.ink2}>
              {C.result.winning}
            </LtText>
          </View>
          <WinningTiles number={winning} size="sm" style={styles.tiles} />
        </>
      ) : sheetLoading ? (
        <DreamLoadingLine text={C.result.sheetLoading} style={styles.labelRow} />
      ) : null}

      <LtText role="metaB" color={LT.ink2} style={styles.label}>
        {C.result.yours}
      </LtText>
      <WinningTiles
        number={ticket.number}
        size="sm"
        tone={won ? "mine" : "plain"}
        accessibilityLabel={C.result.yoursA11y(ticket.number)}
        style={styles.tiles}
      />

      <WinLine
        kind={won ? "won" : "notwon"}
        title={title}
        sub={sub}
        spoken={COMPONENT_COPY.ticketResult.spoken(won, title, sub, ticket.number)}
        style={styles.line}
      />
      <LtButton variant="secondary" size="sm" label={C.result.seeAll} onPress={onSeeResults} style={styles.go} />
      {won ? claim : null}
    </LtCard>
  );
});

const styles = StyleSheet.create({
  /** lt-base `.lt-rule` keeps 14 under it. */
  rule: { marginBottom: 14 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { marginTop: 10 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  label: { marginTop: 12 },
  tiles: { marginTop: 8 },
  line: { marginTop: 14 },
  go: { marginTop: 14 },
});
