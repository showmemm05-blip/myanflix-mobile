import { apiClient } from "@/api/client";
import type { Wallet } from "@/types/wallet";
import type { PaginatedResponse, PaginationParams } from "@/types/api";

export type TransactionType =
  | "PURCHASE"
  | "DEPOSIT"
  | "REFUND"
  | "SUBSCRIPTION"
  | "WITHDRAWAL"
  | "ADJUSTMENT_CREDIT"
  | "ADJUSTMENT_DEBIT";
export type TransactionStatus = "COMPLETED" | "PENDING" | "FAILED";

export interface BackendTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  movieId: string | null;
  createdAt: string;
}

export const walletApi = {
  getWallet() {
    return apiClient.get<Wallet>("/wallet");
  },

  getTransactions(pagination: PaginationParams = {}) {
    return apiClient.get<PaginatedResponse<BackendTransaction>>("/wallet/transactions", { params: pagination });
  },
};
