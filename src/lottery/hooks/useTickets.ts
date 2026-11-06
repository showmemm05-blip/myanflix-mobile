import { useCallback, useMemo } from "react";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQueries,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type UseQueryResult,
} from "@tanstack/react-query";
import { ticketItemOf } from "@/lottery/data/draws";
import type { TicketItem } from "@/lottery/data/sample";
import { lotteryKeys } from "@/lottery/hooks/lotteryKeys";
import { lotteryService } from "@/services/lottery.service";
import type { LotteryPage, LotteryTicket } from "@/types/lottery";
import { ApiError } from "@/utils/errors";

/** My tickets pages by this many (the API allows up to 200; a page of piles is heavy to draw, so it stays modest). */
export const TICKETS_PAGE_SIZE = 50;
/** One draw's tickets are read at the API's most per page (200); a draw caps each number, so one page almost always. */
const DRAW_PAGE_SIZE = 200;
/** A guard against a server that keeps saying there is more: never more pages of one draw than this. */
const DRAW_MAX_PAGES = 50;
/** A ticket list changes only when this customer buys (which invalidates it); between, a minute is fresh. */
const STALE_MS = 60_000;

/** `getNextPageParam` for a Lottery page (`pageSize`, not the catalogue's `limit`): stops once loaded ≥ total. */
export function lotteryNextPage<T>(lastPage: LotteryPage<T>, allPages: LotteryPage<T>[]): number | undefined {
  const loaded = allPages.reduce((count, page) => count + page.items.length, 0);
  return loaded < lastPage.total ? lastPage.page + 1 : undefined;
}

/** Every loaded page's rows in order, as ticket items. */
export function flattenTickets(data: InfiniteData<LotteryPage<LotteryTicket>> | undefined): TicketItem[] {
  return data?.pages.flatMap((page) => page.items.map(ticketItemOf)) ?? [];
}

/**
 * GET /api/lottery/tickets?page&pageSize(&drawNo) — the customer's own
 * tickets, newest first, page by page (My tickets' endless list).
 */
export function useTicketsInfinite(drawNo?: number, options: { enabled?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: lotteryKeys.ticketList(drawNo),
    queryFn: ({ pageParam, signal }) =>
      lotteryService.getTickets({ drawNo, page: pageParam, pageSize: TICKETS_PAGE_SIZE }, { signal }),
    initialPageParam: 1,
    getNextPageParam: lotteryNextPage,
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

/**
 * Every ticket I hold in one draw, as ONE page: page 1 at the API's most,
 * then the rest only if the total says there is more (a draw caps each
 * number, so one request almost always). Newest first, as the API answers;
 * a ticket seen twice (a purchase landing between two pages) is kept once.
 */
async function fetchDrawTickets(drawNo: number, signal: AbortSignal | undefined): Promise<LotteryPage<LotteryTicket>> {
  const first = await lotteryService.getTickets({ drawNo, page: 1, pageSize: DRAW_PAGE_SIZE }, { signal });
  const seen = new Set(first.items.map((t) => t.ticketNo));
  const items = [...first.items];
  for (let page = 2; page <= DRAW_MAX_PAGES && items.length < first.total; page++) {
    const next = await lotteryService.getTickets({ drawNo, page, pageSize: DRAW_PAGE_SIZE }, { signal });
    if (!next.items.length) break;
    for (const t of next.items) {
      if (seen.has(t.ticketNo)) continue;
      seen.add(t.ticketNo);
      items.push(t);
    }
  }
  return { items, total: Math.max(first.total, items.length), page: 1, pageSize: Math.max(DRAW_PAGE_SIZE, items.length) };
}

function drawTicketsOptions(drawNo: number) {
  return {
    queryKey: lotteryKeys.ticketsOfDraw(drawNo),
    queryFn: ({ signal }: { signal?: AbortSignal }) => fetchDrawTickets(drawNo, signal),
    staleTime: STALE_MS,
  };
}

/** One draw's tickets, all of them — TicketView's same-number stepper, Results and Check my tickets, Home. */
export function useDrawTickets(drawNo: number | undefined) {
  const query = useQuery({ ...drawTicketsOptions(drawNo ?? 0), enabled: drawNo !== undefined });
  const tickets = useMemo(() => query.data?.items.map(ticketItemOf) ?? [], [query.data]);
  return { ...query, tickets };
}

export type TicketsLoadState = "loading" | "error" | "ready";

const NO_DRAWS: readonly number[] = [];

interface DrawTicketsAnswer {
  /** Each draw's page, in the queries' order; undefined while that draw has nothing yet. */
  pages: (LotteryPage<LotteryTicket> | undefined)[];
  state: TicketsLoadState;
  /** Which draws' last read failed (with or without an earlier answer to show), in the queries' order. */
  errored: boolean[];
}

/**
 * The draws' queries as one value. TanStack runs this only when a query's
 * result changed and shares the answer structurally (replaceEqualDeep), and
 * each query already keeps its `data` object when a refetch brings the same
 * tickets — so a focus refresh that changes nothing hands back the SAME
 * `pages` array, and nothing below re-renders.
 */
function combineDrawTickets(results: UseQueryResult<LotteryPage<LotteryTicket>>[]): DrawTicketsAnswer {
  return {
    pages: results.map((r) => r.data),
    state: results.some((r) => r.data === undefined && r.isError)
      ? "error"
      : results.some((r) => r.data === undefined)
        ? "loading"
        : "ready",
    errored: results.map((r) => r.isError),
  };
}

/**
 * Several draws' tickets at once (My tickets: the current draw, and the rare
 * earlier one still waiting for its results), one query per draw shared with
 * `useDrawTickets`. `state` is "loading" while any draw has nothing yet,
 * "error" when any of them failed with nothing to show (a list never shows
 * part of the draws on a guess), else "ready"; no draws at all is "ready".
 */
export function useTicketsOfDraws(drawNos: readonly number[] = NO_DRAWS) {
  const queryClient = useQueryClient();
  const distinct = useMemo(() => [...new Set(drawNos)].sort((a, b) => b - a), [drawNos]);
  const { pages, state, errored } = useQueries({
    queries: distinct.map((drawNo) => drawTicketsOptions(drawNo)),
    combine: combineDrawTickets,
  });
  const tickets = useMemo<TicketItem[]>(() => pages.flatMap((page) => page?.items.map(ticketItemOf) ?? []), [pages]);
  const retry = useCallback(() => {
    distinct.forEach((drawNo, i) => {
      if (errored[i]) void queryClient.refetchQueries({ queryKey: lotteryKeys.ticketsOfDraw(drawNo), exact: true });
    });
  }, [distinct, errored, queryClient]);
  return { tickets, state, retry };
}

/** A 404 from GET /lottery/tickets/:ticketNo — not this customer's, or no such ticket. */
export function isTicketNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

/**
 * GET /api/lottery/tickets/:ticketNo — one ticket, large. Opened from a list
 * it is already in the cache, so that row is the initial data and no second
 * request is made while the list is fresh. Never retried on a 4xx (a 404 is
 * an answer).
 */
export function useTicket(ticketNo: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: lotteryKeys.ticket(ticketNo ?? ""),
    queryFn: ({ signal }) => lotteryService.getTicket(ticketNo as string, { signal }),
    enabled: !!ticketNo,
    staleTime: STALE_MS,
    initialData: () => {
      const lists = queryClient.getQueriesData<InfiniteData<LotteryPage<LotteryTicket>> | LotteryPage<LotteryTicket>>({
        queryKey: lotteryKeys.tickets,
      });
      for (const [, data] of lists) {
        const pages = data && "pages" in data ? data.pages : data ? [data] : [];
        for (const page of pages) {
          const hit = page.items.find((t) => t.ticketNo === ticketNo);
          if (hit) return hit;
        }
      }
      return undefined;
    },
    retry: (count, err) => count < 2 && !(err instanceof ApiError && err.status >= 400 && err.status < 500),
  });
  const ticket = useMemo(() => (query.data ? ticketItemOf(query.data) : undefined), [query.data]);
  return { ...query, ticket };
}
