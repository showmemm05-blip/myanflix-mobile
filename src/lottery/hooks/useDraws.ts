import { useCallback, useMemo } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { drawInfoOf } from "@/lottery/data/draws";
import type { DrawInfo } from "@/lottery/data/sample";
import { lotteryKeys } from "@/lottery/hooks/lotteryKeys";
import { CURRENT_DRAW_STALE_MS, type CurrentDrawCache } from "@/lottery/hooks/useCurrentDraw";
import { lotteryService } from "@/services/lottery.service";
import type { LotteryDraw } from "@/types/lottery";
import { ApiError } from "@/utils/errors";

/** A draw's facts (date, price, picture, frame) change only by the admin's hand: five minutes is fresh. */
const DRAW_STALE_MS = 5 * 60_000;
/** The draw list is read in pages of the API's most (DRAW_PAGE_SIZE_MAX): one request covers years of draws. */
const DRAW_LIST_PAGE_SIZE = 100;
/** A guard against a server that keeps saying there is more: never more pages than this. */
const DRAW_LIST_MAX_PAGES = 50;

function retryUnlessClient(count: number, err: unknown): boolean {
  return count < 2 && !(err instanceof ApiError && err.status >= 400 && err.status < 500);
}

/** Every draw there is, newest number first: page after page until the total is in (one page, in practice). */
async function fetchAllDraws(signal: AbortSignal | undefined): Promise<LotteryDraw[]> {
  const draws: LotteryDraw[] = [];
  for (let page = 1; page <= DRAW_LIST_MAX_PAGES; page++) {
    const data = await lotteryService.getDraws({ page, pageSize: DRAW_LIST_PAGE_SIZE }, { signal });
    draws.push(...data.items);
    if (!data.items.length || draws.length >= data.total) break;
  }
  return draws;
}

/**
 * GET /api/lottery/draws — every draw (SCHEDULED to PUBLISHED), newest
 * number first. A draw is a small row and there are a few a month, so the
 * whole list is read at once; it says which earlier draws are still waiting
 * for their results (hooks/useTicketPlaces). As fresh as the current draw
 * (half a minute): a new draw showing up is what moves the last one's
 * tickets to History, and the focus refresh re-reads both together.
 */
export function useDrawList() {
  const query = useQuery({
    queryKey: lotteryKeys.drawList,
    queryFn: ({ signal }) => fetchAllDraws(signal),
    staleTime: CURRENT_DRAW_STALE_MS,
    retry: retryUnlessClient,
  });
  const draws = useMemo<DrawInfo[]>(() => query.data?.map(drawInfoOf) ?? [], [query.data]);
  return { ...query, draws };
}

function drawQueryOptions(drawNo: number, queryClient: ReturnType<typeof useQueryClient>) {
  return {
    queryKey: lotteryKeys.draw(drawNo),
    queryFn: ({ signal }: { signal?: AbortSignal }) => lotteryService.getDraw(drawNo, { signal }),
    staleTime: DRAW_STALE_MS,
    // The current draw is in the cache already more often than not: start from it.
    initialData: () => {
      const current = queryClient.getQueryData<CurrentDrawCache>(lotteryKeys.currentDraw);
      return current?.draw?.drawNo === drawNo ? current.draw : undefined;
    },
    initialDataUpdatedAt: () => queryClient.getQueryState(lotteryKeys.currentDraw)?.dataUpdatedAt,
    retry: (count: number, err: unknown) =>
      count < 2 && !(err instanceof ApiError && err.status >= 400 && err.status < 500),
  };
}

/** GET /api/lottery/draws/:drawNo — one draw (Printed's and TicketView's draw; 404 = no such draw). */
export function useDraw(drawNo: number | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({ ...drawQueryOptions(drawNo ?? 0, queryClient), enabled: drawNo !== undefined });
  const info = useMemo(() => (query.data ? drawInfoOf(query.data) : undefined), [query.data]);
  return { ...query, info };
}

const NO_NUMBERS: readonly number[] = [];

export interface DrawsByNo {
  /** Every loaded draw, by number. A draw still loading, or one that failed, is missing. */
  draws: ReadonlyMap<number, DrawInfo>;
  /** The draws whose read failed with nothing to show (after its retries), lowest number first. */
  failedNos: readonly number[];
  /** Asks again for each draw in `failedNos`. */
  retry: () => void;
}

/**
 * The draws behind a list of tickets or purchases, by number: one query per
 * distinct draw (cached five minutes, so a list of a hundred tickets over
 * three draws costs three small requests once). `failedNos` names the reads
 * that failed, so a caller that must not place a ticket on a guess can say so
 * (with Try again → `retry`) instead of waiting for ever.
 */
export function useDrawsByNo(drawNos: readonly number[]): DrawsByNo {
  const queryClient = useQueryClient();
  const distinct = useMemo(() => [...new Set(drawNos)].sort((a, b) => a - b), [drawNos]);
  const results = useQueries({
    queries: distinct.map((drawNo) => drawQueryOptions(drawNo, queryClient)),
  });
  const draws: (LotteryDraw | undefined)[] = results.map((r) => r.data);
  // The results array is new every render; what matters is which draws are loaded (and which version of each),
  // spelled as one string so the memo's dependency list keeps one entry whatever the number of draws.
  const loadedKey = draws
    .map((draw) =>
      draw
        ? [
            draw.drawNo,
            draw.status,
            draw.thaiDrawDate,
            draw.salesCloseAt,
            draw.ticketPrice,
            draw.pictureUrl ?? "",
            draw.frameUrl ?? "",
          ].join(":")
        : "",
    )
    .join("|");
  const map = useMemo(() => {
    const out = new Map<number, DrawInfo>();
    for (const draw of draws) if (draw) out.set(draw.drawNo, drawInfoOf(draw));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedKey]);
  // Same trick for the failed ones: "12,17" — a stable array while the same draws stay failed.
  const failedKey = results
    .flatMap((r, i) => (r.data === undefined && r.isError ? [distinct[i]] : []))
    .join(",");
  const failedNos = useMemo(() => (failedKey ? failedKey.split(",").map(Number) : NO_NUMBERS), [failedKey]);
  const retry = useCallback(() => {
    for (const drawNo of failedNos) void queryClient.refetchQueries({ queryKey: lotteryKeys.draw(drawNo), exact: true });
  }, [failedNos, queryClient]);
  return { draws: map, failedNos, retry };
}
