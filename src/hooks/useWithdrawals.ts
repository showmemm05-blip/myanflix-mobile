import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { withdrawalsService } from "@/services/withdrawals.service";
import type { PaginationParams } from "@/types/api";

export function useWithdrawals(pagination: PaginationParams = {}) {
  return useQuery({
    queryKey: ["withdrawals", "mine", pagination],
    queryFn: () => withdrawalsService.getMyWithdrawals(pagination),
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
