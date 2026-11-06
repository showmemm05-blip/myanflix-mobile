import { useMemo } from "react";
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { purchaseItemOf } from "@/lottery/data/draws";
import type { PurchaseItem } from "@/lottery/data/sample";
import { lotteryKeys } from "@/lottery/hooks/lotteryKeys";
import { lotteryNextPage } from "@/lottery/hooks/useTickets";
import { lotteryService } from "@/services/lottery.service";
import type { LotteryPage, LotteryPurchase } from "@/types/lottery";
import { ApiError } from "@/utils/errors";

export const PURCHASES_PAGE_SIZE = 30;
const STALE_MS = 60_000;

/** Every loaded page's purchases in order, as History reads them. */
export function flattenPurchases(data: InfiniteData<LotteryPage<LotteryPurchase>> | undefined): PurchaseItem[] {
  return data?.pages.flatMap((page) => page.items.map(purchaseItemOf)) ?? [];
}

/** GET /api/lottery/purchases?page&pageSize — the customer's purchases, newest first (Lottery history). */
export function usePurchasesInfinite() {
  return useInfiniteQuery({
    queryKey: lotteryKeys.purchases,
    queryFn: ({ pageParam, signal }) =>
      lotteryService.getPurchases({ page: pageParam, pageSize: PURCHASES_PAGE_SIZE }, { signal }),
    initialPageParam: 1,
    getNextPageParam: lotteryNextPage,
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
  });
}

/** A 404 from GET /lottery/purchases/:ref — not this customer's, or no such purchase. */
export function isPurchaseNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

/**
 * GET /api/lottery/purchases/:ref — one purchase (Printed). The one just made
 * is already in the cache under its ref (useBuyTickets puts it there, with
 * `balanceAfter`), so Printed opens without a request; a ref from History's
 * cache is taken from there; anything else is fetched.
 */
export function usePurchase(ref: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: lotteryKeys.purchase(ref ?? ""),
    queryFn: ({ signal }) => lotteryService.getPurchase(ref as string, { signal }),
    enabled: !!ref,
    staleTime: Infinity,
    initialData: () => {
      const list = queryClient.getQueryData<InfiniteData<LotteryPage<LotteryPurchase>>>(lotteryKeys.purchases);
      for (const page of list?.pages ?? []) {
        const hit = page.items.find((p) => p.ref === ref);
        if (hit) return hit;
      }
      return undefined;
    },
    retry: (count, err) => count < 2 && !(err instanceof ApiError && err.status >= 400 && err.status < 500),
  });
  const purchase = useMemo(() => (query.data ? purchaseItemOf(query.data) : undefined), [query.data]);
  return { ...query, purchase };
}
