import { withdrawalsApi, type CreateWithdrawalInput } from "@/api/withdrawals.api";
import type { RequestListParams, RequestSignalOptions } from "@/types/api";

export const withdrawalsService = {
  createWithdrawal(input: CreateWithdrawalInput) {
    return withdrawalsApi.createWithdrawal(input);
  },

  getMyWithdrawals(pagination: RequestListParams = {}, options: RequestSignalOptions = {}) {
    return withdrawalsApi.getMyWithdrawals(pagination, options);
  },
};
