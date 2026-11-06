import { useMemo } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { sheetOf, type PrizeSheet } from "@/lottery/data/prizes";
import { lotteryKeys } from "@/lottery/hooks/lotteryKeys";
import { lotteryService } from "@/services/lottery.service";
import type { LotteryDrawResult, LotteryPage } from "@/types/lottery";
import { ApiError } from "@/utils/errors";

/** A published sheet never changes (a draw is locked once published): five minutes is fresh. */
const RESULTS_STALE_MS = 5 * 60_000;
/** Results reads the newest published draws in one page: the latest and the earlier ones under it. */
export const RESULTS_PAGE_SIZE = 10;
/** Home's "Recent winners" asks for this many winning tickets of a draw (the API allows up to 50) and shows the first few. */
export const WINNERS_LIMIT = 20;

/** A 4xx is an answer (404 = not published yet), never retried; anything else at most twice. */
function retryUnlessClient(count: number, err: unknown): boolean {
  return count < 2 && !(err instanceof ApiError && err.status >= 400 && err.status < 500);
}

/** A 404 from GET /lottery/draws/:drawNo/results — the draw is not published (or does not exist). */
export function isResultsNotPublished(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

/**
 * GET /api/lottery/results?page=1 — the published draws newest first, each
 * with its whole prize sheet (nine groups, 173 numbers, the Ks amounts at
 * the draw's rate). Results, Check my tickets (for "the latest") and Home's
 * Latest results + Recent winners read it; `sheets` is the page in the
 * screens' shape.
 */
export function useResults() {
  const query = useQuery({
    queryKey: lotteryKeys.resultList(1, RESULTS_PAGE_SIZE),
    queryFn: ({ signal }) => lotteryService.getResults({ page: 1, pageSize: RESULTS_PAGE_SIZE }, { signal }),
    staleTime: RESULTS_STALE_MS,
    retry: retryUnlessClient,
  });
  const sheets = useMemo<PrizeSheet[]>(() => query.data?.items.map(sheetOf) ?? [], [query.data]);
  return { ...query, sheets };
}

function drawResultsOptions(drawNo: number, queryClient: ReturnType<typeof useQueryClient>) {
  return {
    queryKey: lotteryKeys.drawResults(drawNo),
    queryFn: ({ signal }: { signal?: AbortSignal }) => lotteryService.getDrawResults(drawNo, { signal }),
    staleTime: RESULTS_STALE_MS,
    // The newest draws are in the results list already more often than not: start from that row.
    initialData: () => {
      const list = queryClient.getQueryData<LotteryPage<LotteryDrawResult>>(
        lotteryKeys.resultList(1, RESULTS_PAGE_SIZE),
      );
      return list?.items.find((item) => item.drawNo === drawNo);
    },
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(lotteryKeys.resultList(1, RESULTS_PAGE_SIZE))?.dataUpdatedAt,
    retry: retryUnlessClient,
  };
}

/**
 * GET /api/lottery/draws/:drawNo/results — one published draw's sheet
 * (TicketView's winning number, Check my tickets' sheet). A 404 means the
 * draw is not published: `isResultsNotPublished(error)`.
 */
export function useDrawResults(drawNo: number | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({ ...drawResultsOptions(drawNo ?? 0, queryClient), enabled: drawNo !== undefined });
  const sheet = useMemo(() => (query.data ? sheetOf(query.data) : undefined), [query.data]);
  return { ...query, sheet };
}

/**
 * The sheets behind a list of PUBLISHED draws, by number (My tickets' draw
 * cards: the winning number and the gold win line): one query per distinct
 * draw, cached five minutes. A sheet still loading, or one that failed, is
 * simply missing from the map; the card shows what it can.
 */
export function useSheetsByNo(drawNos: readonly number[]): ReadonlyMap<number, PrizeSheet> {
  const queryClient = useQueryClient();
  const distinct = useMemo(() => [...new Set(drawNos)].sort((a, b) => a - b), [drawNos]);
  const results = useQueries({
    queries: distinct.map((drawNo) => drawResultsOptions(drawNo, queryClient)),
  });
  const data: (LotteryDrawResult | undefined)[] = results.map((r) => r.data);
  // The results array is new every render; what is loaded (and which version) is spelled as one string.
  const loadedKey = data.map((d) => (d ? `${d.drawNo}:${d.publishedAt}:${d.rate}` : "")).join("|");
  return useMemo(() => {
    const map = new Map<number, PrizeSheet>();
    for (const d of data) if (d) map.set(d.drawNo, sheetOf(d));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedKey]);
}

/**
 * GET /api/lottery/draws/:drawNo/winners?limit — one draw's winning tickets
 * (Home's "Recent winners"): number, group and Ks only, never a name. The
 * biggest prize comes first. Cached five minutes; a 4xx is never retried.
 */
export function useDrawWinners(drawNo: number | undefined) {
  return useQuery({
    queryKey: lotteryKeys.drawWinners(drawNo ?? 0, WINNERS_LIMIT),
    queryFn: ({ signal }) => lotteryService.getDrawWinners(drawNo ?? 0, WINNERS_LIMIT, { signal }),
    enabled: drawNo !== undefined,
    staleTime: RESULTS_STALE_MS,
    retry: retryUnlessClient,
  });
}
