import { useQuery } from "@tanstack/react-query";
import { walletService } from "@/services/wallet.service";
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
