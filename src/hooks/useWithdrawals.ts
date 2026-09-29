import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { withdrawalsService } from "@/services/withdrawals.service";
import { nextPageParam } from "@/hooks/pagination";
import type { PaginationParams } from "@/types/api";

export function useWithdrawals(pagination: PaginationParams = {}) {
  return useQuery({
    queryKey: ["withdrawals", "mine", pagination],
    queryFn: ({ signal }) => withdrawalsService.getMyWithdrawals(pagination, { signal }),
  });
}

/**
 * The Transactions screen's Withdrawals ledger, paged. Same `["withdrawals"]`
 * prefix as above so useCreateWithdrawal's and the wallet socket's prefix
 * invalidations reach it; `enabled` is the visible ledger tab (see
 * useTransactionsInfinite).
 */
export function useWithdrawalsInfinite(pagination: PaginationParams = {}, options: { enabled?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: ["withdrawals", "mine", "infinite", pagination],
    queryFn: ({ pageParam, signal }) =>
      withdrawalsService.getMyWithdrawals({ ...pagination, page: pageParam }, { signal }),
    enabled: options.enabled ?? true,
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
    placeholderData: keepPreviousData,
  });
}

export function useCreateWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      amount,
      accountType,
      accountName,
      accountNumber,
      bankName,
    }: {
      amount: number;
      accountType: string;
      accountName: string;
      accountNumber: string;
      /** Only for bank-transfer account types. */
      bankName?: string;
    }) => withdrawalsService.createWithdrawal(amount, accountType, accountName, accountNumber, bankName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}
