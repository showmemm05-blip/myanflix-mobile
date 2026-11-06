import { useEffect, useMemo } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View } from "react-native";
import { LtButton } from "@/lottery/components/LtButton";
import { LtEmpty } from "@/lottery/components/LtEmpty";
import { LtText } from "@/lottery/components/LtText";
import { LtHelp } from "@/lottery/components/Surfaces";
import type { DrawInfo, TicketItem } from "@/lottery/data/sample";
import type { TicketsLoadState } from "@/lottery/hooks/useTickets";
import { DrawStripSkeleton } from "@/lottery/screens/draw/DrawStates";
import { DreamErrorBanner, DreamLoadingLine } from "@/lottery/screens/dreams/DreamStates";
import { HISTORY_COPY } from "@/lottery/screens/history/copy";
import { DrawGroupList, ticketGroupsOf } from "@/lottery/screens/tickets/parts/DrawGroupList";
import { LT } from "@/lottery/theme/tokens";

const C = HISTORY_COPY.earlier;

/**
 * History's "Tickets" (owner, 2026-10-27): the draws that left My tickets
 * when the next draw opened — the SAME draw cards (DrawGroupList → DrawGroup
 * → PileItem → TicketPile), newest draw first, each published draw's sheet
 * for its winning number and win line, a won ticket's Won pill and claim
 * chip. A ticket opens Ticket view inside the Tickets tab, as a purchase's
 * ticket IDs do.
 *
 * The screen owns the list (hooks/useTicketPlaces `useEarlierTickets`) and its
 * paging: the next page loads as the end comes near or on "Load more
 * tickets", and — while nothing of History's is loaded yet but more is to
 * come — on its own (the newest pages are often My tickets' draw). If that
 * page fails with nothing on screen, the error banner with Try again (never a
 * bare "Showing 0 tickets of N"); with cards on screen, a line over "Load
 * more tickets" says the last page did not load.
 */
export function EarlierTickets({
  state,
  tickets,
  draws,
  undecided,
  count,
  more,
  isFetchingNextPage,
  nextPageFailed,
  onLoadMore,
  onRetry,
  newIds,
  onOpenTicket,
  onPurchases,
}: {
  state: TicketsLoadState;
  /** History's tickets among the loaded pages. */
  tickets: readonly TicketItem[];
  draws: ReadonlyMap<number, DrawInfo>;
  /** Some loaded ticket's draw is not known yet. */
  undecided: boolean;
  /** How many tickets History holds in all; undefined until known. */
  count: number | undefined;
  /** More of History's tickets are still to load (another page, and fewer shown than `count`). */
  more: boolean;
  isFetchingNextPage: boolean;
  /** The last "next page" failed: it is not asked for again on its own. */
  nextPageFailed: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  newIds: ReadonlySet<string>;
  onOpenTicket: (ticketId: string) => void;
  onPurchases: () => void;
}) {
  const { groups, pendingDraws } = useMemo(() => ticketGroupsOf(tickets, draws), [tickets, draws]);
  const shown = tickets.length;
  // Nothing to show yet, but it is on its way: a draw being read, or the next page being asked for (on its
  // own, or again after it failed).
  const waiting =
    groups.length === 0 && (pendingDraws > 0 || undecided || (more && (!nextPageFailed || isFetchingNextPage)));
  const moreFailed = more && nextPageFailed && !isFetchingNextPage;
  // Android reads the banner / line through their live regions; iOS has none, so the failure is said once here.
  useEffect(() => {
    if (moreFailed && Platform.OS === "ios") AccessibilityInfo.announceForAccessibility(C.moreFailed);
  }, [moreFailed]);

  if (state === "error") {
    return <DreamErrorBanner title={C.errorTitle} text={C.errorText} retryLabel={HISTORY_COPY.retry} onRetry={onRetry} />;
  }

  if (state === "loading" || waiting) {
    return (
      <View style={styles.section}>
        <DreamLoadingLine text={C.loading} />
        <DrawStripSkeleton />
        <DrawStripSkeleton />
      </View>
    );
  }

  if (!groups.length && !more) {
    return <LtEmpty title={C.empty.title} text={C.empty.text} />;
  }

  // The page asked for on its own failed, and nothing of History's is on screen: say so, with Try again.
  if (!groups.length && moreFailed) {
    return <DreamErrorBanner title={C.errorTitle} text={C.errorText} retryLabel={HISTORY_COPY.retry} onRetry={onLoadMore} />;
  }

  return (
    <>
      {groups.length ? (
        <View style={styles.section}>
          <DrawGroupList groups={groups} newIds={newIds} onOpenTicket={onOpenTicket} onPurchases={onPurchases} />
          {pendingDraws > 0 ? <DrawStripSkeleton /> : null}
        </View>
      ) : null}

      {more ? (
        <View style={styles.more}>
          {moreFailed ? <LtHelp kind="err" text={C.moreFailed} live /> : null}
          {count !== undefined ? (
            <LtText role="micro" color={LT.ink3} tabular>
              {C.shownOf(shown, count)}
            </LtText>
          ) : null}
          <LtButton
            variant="secondary"
            size="sm"
            label={C.loadMore}
            onPress={onLoadMore}
            busy={isFetchingNextPage}
            busyLabel={C.loadingMore}
          />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: 16 },
  more: { alignItems: "center", gap: 10 },
});
