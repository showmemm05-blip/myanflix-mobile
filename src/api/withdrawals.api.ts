import { apiClient } from "@/api/client";
import type { Withdrawal } from "@/types/withdrawal";
import type { PaginatedResponse, PaginationParams } from "@/types/api";

export const withdrawalsApi = {
  createWithdrawal(
    amount: number,
    accountType: string,
    accountName: string,
    accountNumber: string,
    /** Only sent for bank-transfer account types; omitted entirely otherwise. */
    bankName?: string,
  ) {
    return apiClient.post<Withdrawal>("/withdrawals", {
      amount,
      accountType,
      accountName,
      accountNumber,
      ...(bankName ? { bankName } : {}),
    });
  },

  getMyWithdrawals(pagination: PaginationParams = {}) {
    return apiClient.get<PaginatedResponse<Withdrawal>>("/withdrawals/me", { params: pagination });
  },
};
