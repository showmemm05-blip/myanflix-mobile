import { useQuery } from "@tanstack/react-query";
import { paymentAccountsService } from "@/services/payment-accounts.service";

/**
 * The business accounts a depositor may pay into. `staleTime: 0`, against
 * the app-wide 30 s: the deposit sheet refetches this on every open (see
 * DepositSheet), so an account the admin deactivated a moment ago is never
 * offered from cache. The realtime `payment-accounts.changed` event covers
 * the sheet while it is open.
 */
export function usePaymentAccounts() {
  return useQuery({
    queryKey: ["payment-accounts"],
    queryFn: ({ signal }) => paymentAccountsService.getAccounts({ signal }),
    staleTime: 0,
  });
}

export function usePaymentAccountTypes() {
  return useQuery({
    queryKey: ["payment-accounts", "types"],
    queryFn: ({ signal }) => paymentAccountsService.getTypes({ signal }),
  });
}
