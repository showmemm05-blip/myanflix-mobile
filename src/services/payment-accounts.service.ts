import { paymentAccountsApi } from "@/api/payment-accounts.api";
import type { RequestSignalOptions } from "@/types/api";

export const paymentAccountsService = {
  getAccounts(options: RequestSignalOptions = {}) {
    return paymentAccountsApi.getAccounts(options);
  },

  getTypes(options: RequestSignalOptions = {}) {
    return paymentAccountsApi.getTypes(options);
  },
};
