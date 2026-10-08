import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { depositsService } from "@/services/deposits.service";
import { nextPageParam } from "@/hooks/pagination";
import type { RequestListParams } from "@/types/api";

export function useDeposits(pagination: RequestListParams = {}) {
  return useQuery({
    queryKey: ["deposits", "mine", pagination],
    queryFn: ({ signal }) => depositsService.getMyDeposits(pagination, { signal }),
  });
}

/**
 * The Transactions screen's Deposits ledger, paged. Same `["deposits"]`
 * prefix as above so useCreateDeposit's and the wallet socket's prefix
 * invalidations reach it; `enabled` is the visible ledger tab (see
 * useTransactionsInfinite).
 */
export function useDepositsInfinite(pagination: RequestListParams = {}, options: { enabled?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: ["deposits", "mine", "infinite", pagination],
    queryFn: ({ pageParam, signal }) => depositsService.getMyDeposits({ ...pagination, page: pageParam }, { signal }),
    enabled: options.enabled ?? true,
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
    placeholderData: keepPreviousData,
  });
}

export function useCreateDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      amount,
      paymentMethod,
      reference,
      accountName,
      paymentAccountId,
    }: {
      amount: number;
      paymentMethod: string;
      reference: string;
      accountName?: string;
      paymentAccountId?: string;
    }) => depositsService.createDeposit(amount, paymentMethod, reference, accountName, paymentAccountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deposits"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}
