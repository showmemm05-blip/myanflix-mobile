import { useQuery } from "@tanstack/react-query";
import { paymentAccountsService } from "@/services/payment-accounts.service";

export function usePaymentAccounts() {
  return useQuery({
    queryKey: ["payment-accounts"],
    queryFn: () => paymentAccountsService.getAccounts(),
  });
}

export function usePaymentAccountTypes() {
  return useQuery({
    queryKey: ["payment-accounts", "types"],
    queryFn: () => paymentAccountsService.getTypes(),
  });
}
