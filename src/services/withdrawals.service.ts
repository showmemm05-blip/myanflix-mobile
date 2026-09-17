import { withdrawalsApi } from "@/api/withdrawals.api";
import type { PaginationParams, RequestSignalOptions } from "@/types/api";

export const withdrawalsService = {
  createWithdrawal(
    amount: number,
    accountType: string,
    accountName: string,
    accountNumber: string,
    bankName?: string,
  ) {
    return withdrawalsApi.createWithdrawal(amount, accountType, accountName, accountNumber, bankName);
  },

  getMyWithdrawals(pagination: PaginationParams = {}, options: RequestSignalOptions = {}) {
    return withdrawalsApi.getMyWithdrawals(pagination, options);
  },
};
