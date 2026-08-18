import { paymentAccountsApi } from "@/api/payment-accounts.api";

export const paymentAccountsService = {
  getAccounts() {
    return paymentAccountsApi.getAccounts();
  },

  getTypes() {
    return paymentAccountsApi.getTypes();
  },
};
