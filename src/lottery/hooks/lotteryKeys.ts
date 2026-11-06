/**
 * THE Lottery query keys, spelled here and nowhere else (the dream keys stay
 * in useDreams.ts, where they were born). Everything is under "lottery", so
 * one invalidation after a purchase reaches the draw, the availability, the
 * tickets and the purchases at once — `invalidateAfterPurchase` leaves the
 * dream books out, which a purchase cannot change — and one refresh when a
 * Lottery screen comes back into view (`useLotteryFocusRefresh`) reaches
 * everything a publish changes.
 */
import { useCallback, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";

export const lotteryKeys = {
  all: ["lottery"] as const,
  currentDraw: ["lottery", "draw", "current"] as const,
  draw: (drawNo: number) => ["lottery", "draw", drawNo] as const,
  /**
   * Every draw, newest number first (GET /lottery/draws, every page): where a
   * draw's tickets belong — My tickets or History (hooks/useTicketPlaces).
   * Under "draw", so a purchase and the focus refresh re-read it with the rest.
   */
  drawList: ["lottery", "draw", "list"] as const,
  /** Every availability answer, whichever draw and set (what a server refusal makes stale). */
  availabilityAll: ["lottery", "availability"] as const,
  /** `numbers` is the asked set, sorted and joined with "," — one entry per distinct set. */
  availability: (drawNo: number, numbers: string) => ["lottery", "availability", drawNo, numbers] as const,
  purchases: ["lottery", "purchases"] as const,
  purchase: (ref: string) => ["lottery", "purchase", ref] as const,
  tickets: ["lottery", "tickets"] as const,
  /** The infinite list: every ticket, or one draw's. */
  ticketList: (drawNo: number | undefined) => ["lottery", "tickets", "list", drawNo ?? "all"] as const,
  /** One draw's tickets, every page as one (My tickets' draws, the same-number stepper on TicketView, Results). */
  ticketsOfDraw: (drawNo: number) => ["lottery", "tickets", "draw", drawNo] as const,
  ticket: (ticketNo: string) => ["lottery", "ticket", ticketNo] as const,
  resultList: (page: number, pageSize: number) => ["lottery", "results", "list", page, pageSize] as const,
  drawResults: (drawNo: number) => ["lottery", "results", "draw", drawNo] as const,
  /** One draw's winning tickets (number, group, Ks — never a name). */
  drawWinners: (drawNo: number, limit: number) => ["lottery", "winners", drawNo, limit] as const,
  /** Every prize-claim answer: the draw views and my list (what a request, or the admin's decision, makes stale). */
  claims: ["lottery", "claims"] as const,
  /** My prize in one draw and where its payment stands (GET /lottery/claims/draws/:drawNo). */
  claim: (drawNo: number) => ["lottery", "claims", "draw", drawNo] as const,
  /** My claims, one page (GET /lottery/claims). */
  claimList: (page: number, pageSize: number) => ["lottery", "claims", "list", page, pageSize] as const,
};

/**
 * What a purchase cannot change (the dream books, the published results and
 * winners, the prize claims) or has just written itself (the receipt, with
 * its balanceAfter).
 */
const KEPT_AFTER_PURCHASE = ["dreams", "dream", "purchase", "results", "winners", "claims"];

/** The queries a purchase changes: the draw (sold-out numbers), what is held, the tickets, the purchases list. */
export function invalidateAfterPurchase(queryClient: QueryClient): void {
  queryClient.invalidateQueries({
    queryKey: lotteryKeys.all,
    predicate: (query) => !KEPT_AFTER_PURCHASE.includes(String(query.queryKey[1])),
  });
}

/**
 * What a publish cannot change: the dream books, a receipt (its own facts),
 * the availability (a published draw sells nothing) and the purchases list.
 */
const KEPT_ON_FOCUS = ["dreams", "dream", "purchase", "availability", "purchases"];

/**
 * Re-reads, when a Lottery screen comes back into view, everything a publish
 * changes — the draws (status, winners, prizes paid), the current draw, the
 * tickets (won / not won, prize, groups, claim status), the results, the
 * winners and the prize claims (the admin may have confirmed one) — for the
 * queries on screen only. The tab roots never unmount and their caches
 * are fresh for minutes, so without this a draw published while the app is
 * in front stays "No results yet" / "Waiting for draw" until the app is
 * backgrounded or restarted. The first focus is the mount's own fetch and
 * is skipped, as useCurrentDraw does; every Lottery screen calls it.
 */
export function useLotteryFocusRefresh(): void {
  const queryClient = useQueryClient();
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      queryClient.invalidateQueries({
        queryKey: lotteryKeys.all,
        refetchType: "active",
        predicate: (query) => !KEPT_ON_FOCUS.includes(String(query.queryKey[1])),
      });
    }, [queryClient]),
  );
}
