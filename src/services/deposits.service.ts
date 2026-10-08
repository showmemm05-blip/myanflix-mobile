import { depositsApi } from "@/api/deposits.api";
import type { RequestListParams, RequestSignalOptions } from "@/types/api";

export const depositsService = {
  createDeposit(
    amount: number,
    paymentMethod: string,
    reference: string,
    accountName?: string,
    paymentAccountId?: string,
  ) {
    return depositsApi.createDeposit(amount, paymentMethod, reference, accountName, paymentAccountId);
  },

  getMyDeposits(pagination: RequestListParams = {}, options: RequestSignalOptions = {}) {
    return depositsApi.getMyDeposits(pagination, options);
  },
};
