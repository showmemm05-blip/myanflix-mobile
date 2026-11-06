import { useCallback, useMemo, useRef } from "react";
import { StyleSheet, View, type ScrollViewInstance, type ViewInstance } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useWallet } from "@/hooks/useWallet";
import { LotteryFooter } from "@/lottery/components/LotteryFooter";
import { LotteryScreen } from "@/lottery/components/LotteryScreen";
import { LtButton } from "@/lottery/components/LtButton";
import { LtEmpty } from "@/lottery/components/LtEmpty";
import { LtIcon } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { LtCard, LtNote } from "@/lottery/components/Surfaces";
import { saleCloseLabel, saleStatus } from "@/lottery/data/draws";
import { ks } from "@/lottery/data/format";
import type { DrawInfo, DrawStatus } from "@/lottery/data/sample";
import { useLotteryFocusRefresh } from "@/lottery/hooks/lotteryKeys";
import { useRecentBuys } from "@/lottery/hooks/useBuyTickets";
import { useLotteryNow } from "@/lottery/hooks/useCurrentDraw";
import { useCurrentTickets } from "@/lottery/hooks/useTicketPlaces";
import { useTicketsInfinite } from "@/lottery/hooks/useTickets";
import type { LotteryTicketsScreenProps } from "@/lottery/navigation/types";
import { DrawStripSkeleton } from "@/lottery/screens/draw/DrawStates";
import { DreamErrorBanner, DreamLoadingLine } from "@/lottery/screens/dreams/DreamStates";
import { TICKETS_COPY } from "@/lottery/screens/tickets/copy";
import { DrawGroupList, ticketGroupsOf } from "@/lottery/screens/tickets/parts/DrawGroupList";
import { PageHead } from "@/lottery/screens/tickets/parts/PageHead";
import { TextLink } from "@/lottery/screens/tickets/parts/TextLink";
import { LT } from "@/lottery/theme/tokens";

const C = TICKETS_COPY;

/** The empty page's line: what happens next for the current draw (or that there is no draw yet). */
function emptyText(draw: DrawInfo | null, status: DrawStatus | null): string {
  if (!draw) return C.empty.text.noDraw;
  if (status === "published") return C.empty.text.published(draw.no);
  if (status === "closed") return C.empty.text.closed(draw.no);
  return C.empty.text.selling(draw.no);
}

/**
 * MY TICKETS (Tickets.dc.html; owner 2026-10-27: "keep tickets until next
 * draw show up") — the CURRENT draw's tickets only: the draw GET
 * /lottery/draws/current answers, any newer one, and an earlier draw still
 * waiting for its results (it never leaves this page until it is published).
 * A published draw stays here — winning number, Won chips, the claim chips
 * that lead to "Request payment" — until the admin creates the next draw;
 * then its card moves to Lottery history's "Tickets". The rule is
 * `data/draws.ts ticketPlaceOf`, fed by hooks/useTicketPlaces.
 *
 * One card per draw (DrawGroupList → DrawGroup → PileItem → TicketPile):
 * inside a card a number bought once is its own row, the same number bought
 * again lies on that number's ONE pile. The kept draws are read whole (a draw
 * is small), so there is no paging here. The board's afterPurchase lever is
 * real: after a purchase in this session the ok note names the new ticket IDs
 * and its link scrolls to the row or pile holding the first one; they carry
 * the New chip.
 *
 * Loading shows the head and two card-shaped skeletons — also while the
 * current draw is still loading, so nothing is placed on a guess; a failed
 * load, Try again. No ticket for the current draw: "No tickets for Draw N
 * yet", "Choose numbers", and — when History holds earlier draws — "See your
 * earlier tickets in History". When the page is not empty but none of its
 * tickets is the current draw's (an earlier draw still waiting for its
 * results is all I hold), the same prompt sits compact above that card, so
 * the draw on sale is always offered.
 */
export function LotteryTicketsScreen({ navigation }: LotteryTicketsScreenProps<"LotteryTickets">) {
  useLotteryFocusRefresh();
  const reduceMotion = useReducedMotion();
  const shelf = useCurrentTickets();
  const { places } = shelf;
  const recent = useRecentBuys((s) => s.purchases);
  const newIds = useRecentBuys((s) => s.newTicketIds);
  const wallet = useWallet();
  const nowMs = useLotteryNow();

  const ready = shelf.state === "ready";
  const { groups, pendingDraws } = useMemo(
    () => ticketGroupsOf(shelf.tickets, places.draws),
    [shelf.tickets, places.draws],
  );
  const empty = ready && shelf.tickets.length === 0;
  const current = places.current;
  // None of my tickets is the current draw's, though the page holds an earlier draw waiting for its results.
  const currentHasNone = ready && current !== null && !shelf.tickets.some((t) => t.drawNo === current.no);
  // The empty page links History only when it holds something: page 1's total counts every ticket I hold,
  // and none of them is on this page. Asked for only then (History reads the same list).
  const everything = useTicketsInfinite(undefined, { enabled: empty });
  const hasEarlier = empty && (everything.data?.pages[0]?.total ?? 0) > 0;

  // ----- "Show the new tickets": scroll to the first row this session bought -----
  const scrollRef = useRef<ScrollViewInstance>(null);
  const listRef = useRef<ViewInstance>(null);
  const listY = useRef(0);
  const rowNodes = useRef(new Map<string, ViewInstance>());
  const latest = recent[0];
  // A purchase whose draw has moved to History is no longer on this page: its note goes with it.
  const latestHere = latest && places.placeOf(latest.drawNo) !== "history" ? latest : undefined;

  const registerRow = useCallback((ticketId: string, node: ViewInstance | null) => {
    if (node) rowNodes.current.set(ticketId, node);
    else rowNodes.current.delete(ticketId);
  }, []);

  const showNew = useCallback(() => {
    const first = latestHere?.ticketIds[0];
    const row = first ? rowNodes.current.get(first) : undefined;
    const list = listRef.current;
    if (!row || !list) return;
    // The row's place inside the list + the list's place in the column = its place in the scroll.
    row.measureLayout(list, (_x, y) => {
      scrollRef.current?.scrollTo({ y: Math.max(0, listY.current + y - 12), animated: !reduceMotion });
    });
  }, [latestHere, reduceMotion]);

  const openTicket = useCallback(
    (ticketId: string) => navigation.navigate("LotteryTicketView", { ticketId }),
    [navigation],
  );
  const openPurchases = useCallback(
    () => navigation.navigate("LotteryHistoryTab", { show: "purchases" }),
    [navigation],
  );
  const openEarlier = useCallback(() => navigation.navigate("LotteryHistoryTab", { show: "tickets" }), [navigation]);
  const toDraw = useCallback(
    () => navigation.navigate("LotteryDrawTab", { screen: "LotteryDraw", pop: true }),
    [navigation],
  );

  const currentStatus = current ? saleStatus(current, nowMs) : null;
  const currentOpen = currentStatus === "open";
  const saleOver = currentStatus === "closed" || currentStatus === "published";
  const balance = latestHere?.balanceAfter ?? wallet.data?.balance;
  const loading = shelf.state === "loading" || (ready && groups.length === 0 && pendingDraws > 0);
  const closeAt = current && currentOpen ? saleCloseLabel(current) : "";

  /** The prompt for the current draw: when its sale closes, Choose numbers, and (empty page only) the History link. */
  const promptAction = (
    <View style={styles.emptyAction}>
      {current && closeAt ? (
        <View style={styles.emptyNote}>
          <LtIcon name="unlock" size={14} color={LT.ok} />
          <LtText role="micro" color={LT.ok}>
            {C.empty.open(current.no, closeAt)}
          </LtText>
        </View>
      ) : null}
      <LtButton label={C.empty.action} iconRight="next" onPress={toDraw} />
      {hasEarlier ? (
        <TextLink
          label={C.empty.earlier}
          accessibilityLabel={C.empty.earlierA11y}
          onPress={openEarlier}
          style={styles.emptyLink}
        />
      ) : null}
    </View>
  );

  return (
    <LotteryScreen topBar={{ variant: "root" }} scrollRef={scrollRef} contentStyle={styles.content} footer={<LotteryFooter />}>
      <PageHead title={C.title} guilloche />

      {latestHere ? (
        <LtNote kind="ok" live>
          <LtText role="meta" color={LT.ink2}>
            <LtText role="metaB" color={LT.ink}>
              {C.done.lead(latestHere.ticketIds.length, latestHere.drawNo)}
            </LtText>
            {C.done.ids(latestHere.ticketIds)}
            {balance === undefined ? "" : C.done.balance(ks(balance))}
          </LtText>
          <TextLink label={C.done.go} onPress={showNew} />
        </LtNote>
      ) : null}

      {shelf.state === "error" ? (
        <DreamErrorBanner title={C.errorTitle} text={C.errorText} retryLabel={C.retry} onRetry={shelf.retry} />
      ) : null}

      {loading ? (
        <View style={styles.section}>
          <DreamLoadingLine text={C.loading} />
          <DrawStripSkeleton />
          <DrawStripSkeleton />
        </View>
      ) : null}

      {currentHasNone && !empty && !loading ? (
        // Compact, above the earlier draw's card: the draw on sale is still offered.
        <LtCard tone="flat">
          <LtEmpty
            compact
            title={C.empty.title(current.no, saleOver)}
            text={emptyText(current, currentStatus)}
            action={promptAction}
          />
        </LtCard>
      ) : null}

      {ready && groups.length > 0 ? (
        <View
          ref={listRef}
          style={styles.section}
          onLayout={(event) => {
            listY.current = event.nativeEvent.layout.y;
          }}
        >
          <DrawGroupList
            groups={groups}
            newIds={newIds}
            onOpenTicket={openTicket}
            onPurchases={openPurchases}
            registerRow={registerRow}
          />
          {pendingDraws > 0 ? <DrawStripSkeleton /> : null}
        </View>
      ) : null}

      {empty ? (
        <LtEmpty
          title={C.empty.title(current?.no ?? null, saleOver)}
          text={emptyText(current, currentStatus)}
          action={promptAction}
        />
      ) : null}
    </LotteryScreen>
  );
}

const styles = StyleSheet.create({
  /** The board's `.lt-tix .lt-main{padding-top:20px}`. */
  content: { paddingTop: 20 },
  section: { gap: 16 },
  emptyAction: { alignItems: "center", gap: 20 },
  emptyNote: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: -8 },
  /** Under the button, centred; its 44pt target sits in the action's 20pt rhythm. */
  emptyLink: { alignSelf: "center", marginTop: -12 },
});
