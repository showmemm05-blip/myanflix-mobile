import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { withdrawalsService } from "@/services/withdrawals.service";
import { nextPageParam } from "@/hooks/pagination";
import { FORGET_AT_ONCE, refreshStatusAfterCodedError } from "@/hooks/useWithdrawalCode";
import type { CreateWithdrawalInput } from "@/api/withdrawals.api";
import type { RequestListParams } from "@/types/api";

export function useWithdrawals(pagination: RequestListParams = {}) {
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
export function useWithdrawalsInfinite(pagination: RequestListParams = {}, options: { enabled?: boolean } = {}) {
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

/**
 * Every withdrawal carries the account's 6-digit code (2026-10-05). The code
 * is in this mutation's variables, so the mutation is forgotten as soon as
 * nothing observes it (see useWithdrawalCode FORGET_AT_ONCE). A coded
 * refusal (wrong / locked / no code yet) re-reads the code status.
 */
export function useCreateWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    ...FORGET_AT_ONCE,
    mutationFn: (input: CreateWithdrawalInput) => withdrawalsService.createWithdrawal(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (err) => refreshStatusAfterCodedError(queryClient, err),
  });
}
