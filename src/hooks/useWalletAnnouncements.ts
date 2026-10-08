import { useEffect, useRef } from "react";
import { AccessibilityInfo, Platform } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { ledgerStatusLabel, ledgerTypeLabel } from "@/components/wallet/TransactionRow";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatKyat } from "@/utils/currency";
import type { Deposit } from "@/types/deposit";
import type { Transaction } from "@/types/wallet";
import type { Withdrawal } from "@/types/withdrawal";

/** At most one spoken update per this window, so a burst of socket events is not a monologue. */
const THROTTLE_MS = 1500;

interface Args {
  /** The balance, on the screen that shows it; omitted elsewhere (no balance news). */
  balance?: number;
  /** The user hid their balance: nothing spoken may contain an amount. */
  hidden: boolean;
  deposits?: readonly Deposit[];
  withdrawals?: readonly Withdrawal[];
  /** Wallet ledger rows (History's "All" list). */
  ledger?: readonly Transaction[];
}

interface Tracked {
  key: string;
  status: string;
  /** The spoken news for this row's new status, or null when there is none to give. */
  describe: () => string | null;
}

/**
 * Screen-reader news for the wallet screens. The realtime socket changes them
 * silently (there is no toast system on mobile), so:
 *  - a balance change after the first value is spoken on iOS — Android
 *    already speaks it through the hero's polite live region — and never
 *    while the balance is hidden;
 *  - a deposit, withdrawal or ledger row moving out of Pending (to Approved,
 *    Rejected, Completed, Refunded …) is spoken on both platforms, with its
 *    amount unless the balance is hidden.
 * Only while the screen is focused; changes seen while away are recorded,
 * not replayed later. A row seen for the first time (a first load, a new
 * page) is never news.
 */
export function useWalletAnnouncements({ balance, hidden, deposits, withdrawals, ledger }: Args) {
  const { t } = useLanguage();
  const isFocused = useIsFocused();
  const lastSpoken = useRef(0);
  const previousBalance = useRef<number | undefined>(undefined);
  const statuses = useRef(new Map<string, string>());

  useEffect(() => {
    const before = previousBalance.current;
    previousBalance.current = balance;
    if (balance === undefined || before === undefined || before === balance) return;
    if (!isFocused || hidden || Platform.OS !== "ios") return;
    const now = Date.now();
    if (now - lastSpoken.current < THROTTLE_MS) return;
    lastSpoken.current = now;
    AccessibilityInfo.announceForAccessibility(t.wallet.balanceUpdated.replace("{amount}", formatKyat(balance)));
    // Only the balance value may trigger this; focus and language changes must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balance]);

  useEffect(() => {
    const seen = statuses.current;
    const news = (what: string, amount: number, statusLabel: string) =>
      hidden ? `${what}: ${statusLabel}` : `${what}, ${formatKyat(amount)}: ${statusLabel}`;
    const rows: Tracked[] = [
      ...(deposits ?? []).map((row) => ({
        key: `deposit:${row.id}`,
        status: row.status,
        describe: () => {
          const label = t.wallet.depositStatus[row.status.toLowerCase() as Lowercase<Deposit["status"]>];
          return label ? news(t.wallet.transactionTypes.deposit, row.amount, label) : null;
        },
      })),
      ...(withdrawals ?? []).map((row) => ({
        key: `withdrawal:${row.id}`,
        status: row.status,
        describe: () => {
          const label = t.wallet.withdrawStatus[row.status.toLowerCase() as Lowercase<Withdrawal["status"]>];
          return label ? news(t.wallet.transactionTypes.withdrawal, row.amount, label) : null;
        },
      })),
      ...(ledger ?? []).map((row) => ({
        key: `ledger:${row.id}`,
        status: row.status,
        describe: () => {
          const label = ledgerStatusLabel(row, t);
          return label ? news(ledgerTypeLabel(row.type, t), row.amount, label) : null;
        },
      })),
    ];
    let message: string | null = null;
    for (const { key, status, describe } of rows) {
      const before = seen.get(key);
      seen.set(key, status);
      if (message || before !== "PENDING" || status === "PENDING") continue;
      message = describe();
    }
    if (!message || !isFocused) return;
    const now = Date.now();
    if (now - lastSpoken.current < THROTTLE_MS) return;
    lastSpoken.current = now;
    AccessibilityInfo.announceForAccessibility(message);
    // Only new rows may trigger this; focus, language and hide changes must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deposits, withdrawals, ledger]);
}
