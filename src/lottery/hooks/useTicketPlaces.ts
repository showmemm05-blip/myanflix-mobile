/**
 * MY TICKETS vs HISTORY (owner, 2026-10-27: "keep tickets until next draw
 * show up"). Which draws' tickets the Tickets tab shows and which ones
 * Lottery history keeps — the rule itself is `data/draws.ts ticketPlaceOf`;
 * this file feeds it the current draw and every draw's status, and loads
 * each side the cheapest correct way:
 *
 * - My tickets (`useCurrentTickets`) never pages through the whole ticket
 *   history: the draw list (one small request, `useDrawList`) names the
 *   draws that belong there — the current draw, any newer one, any earlier
 *   one still waiting for its results — and each of those draws' tickets is
 *   read whole (`useTicketsOfDraws`; a draw is small).
 * - History (`useEarlierTickets`) pages the customer's whole list as before
 *   (`useTicketsInfinite`) and keeps the tickets whose draw is History's.
 *   Its count is exact without paging: every ticket I hold (page 1's total)
 *   minus the ones on My tickets.
 *
 * While the current draw or the draw list is still loading, or failed with
 * nothing to show, nothing is placed ("loading" / "error"): a ticket is never
 * moved on a guess. The same holds for a draw read on its own (one a ticket
 * names that the list did not have yet): History waits while it loads and
 * says "error" with Try again if it failed.
 */
import { useCallback, useMemo } from "react";
import { ticketPlaceOf, type TicketPlace } from "@/lottery/data/draws";
import type { DrawInfo } from "@/lottery/data/sample";
import { useCurrentDraw } from "@/lottery/hooks/useCurrentDraw";
import { useDrawList, useDrawsByNo } from "@/lottery/hooks/useDraws";
import {
  flattenTickets,
  useTicketsInfinite,
  useTicketsOfDraws,
  type TicketsLoadState,
} from "@/lottery/hooks/useTickets";

const NONE: readonly number[] = [];

export interface TicketPlaces {
  /** "ready" once the current draw and the draw list are in; "error" when either failed with nothing to show. */
  state: TicketsLoadState;
  /** Asks again for whichever failed: the current draw, the draw list, a draw read on its own (`failedNos`). */
  retry: () => void;
  /** The draw GET /lottery/draws/current answers; null when there is no draw at all. */
  current: DrawInfo | null;
  /** Every draw known, by number: the list, any draw a ticket names that the list does not have yet, the current one. */
  draws: ReadonlyMap<number, DrawInfo>;
  /**
   * The draws My tickets shows, newest first (empty until "ready"): the
   * current draw always, and every other draw the rule keeps there — except
   * a SCHEDULED one, which has sold nothing (a draw only goes on to OPEN).
   */
  keptNos: readonly number[];
  /** Where a draw's tickets belong; undefined until "ready", or while that draw is unknown. */
  placeOf: (drawNo: number) => TicketPlace | undefined;
  /** Draws a loaded ticket names whose own read failed (see `seenNos`): their tickets cannot be placed. */
  failedNos: readonly number[];
}

/**
 * The current draw + every draw's status → where each draw's tickets go.
 * `seenNos` are the draws a loaded ticket list names: one the draw list does
 * not have yet (it was read before that draw existed) is read on its own.
 */
export function useTicketPlaces(seenNos: readonly number[] = NONE): TicketPlaces {
  const current = useCurrentDraw();
  const list = useDrawList();
  const currentInfo = current.data?.info ?? null;
  const currentNo = currentInfo?.no ?? null;

  const listed = useMemo(() => {
    const map = new Map<number, DrawInfo>();
    for (const draw of list.draws) map.set(draw.no, draw);
    return map;
  }, [list.draws]);
  // Only once the list is in (before that every draw would look missing and be read one by one).
  const listIn = list.data !== undefined;
  const missing = useMemo(
    () =>
      listIn ? [...new Set(seenNos)].filter((drawNo) => !listed.has(drawNo) && drawNo !== currentNo) : NONE,
    [listIn, seenNos, listed, currentNo],
  );
  const { draws: extra, failedNos, retry: retryExtra } = useDrawsByNo(missing);
  const draws = useMemo(() => {
    const map = new Map(listed);
    for (const [drawNo, draw] of extra) if (!map.has(drawNo)) map.set(drawNo, draw);
    // The current draw is re-read more often (on every focus): its status wins.
    if (currentInfo) map.set(currentInfo.no, currentInfo);
    return map;
  }, [listed, extra, currentInfo]);

  const state: TicketsLoadState =
    (current.data === undefined && current.isError) || (list.data === undefined && list.isError)
      ? "error"
      : current.data === undefined || list.data === undefined
        ? "loading"
        : "ready";

  const placeOf = useCallback(
    (drawNo: number): TicketPlace | undefined => {
      if (state !== "ready") return undefined;
      if (currentNo === null || drawNo >= currentNo) return "tickets";
      const draw = draws.get(drawNo);
      return draw ? ticketPlaceOf(drawNo, draw.status, currentNo) : undefined;
    },
    [state, currentNo, draws],
  );

  const keptNos = useMemo(() => {
    if (state !== "ready") return NONE;
    const kept = new Set<number>();
    if (currentNo !== null) kept.add(currentNo);
    for (const [drawNo, draw] of draws) {
      if (draw.status !== "scheduled" && placeOf(drawNo) === "tickets") kept.add(drawNo);
    }
    return [...kept].sort((a, b) => b - a);
  }, [state, currentNo, draws, placeOf]);

  const { refetch: refetchCurrent, isError: currentFailed } = current;
  const { refetch: refetchList, isError: listFailed } = list;
  const retry = useCallback(() => {
    if (currentFailed) refetchCurrent();
    if (listFailed) refetchList();
    retryExtra();
  }, [currentFailed, listFailed, refetchCurrent, refetchList, retryExtra]);

  return { state, retry, current: currentInfo, draws, keptNos, placeOf, failedNos };
}

/**
 * MY TICKETS' set: every ticket of the draws the rule keeps there (each
 * draw read whole). "loading" / "error" until the places AND those draws
 * are in; "ready" with no tickets = the empty page.
 */
export function useCurrentTickets() {
  const places = useTicketPlaces();
  const kept = useTicketsOfDraws(places.keptNos);
  const state: TicketsLoadState = places.state !== "ready" ? places.state : kept.state;
  const { retry: retryPlaces } = places;
  const { retry: retryKept } = kept;
  const retry = () => {
    retryPlaces();
    retryKept();
  };
  return { places, tickets: kept.tickets, state, retry };
}

/**
 * HISTORY'S tickets: the customer's whole list, newest first, page by page
 * (`list` — its next page, its "Load more"), keeping the tickets whose draw
 * is History's. `count` is how many History holds in all (every ticket I
 * hold minus My tickets' set), undefined until both are known. A ticket
 * whose draw is not known yet is `undecided` (the card waits for it); if
 * that draw's own read FAILED, `state` is "error" (Try again re-reads it)
 * rather than a skeleton that never ends.
 */
export function useEarlierTickets() {
  const list = useTicketsInfinite();
  const all = useMemo(() => flattenTickets(list.data), [list.data]);
  const seen = useMemo(() => all.map((t) => t.drawNo), [all]);
  const places = useTicketPlaces(seen);
  const kept = useTicketsOfDraws(places.keptNos);
  const { placeOf } = places;

  const tickets = useMemo(() => all.filter((t) => placeOf(t.drawNo) === "history"), [all, placeOf]);
  // The draws of loaded tickets that cannot be placed yet (none until the places are in).
  const unplaced = useMemo(
    () =>
      places.state === "ready"
        ? new Set(all.filter((t) => placeOf(t.drawNo) === undefined).map((t) => t.drawNo))
        : new Set<number>(),
    [places.state, all, placeOf],
  );
  const drawFailed = places.failedNos.some((drawNo) => unplaced.has(drawNo));
  const undecided = unplaced.size > 0 && !drawFailed;
  const allTotal = list.data?.pages[0]?.total;
  const count =
    allTotal !== undefined && places.state === "ready" && kept.state === "ready"
      ? Math.max(0, allTotal - kept.tickets.length)
      : undefined;
  const state: TicketsLoadState =
    list.data === undefined ? (list.isError ? "error" : "loading") : drawFailed ? "error" : places.state;
  /** The count could not be worked out (My tickets' set failed): History cannot say whether it holds any. */
  const countFailed = kept.state === "error";

  const { refetch: refetchList, isError: listFailed } = list;
  const { retry: retryPlaces } = places;
  const { retry: retryKept } = kept;
  const retry = () => {
    if (listFailed) refetchList();
    retryPlaces();
    retryKept();
  };

  return { list, tickets, count, countFailed, undecided, state, retry, places };
}
