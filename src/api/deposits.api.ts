import { apiClient } from "@/api/client";
import type { Deposit } from "@/types/deposit";
import type { PaginatedResponse, PaginationParams } from "@/types/api";

export const depositsApi = {
  createDeposit(
    amount: number,
    paymentMethod: string,
    reference: string,
    accountName?: string,
    paymentAccountId?: string,
  ) {
    return apiClient.post<Deposit>("/deposits", {
      amount,
      paymentMethod,
      accountName,
      reference,
      paymentAccountId,
    });
  },

  getMyDeposits(pagination: PaginationParams = {}) {
    return apiClient.get<PaginatedResponse<Deposit>>("/deposits/me", { params: pagination });
  },
};
