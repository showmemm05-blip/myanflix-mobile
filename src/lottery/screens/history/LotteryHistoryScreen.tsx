import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from "react-native";
import { useTransactions, useWallet } from "@/hooks/useWallet";
import { LotteryFooter } from "@/lottery/components/LotteryFooter";
import { LotteryScreen } from "@/lottery/components/LotteryScreen";
import { LtButton } from "@/lottery/components/LtButton";
import { LtEmpty } from "@/lottery/components/LtEmpty";
import { LtText } from "@/lottery/components/LtText";
import { Segmented, SegmentedCount, type SegmentedOption } from "@/lottery/components/Segmented";
import { LtNote } from "@/lottery/components/Surfaces";
import { ks } from "@/lottery/data/format";
import type { PurchaseItem } from "@/lottery/data/sample";
import { useLotteryFocusRefresh } from "@/lottery/hooks/lotteryKeys";
import { useRecentBuys } from "@/lottery/hooks/useBuyTickets";
import { flattenPurchases, usePurchasesInfinite } from "@/lottery/hooks/usePurchases";
import { useEarlierTickets } from "@/lottery/hooks/useTicketPlaces";
import type { HistoryView, LotteryHistoryScreenProps } from "@/lottery/navigation/types";
import { useOpenWallet } from "@/lottery/navigation/useOpenWallet";
import { DrawStripSkeleton } from "@/lottery/screens/draw/DrawStates";
import { DreamErrorBanner, DreamLoadingLine } from "@/lottery/screens/dreams/DreamStates";
import { HISTORY_COPY } from "@/lottery/screens/history/copy";
import { EarlierTickets } from "@/lottery/screens/history/EarlierTickets";
import { PrizesCard } from "@/lottery/screens/history/PrizesCard";
import { PurchaseRow } from "@/lottery/screens/history/PurchaseRow";
import { TotalsCard, type DrawTotal } from "@/lottery/screens/history/TotalsCard";
import { PageHead } from "@/lottery/screens/tickets/parts/PageHead";
import { TextLink } from "@/lottery/screens/tickets/parts/TextLink";
import { LT, LT_RADIUS, LT_SHADOW } from "@/lottery/theme/tokens";

const C = HISTORY_COPY;

/** The next page is asked for when the scroll is within this of the end. */
const LOAD_MORE_AHEAD = 480;
/** The wallet ledger's newest entries searched for prizes (the API's most per page). */
const PRIZES_LEDGER_LIMIT = 100;

interface DayGroup {
  day: string;
  purchases: PurchaseItem[];
}

/**
 * The purchase that opens by default, as on the board: the one just bought
 * in this session, else the newest with more than one ticket (so its
 * separate ticket IDs are seen at once).
 */
function defaultOpen(purchases: readonly PurchaseItem[], justBought: PurchaseItem | undefined): string | null {
  if (justBought) return justBought.ref;
  return purchases.find((p) => p.status === "paid" && p.ticketIds.length > 1)?.ref ?? null;
}

/**
 * LOTTERY HISTORY (History.dc.html) — a plain tab screen. The page head,
 * then a Tickets · Purchases switch (owner, 2026-10-27: the earlier draws'
 * tickets moved here from My tickets):
 *
 * - TICKETS (EarlierTickets): the draws that left My tickets when the next
 *   draw opened (rule: data/draws.ts `ticketPlaceOf`), as the same draw
 *   cards — results, Won and claim chips — newest draw first; GET
 *   /lottery/tickets page by page, My tickets' draws left out.
 * - PURCHASES (as before): a "just bought" note after a purchase in this
 *   session, the totals by draw, the prizes received (the wallet ledger's
 *   "Lottery prize" rows, phase 3), then EVERY purchase newest first,
 *   grouped by day under caps day headers (Myanmar time). A purchase opens
 *   in place onto its ticket IDs (several can be open); each ID opens the
 *   ticket inside the Tickets tab. GET /lottery/purchases page by page; the
 *   totals count the loaded pages and say so while more remain.
 *
 * The switch starts on "Tickets" when History holds any earlier draw's
 * ticket, else on "Purchases" — and on "Purchases" after a purchase in this
 * session, so its note is seen; `route.params.show` (a link from My tickets
 * or Ticket view) picks one and is cleared. Until that first choice can be
 * made the page shows the head and the skeleton. Each count is a badge.
 * Loading shows two card-shaped skeletons; a failed load, Try again.
 */
export function LotteryHistoryScreen({ navigation, route }: LotteryHistoryScreenProps) {
  useLotteryFocusRefresh();
  const query = usePurchasesInfinite();
  const purchases = useMemo(() => flattenPurchases(query.data), [query.data]);
  const total = query.data?.pages[0]?.total ?? purchases.length;
  const justBought = useRecentBuys((s) => s.purchases[0]);
  const wallet = useWallet();
  const balance = justBought?.balanceAfter ?? wallet.data?.balance;
  // Prizes paid: the newest wallet entries of type LOTTERY_PRIZE (the ledger has no type filter).
  const ledger = useTransactions({ limit: PRIZES_LEDGER_LIMIT });
  const prizes = useMemo(
    () => ledger.data?.items.filter((t) => t.type === "LOTTERY_PRIZE" && t.status === "COMPLETED") ?? [],
    [ledger.data],
  );
  const ledgerPartial = (ledger.data?.total ?? 0) > (ledger.data?.items.length ?? 0);
  const openWallet = useOpenWallet();
  const [open, setOpen] = useState<ReadonlySet<string>>(() => {
    const first = defaultOpen(purchases, justBought);
    return new Set(first ? [first] : []);
  });

  // A tab screen stays mounted: a purchase made after it first rendered opens when it arrives.
  const justBoughtRef = justBought?.ref;
  useEffect(() => {
    if (!justBoughtRef) return;
    setOpen((current) => (current.has(justBoughtRef) ? current : new Set([...current, justBoughtRef])));
  }, [justBoughtRef]);
  // The first page landing after the screen mounted: the board's default opens then.
  const loaded = purchases.length > 0;
  const [openedOnce, setOpenedOnce] = useState(false);
  useEffect(() => {
    if (!loaded || openedOnce) return;
    setOpenedOnce(true);
    const first = defaultOpen(purchases, justBought);
    if (first) setOpen((current) => (current.has(first) ? current : new Set([...current, first])));
  }, [loaded, openedOnce, purchases, justBought]);

  const toggle = useCallback((ref: string) => {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  }, []);

  // ----- the earlier draws' tickets, and which view is shown -----
  const earlier = useEarlierTickets();
  const newIds = useRecentBuys((s) => s.newTicketIds);
  const [picked, setPicked] = useState<HistoryView | null>(null);
  // The default, once it can be told: Purchases after a purchase in this session; else Tickets when there are any.
  const fallback: HistoryView | null = justBought
    ? "purchases"
    : earlier.count !== undefined
      ? earlier.count > 0
        ? "tickets"
        : "purchases"
      : earlier.state === "error" || earlier.countFailed
        ? "purchases"
        : null;
  const view = picked ?? fallback;
  // The first choice sticks: a count changing later never flips the page under the thumb.
  useEffect(() => {
    if (picked === null && fallback !== null) setPicked(fallback);
  }, [picked, fallback]);
  // A purchase made after the screen first rendered: its note is on Purchases.
  useEffect(() => {
    if (justBoughtRef) setPicked("purchases");
  }, [justBoughtRef]);
  // A link that names the view (My tickets' "See your earlier tickets", a card's "Purchases ›"): taken once, cleared.
  const asked = route.params?.show;
  useEffect(() => {
    if (!asked) return;
    setPicked(asked);
    navigation.setParams({ show: undefined });
  }, [asked, navigation]);

  const scrollRef = useRef<ScrollViewInstance>(null);
  const show = useCallback((next: HistoryView, toTop = false) => {
    setPicked(next);
    if (toTop) scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const purchasesTotal = query.data?.pages[0]?.total;
  const onView = useCallback(
    (next: HistoryView) => {
      show(next);
      AccessibilityInfo.announceForAccessibility(
        next === "tickets" ? C.view.read.tickets(earlier.count) : C.view.read.purchases,
      );
    },
    [show, earlier.count],
  );
  const viewOptions = useMemo<SegmentedOption<HistoryView>[]>(
    () => [
      {
        key: "tickets",
        label: C.view.tickets,
        accessibilityLabel: C.view.ticketsA11y(earlier.count),
        trail:
          earlier.count === undefined ? undefined : <SegmentedCount n={earlier.count} selected={view === "tickets"} />,
      },
      {
        key: "purchases",
        label: C.view.purchases,
        accessibilityLabel: C.view.purchasesA11y(purchasesTotal),
        trail:
          purchasesTotal === undefined ? undefined : (
            <SegmentedCount n={purchasesTotal} selected={view === "purchases"} />
          ),
      },
    ],
    [earlier.count, purchasesTotal, view],
  );

  // Consecutive purchases on the same day share one card (the list is newest first).
  const days = useMemo<DayGroup[]>(() => {
    const out: DayGroup[] = [];
    for (const p of purchases) {
      const last = out[out.length - 1];
      if (last && last.day === p.day) last.purchases.push(p);
      else out.push({ day: p.day, purchases: [p] });
    }
    return out;
  }, [purchases]);

  // Completed purchases only, newest draw first.
  const totals = useMemo<DrawTotal[]>(() => {
    const byDraw = new Map<number, DrawTotal>();
    for (const p of purchases) {
      if (p.status !== "paid") continue;
      const t = byDraw.get(p.drawNo) ?? { drawNo: p.drawNo, tickets: 0, buys: 0, amount: 0 };
      t.tickets += p.ticketIds.length;
      t.buys += 1;
      t.amount += p.total;
      byDraw.set(p.drawNo, t);
    }
    return [...byDraw.values()].sort((a, b) => b.drawNo - a.drawNo);
  }, [purchases]);
  const hasFailed = purchases.some((p) => p.status === "failed");

  // ----- the next page (of the view on screen), as the end comes near -----
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const {
    hasNextPage: ticketsHasNext,
    isFetchingNextPage: ticketsFetchingNext,
    isFetchNextPageError: ticketsNextFailed,
    fetchNextPage: fetchNextTickets,
  } = earlier.list;
  const earlierShown = earlier.tickets.length;
  const earlierCount = earlier.count;
  // Once every ticket History holds is loaded, the pages left are My tickets' draws: they are not asked for.
  const earlierMore = !!ticketsHasNext && (earlierCount === undefined || earlierShown < earlierCount);
  const loadMoreTickets = useCallback(() => {
    if (earlierMore && !ticketsFetchingNext) fetchNextTickets();
  }, [earlierMore, ticketsFetchingNext, fetchNextTickets]);
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
      if (contentOffset.y + layoutMeasurement.height < contentSize.height - LOAD_MORE_AHEAD) return;
      if (view === "tickets") loadMoreTickets();
      else if (view === "purchases") loadMore();
    },
    [view, loadMore, loadMoreTickets],
  );
  // Nothing of History's among the loaded tickets yet, but more is to come (the newest pages are often
  // My tickets' draw): the next page is asked for on its own until one shows, the list ends, or a page fails.
  const earlierSettled = earlier.state === "ready" && !earlier.undecided;
  useEffect(() => {
    if (view !== "tickets" || !earlierSettled || earlierShown > 0) return;
    if (earlierMore && !ticketsFetchingNext && !ticketsNextFailed) fetchNextTickets();
  }, [view, earlierSettled, earlierShown, earlierMore, ticketsFetchingNext, ticketsNextFailed, fetchNextTickets]);

  const openTicket = useCallback(
    (ticketId: string) =>
      navigation.navigate("LotteryTicketsTab", { screen: "LotteryTicketView", params: { ticketId }, initial: false }),
    [navigation],
  );
  const openTickets = useCallback(
    () => navigation.navigate("LotteryTicketsTab", { screen: "LotteryTickets", pop: true }),
    [navigation],
  );
  const { placeOf } = earlier.places;
  const isEarlier = useCallback((drawNo: number) => placeOf(drawNo) === "history", [placeOf]);
  // A totals row: an earlier draw's tickets are here under "Tickets"; the current draw's are on My tickets.
  const openDraw = useCallback(
    (drawNo: number) => (isEarlier(drawNo) ? show("tickets", true) : openTickets()),
    [isEarlier, show, openTickets],
  );
  const showPurchases = useCallback(() => show("purchases", true), [show]);

  const purchasesView = (
    <>
      {justBought ? (
        <LtNote kind="ok" live>
          <LtText role="meta" color={LT.ink2}>
            <LtText role="metaB" color={LT.ink}>
              {C.done.lead(justBought.ref)}
            </LtText>
            {C.done.body(
              justBought.ticketIds.length,
              justBought.drawNo,
              ks(justBought.total),
              balance === undefined ? null : ks(balance),
            )}
          </LtText>
          {/* Where the bought tickets are now: My tickets, or here under "Tickets" once their draw has moved. */}
          <TextLink label={C.done.go} onPress={() => openDraw(justBought.drawNo)} />
        </LtNote>
      ) : null}

      {query.isPending ? (
        <View style={styles.loading}>
          <DreamLoadingLine text={C.loading} />
          <DrawStripSkeleton />
          <DrawStripSkeleton />
        </View>
      ) : query.isError && !purchases.length ? (
        <DreamErrorBanner title={C.errorTitle} text={C.errorText} retryLabel={C.retry} onRetry={() => query.refetch()} />
      ) : purchases.length ? (
        <>
          <TotalsCard
            totals={totals}
            hasFailed={hasFailed}
            partial={!!hasNextPage}
            onOpenDraw={openDraw}
            isEarlier={isEarlier}
          />

          {prizes.length ? <PrizesCard prizes={prizes} partial={ledgerPartial} onOpenWallet={() => openWallet()} /> : null}

          <View>
            <View style={styles.sectionHead}>
              <LtText role="title" accessibilityRole="header">
                {C.purchases.title}
              </LtText>
              <LtText role="micro" color={LT.ink3}>
                {C.purchases.order}
              </LtText>
            </View>
            {days.map((group, i) => (
              <View key={group.day}>
                <LtText role="kicker" accessibilityRole="header" style={[styles.day, i === 0 && styles.dayFirst]}>
                  {group.day}
                </LtText>
                <View style={styles.dayCard}>
                  {group.purchases.map((purchase, k) => (
                    <View key={purchase.ref || `failed-${purchase.atIso}`} style={k > 0 && styles.divided}>
                      <PurchaseRow
                        purchase={purchase}
                        expanded={open.has(purchase.ref)}
                        onToggle={toggle}
                        onOpenTicket={openTicket}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>

          {hasNextPage || purchases.length < total ? (
            <View style={styles.more}>
              <LtText role="micro" color={LT.ink3} tabular>
                {C.shownOf(purchases.length, total)}
              </LtText>
              <LtButton
                variant="secondary"
                size="sm"
                label={C.loadMore}
                onPress={loadMore}
                busy={isFetchingNextPage}
                busyLabel={C.loadingMore}
              />
            </View>
          ) : null}
        </>
      ) : (
        <LtEmpty
          title={C.empty.title}
          text={C.empty.text}
          action={
            <LtButton
              label={C.empty.action}
              iconRight="next"
              onPress={() => navigation.navigate("LotteryDrawTab", { screen: "LotteryDraw", pop: true })}
            />
          }
        />
      )}
    </>
  );

  return (
    <LotteryScreen
      topBar={{ variant: "root" }}
      scrollRef={scrollRef}
      onScroll={onScroll}
      contentStyle={styles.content}
      footer={<LotteryFooter />}
    >
      <PageHead title={C.title} sub={C.sub} guilloche />

      {view === null ? (
        // The first choice waits for the counts (a moment; they are usually in the cache already).
        <View style={styles.loading}>
          <DreamLoadingLine text={C.earlier.loading} />
          <DrawStripSkeleton />
          <DrawStripSkeleton />
        </View>
      ) : (
        <>
          <Segmented options={viewOptions} value={view} onChange={onView} accessibilityLabel={C.view.a11y} />
          {view === "tickets" ? (
            <EarlierTickets
              state={earlier.state}
              tickets={earlier.tickets}
              draws={earlier.places.draws}
              undecided={earlier.undecided}
              count={earlier.count}
              more={earlierMore}
              isFetchingNextPage={ticketsFetchingNext}
              nextPageFailed={ticketsNextFailed}
              onLoadMore={loadMoreTickets}
              onRetry={earlier.retry}
              newIds={newIds}
              onOpenTicket={openTicket}
              onPurchases={showPurchases}
            />
          ) : (
            purchasesView
          )}
        </>
      )}
    </LotteryScreen>
  );
}

const styles = StyleSheet.create({
  /** The board's `.lt-hist .lt-main{padding-top:20px}`. */
  content: { paddingTop: 20 },
  loading: { gap: 16 },
  sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  /** lt-base `.lt-day`: caps day header, 16 above (8 for the first) and 8 below. */
  day: { paddingTop: 16, paddingBottom: 8 },
  dayFirst: { paddingTop: 8 },
  /** One card per day; its purchases are joined by hairlines (the board's `hs-card` pieces). */
  dayCard: {
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.card,
    overflow: "hidden",
    boxShadow: LT_SHADOW.s1,
  },
  divided: { borderTopWidth: 1, borderTopColor: LT.line },
  more: { alignItems: "center", gap: 10 },
});
