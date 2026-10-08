import { useCallback, useMemo } from "react";
import { useDeposits } from "@/hooks/useDeposits";
import { useWithdrawals } from "@/hooks/useWithdrawals";
import { sumAmounts } from "@/utils/walletFilters";
import type { Deposit } from "@/types/deposit";

/** The server's page-size cap: the most rows one request can sum over. */
const PENDING_PAGE = 100;

export interface PendingRequests {
  /**
   * Money held by pending withdrawals (C-4: it already left the balance at
   * request time). Information only — NEVER add it to or subtract it from the
   * balance. Null unless every pending row is loaded, so it is never partial.
   */
  heldAmount: number | null;
  /** Pending deposits, newest first. They are not in the wallet ledger until approved. */
  pendingDepositRows: Deposit[];
  refetchAll: () => Promise<unknown>;
}

/**
 * The user's pending deposits and withdrawals, filtered by status on the
 * server: the balance card's "on hold" line and the activity list's
 * "Awaiting approval" group. Keys sit under ["deposits","mine",…] /
 * ["withdrawals","mine",…], so the create mutations and the wallet socket's
 * deposit.updated / withdrawal.updated prefix invalidations refresh them too.
 */
export function usePendingRequests(): PendingRequests {
  const pendingDeposits = useDeposits({ status: "PENDING", limit: PENDING_PAGE });
  const pendingWithdrawals = useWithdrawals({ status: "PENDING", limit: PENDING_PAGE });

  const pd = pendingDeposits.data;
  const pw = pendingWithdrawals.data;
  const { refetch: refetchPd } = pendingDeposits;
  const { refetch: refetchPw } = pendingWithdrawals;
  const refetchAll = useCallback(() => Promise.all([refetchPd(), refetchPw()]), [refetchPd, refetchPw]);

  const derived = useMemo(
    () => ({
      heldAmount: pw && pw.total <= pw.items.length ? sumAmounts(pw.items) : null,
      pendingDepositRows: pd?.items ?? [],
    }),
    [pd, pw],
  );

  return { ...derived, refetchAll };
}
