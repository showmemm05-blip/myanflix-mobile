import { apiClient } from "@/api/client";
import type { Transaction, Wallet } from "@/types/wallet";
import type { PaginatedResponse, PaginationParams, RequestSignalOptions } from "@/types/api";

export const walletApi = {
  getWallet(options: RequestSignalOptions = {}) {
    return apiClient.get<Wallet>("/wallet", options);
  },

  getTransactions(pagination: PaginationParams = {}, options: RequestSignalOptions = {}) {
    return apiClient.get<PaginatedResponse<Transaction>>("/wallet/transactions", {
      params: pagination,
      ...options,
    });
  },
};
