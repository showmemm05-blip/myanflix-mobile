import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { LotteryFooter } from "@/lottery/components/LotteryFooter";
import { LotteryScreen } from "@/lottery/components/LotteryScreen";
import { LtButton } from "@/lottery/components/LtButton";
import { LtEmpty } from "@/lottery/components/LtEmpty";
import { LtText } from "@/lottery/components/LtText";
import { StatusPill } from "@/lottery/components/Pills";
import { PrizeClaim } from "@/lottery/components/claim/PrizeClaim";
import { Ticket } from "@/lottery/components/ticket/Ticket";
import { WonFrame } from "@/lottery/components/ticket/WonFrame";
import { dateShort } from "@/lottery/data/format";
import { pilesForDraw } from "@/lottery/data/piles";
import type { TicketItem } from "@/lottery/data/sample";
import { useLotteryFocusRefresh } from "@/lottery/hooks/lotteryKeys";
import { useDraw } from "@/lottery/hooks/useDraws";
import { useDrawResults } from "@/lottery/hooks/useResults";
import { isTicketNotFound, useDrawTickets, useTicket } from "@/lottery/hooks/useTickets";
import type { LotteryTicketsScreenProps } from "@/lottery/navigation/types";
import { DreamErrorBanner, DreamLoadingLine } from "@/lottery/screens/dreams/DreamStates";
import { TICKET_VIEW_COPY } from "@/lottery/screens/tickets/copy";
import { SameNumberStepper } from "@/lottery/screens/tickets/parts/SameNumberStepper";
import { SidewaysView } from "@/lottery/screens/tickets/parts/SidewaysView";
import { TicketDetails } from "@/lottery/screens/tickets/parts/TicketDetails";
import { TicketResult } from "@/lottery/screens/tickets/parts/TicketResult";
import { LT } from "@/lottery/theme/tokens";

const C = TICKET_VIEW_COPY;

/**
 * ONE TICKET, LARGE (TicketView.dc.html) — pushed inside the Tickets tab, so
 * the dock keeps Tickets current. From the top: "‹ My tickets", the draw
 * kicker, "Your ticket" with its pill and ID; the ticket full width and never
 * cropped (gold Won frame OUTSIDE the paper when it won) with "Turn
 * sideways"; "Ticket 2 of 3 with 372694" stepping through the other tickets
 * of the same number — its pile, in the pile's order — (setParams, so Back
 * still returns to the list); what the draw did for it; and its details.
 * Every strip and the front of a pile on My tickets opens here with
 * `{ ticketId }` (the params are unchanged).
 *
 * The ticket is GET /lottery/tickets/:ticketNo (from the list's cache when it
 * came from there), its draw GET /lottery/draws/:drawNo, the tickets with
 * its number the draw's own page of tickets, and — once the draw is
 * published — the draw's sheet GET /lottery/draws/:drawNo/results for the
 * winning number. A ticket that is not this customer's (a 404) shows a plain
 * "not here" state instead of crashing.
 *
 * A won ticket's prize card ends with the prize-claim block (PrizeClaim
 * board, 24 Oct 2026: GET /lottery/claims/draws/:drawNo) — the request
 * covers every winning ticket of the draw, so its words say "your 3 winning
 * tickets in Draw 2" when the claim is wider than this ticket.
 */
export function LotteryTicketViewScreen({ navigation, route }: LotteryTicketsScreenProps<"LotteryTicketView">) {
  useLotteryFocusRefresh();
  const query = useTicket(route.params.ticketId);
  const ticket = query.ticket;
  const drawQuery = useDraw(ticket?.drawNo);
  const draw = drawQuery.info;
  const sameDraw = useDrawTickets(ticket?.drawNo);
  const sheetQuery = useDrawResults(draw?.status === "published" ? ticket?.drawNo : undefined);
  const [sideways, setSideways] = useState(false);

  // The tickets with this number in this draw = its pile on My tickets, in the same order (buying time, then ID),
  // so "Ticket 2 of 3" here is the paper tagged "2 · MFL-…" there. Any paper of a pile opens here by its ID.
  const same = useMemo<readonly TicketItem[]>(() => {
    if (!ticket) return [];
    const all = sameDraw.tickets.some((t) => t.id === ticket.id) ? sameDraw.tickets : [...sameDraw.tickets, ticket];
    return pilesForDraw(ticket.drawNo, all, draw?.price).find((p) => p.number === ticket.number)?.tickets ?? [ticket];
  }, [sameDraw.tickets, ticket, draw?.price]);
  const index = ticket ? same.findIndex((t) => t.id === ticket.id) : -1;

  const step = useCallback(
    (by: number) => {
      const next = same[index + by];
      if (next) navigation.setParams({ ticketId: next.id });
    },
    [navigation, same, index],
  );
  const backToList = useCallback(() => navigation.popTo("LotteryTickets"), [navigation]);
  const openResults = useCallback(
    () => navigation.navigate("LotteryResultsTab", { screen: "LotteryResults", pop: true }),
    [navigation],
  );
  const openHistory = useCallback(() => navigation.navigate("LotteryHistoryTab", { show: "purchases" }), [navigation]);

  const back = (
    <View style={styles.backRow}>
      <LtButton
        variant="ghost"
        size="sm"
        icon="back"
        label={C.backToList}
        accessibilityLabel={C.backA11y}
        onPress={backToList}
      />
    </View>
  );
  const footer = <LotteryFooter />;

  if (!ticket || !draw) {
    let state;
    if (query.isError && isTicketNotFound(query.error)) {
      state = <LtEmpty title={C.missing.title} text={C.missing.text} />;
    } else if (query.isError || drawQuery.isError) {
      state = (
        <DreamErrorBanner
          title={C.errorTitle}
          text={C.errorText}
          retryLabel={C.retry}
          onRetry={() => (query.isError ? query.refetch() : drawQuery.refetch())}
        />
      );
    } else {
      state = <DreamLoadingLine text={C.loading} />;
    }
    return (
      <LotteryScreen topBar={{ variant: "root" }} contentStyle={styles.content} footer={footer}>
        {back}
        {state}
      </LotteryScreen>
    );
  }

  const won = ticket.status === "won";
  const paper = <Ticket draw={draw} number={ticket.number} ticketId={ticket.id} />;

  return (
    <LotteryScreen
      topBar={{ variant: "root" }}
      contentStyle={styles.content}
      footer={footer}
      overlay={<SidewaysView visible={sideways} ticket={ticket} draw={draw} onClose={() => setSideways(false)} />}
    >
      {back}

      <View>
        <View style={styles.kickerRow}>
          <LtText role="kicker">{C.kicker(ticket.drawNo, dateShort(draw.dateIso))}</LtText>
        </View>
        <LtText role="h" accessibilityRole="header" style={styles.title}>
          {C.title}
        </LtText>
        <View style={styles.idRow}>
          <StatusPill kind={ticket.status} />
          <LtText role="metaB" color={LT.ink2} tabular style={styles.id}>
            {ticket.id}
          </LtText>
        </View>
      </View>

      <View>
        {won ? <WonFrame>{paper}</WonFrame> : paper}
        <View style={styles.tools}>
          <LtButton variant="secondary" size="sm" icon="rotate" label={C.turn} onPress={() => setSideways(true)} />
          <LtText role="caption" style={styles.toolsHint}>
            {C.turnHint}
          </LtText>
        </View>
      </View>

      <SameNumberStepper
        number={ticket.number}
        index={Math.max(0, index)}
        total={Math.max(1, same.length)}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
      />

      <TicketResult
        ticket={ticket}
        draw={draw}
        sheet={sheetQuery.sheet}
        sheetLoading={draw.status === "published" && sheetQuery.isPending}
        onSeeResults={openResults}
        claim={
          won ? (
            <PrizeClaim
              drawNo={ticket.drawNo}
              place="ticket"
              ticketNo={ticket.id}
              publishedAt={drawQuery.data?.publishedAt}
              enabled={draw.status === "published"}
            />
          ) : null
        }
      />

      <TicketDetails ticket={ticket} draw={draw} winning={sheetQuery.sheet?.first} onOpenHistory={openHistory} />
    </LotteryScreen>
  );
}

const styles = StyleSheet.create({
  /** The board's `.lt-tv .lt-main{padding-top:12px;gap:24px}`. */
  content: { paddingTop: 12, gap: 24 },
  /** The ghost button's own 14pt padding sits in the gutter, so its chevron lines up with the column. */
  backRow: { flexDirection: "row", marginLeft: -14 },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { marginTop: 4 },
  idRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: 10, rowGap: 8, marginTop: 10 },
  id: { letterSpacing: 0.28 },
  tools: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 },
  toolsHint: { flex: 1 },
});
