import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { walletService } from "@/services/wallet.service";
import { nextPageParam } from "@/hooks/pagination";
import type { PaginationParams } from "@/types/api";

export function useWallet() {
  return useQuery({
    queryKey: ["wallet"],
    queryFn: ({ signal }) => walletService.getWallet({ signal }),
  });
}

export function useTransactions(pagination: PaginationParams = {}) {
  return useQuery({
    queryKey: ["wallet", "transactions", pagination],
    queryFn: ({ signal }) => walletService.getTransactions(pagination, { signal }),
  });
}

/**
 * The Transactions screen's endless ledger. Under the same
 * `["wallet", "transactions"]` prefix as the one-page hook above, so the
 * wallet socket's `invalidateQueries({ queryKey: ["wallet", "transactions"] })`
 * (useRealtimeWallet) refreshes the paged list the moment a deposit or
 * withdrawal is approved, exactly as it refreshed the 50-row one. `enabled`
 * is the visible ledger tab: the three ledgers share one screen and only the
 * one on screen should be on the wire.
 */
export function useTransactionsInfinite(pagination: PaginationParams = {}, options: { enabled?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: ["wallet", "transactions", "infinite", pagination],
    queryFn: ({ pageParam, signal }) => walletService.getTransactions({ ...pagination, page: pageParam }, { signal }),
    enabled: options.enabled ?? true,
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
    placeholderData: keepPreviousData,
  });
}
