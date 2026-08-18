import { walletApi } from "@/api/wallet.api";
import type { Wallet } from "@/types/wallet";
import type { PaginationParams } from "@/types/api";

export const walletService = {
  getWallet(): Promise<Wallet> {
    return walletApi.getWallet();
  },

  getTransactions(pagination: PaginationParams = {}) {
    return walletApi.getTransactions(pagination);
  },
};
