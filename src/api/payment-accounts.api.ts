import { apiClient } from "@/api/client";
import type { PaymentAccount, PaymentAccountType } from "@/types/payment-account";

export const paymentAccountsApi = {
  getAccounts() {
    return apiClient.get<PaymentAccount[]>("/payment-accounts");
  },

  getTypes() {
    return apiClient.get<PaymentAccountType[]>("/payment-accounts/types");
  },
};
