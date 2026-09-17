import { walletApi } from "@/api/wallet.api";
import type { Wallet } from "@/types/wallet";
import type { PaginationParams, RequestSignalOptions } from "@/types/api";

export const walletService = {
  getWallet(options: RequestSignalOptions = {}): Promise<Wallet> {
    return walletApi.getWallet(options);
  },

  getTransactions(pagination: PaginationParams = {}, options: RequestSignalOptions = {}) {
    return walletApi.getTransactions(pagination, options);
  },
};
