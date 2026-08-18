import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { depositsService } from "@/services/deposits.service";
import type { PaginationParams } from "@/types/api";

export function useDeposits(pagination: PaginationParams = {}) {
  return useQuery({
    queryKey: ["deposits", "mine", pagination],
    queryFn: () => depositsService.getMyDeposits(pagination),
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
