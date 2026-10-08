import { apiClient } from "@/api/client";
import type { Withdrawal } from "@/types/withdrawal";
import type { PaginatedResponse, RequestListParams, RequestSignalOptions } from "@/types/api";

export interface CreateWithdrawalInput {
  amount: number;
  accountType: string;
  accountName: string;
  accountNumber: string;
  /** Only sent for bank-transfer account types; omitted entirely otherwise. */
  bankName?: string;
  /**
   * The account's 6-digit withdrawal code. Every withdrawal needs it since
   * 2026-10-05: the server checks it after the amount and balance checks and
   * before any money is held, and answers a missing, wrong or locked code
   * with a coded 400/409/423 (see types/withdrawal-code.ts).
   */
  withdrawalCode: string;
}

export const withdrawalsApi = {
  createWithdrawal({ amount, accountType, accountName, accountNumber, bankName, withdrawalCode }: CreateWithdrawalInput) {
    return apiClient.post<Withdrawal>("/withdrawals", {
      amount,
      accountType,
      accountName,
      accountNumber,
      ...(bankName ? { bankName } : {}),
      withdrawalCode,
    });
  },

  getMyWithdrawals(pagination: RequestListParams = {}, options: RequestSignalOptions = {}) {
    return apiClient.get<PaginatedResponse<Withdrawal>>("/withdrawals/me", { params: pagination, ...options });
  },
};
