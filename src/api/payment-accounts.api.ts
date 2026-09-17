import { apiClient } from "@/api/client";
import type { RequestSignalOptions } from "@/types/api";
import type { PaymentAccount, PaymentAccountType } from "@/types/payment-account";

export const paymentAccountsApi = {
  getAccounts(options: RequestSignalOptions = {}) {
    return apiClient.get<PaymentAccount[]>("/payment-accounts", options);
  },

  getTypes(options: RequestSignalOptions = {}) {
    return apiClient.get<PaymentAccountType[]>("/payment-accounts/types", options);
  },
};
