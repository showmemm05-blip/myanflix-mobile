import type { Deposit } from "@/types/deposit";
import type { Transaction, TransactionStatus, TransactionType } from "@/types/wallet";
import type { Withdrawal } from "@/types/withdrawal";

/**
 * Client-side filtering for the wallet History. Pure functions, no React.
 *
 * Why client-side at all: `GET /wallet/transactions` accepts page/limit ONLY
 * (an extra param is a 400), so type, status, date and search over the ledger
 * can only be applied to the pages already loaded — the screen says so in its
 * summary line. The deposit/withdrawal lists filter status and date on the
 * server; only their search runs here (the server's search is admin-only).
 */

export type LedgerTypeGroup = "all" | "deposit" | "withdrawal" | "purchase" | "subscription" | "refund" | "adjustment";

const LEDGER_TYPE_GROUPS: Record<Exclude<LedgerTypeGroup, "all">, readonly TransactionType[]> = {
  deposit: ["DEPOSIT"],
  withdrawal: ["WITHDRAWAL"],
  purchase: ["PURCHASE"],
  subscription: ["SUBSCRIPTION"],
  refund: ["REFUND"],
  adjustment: ["ADJUSTMENT_CREDIT", "ADJUSTMENT_DEBIT"],
};

export type LedgerStatusFilter = "all" | "completed" | "pending" | "failedRefunded";

/** "Failed or refunded" is one bucket: a rejected withdrawal's hold is FAILED and reads as Refunded. */
const LEDGER_STATUS: Record<Exclude<LedgerStatusFilter, "all">, TransactionStatus> = {
  completed: "COMPLETED",
  pending: "PENDING",
  failedRefunded: "FAILED",
};

interface LedgerFilter {
  typeGroup: LedgerTypeGroup;
  status: LedgerStatusFilter;
  /** Rows created before this instant are excluded; null = any date. */
  sinceMs: number | null;
  q: string;
}

/**
 * One search box over text and money: any query holding a digit is also tried
 * against the amount's digits, so "10,000", "10000" and "10 000" all find a
 * 10,000 Ks row; the text fields match case-insensitively anywhere.
 */
function matchesQuery(q: string, texts: readonly (string | null | undefined)[], amount: number): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  if (/\d/.test(needle)) {
    const digits = needle.replace(/\D/g, "");
    if (String(Math.round(Number(amount))).includes(digits)) return true;
  }
  return texts.some((text) => !!text && text.toLowerCase().includes(needle));
}

/** `typeLabel` is the translated type name, so "purchase" / "ဝယ်ယူမှု" both find purchases. */
export function matchesLedger(tx: Transaction, filter: LedgerFilter, typeLabel: string): boolean {
  if (filter.typeGroup !== "all" && !LEDGER_TYPE_GROUPS[filter.typeGroup].includes(tx.type)) return false;
  // "All" keeps statuses this build does not know yet.
  if (filter.status !== "all" && tx.status !== LEDGER_STATUS[filter.status]) return false;
  if (filter.sinceMs !== null && !(Date.parse(tx.createdAt) >= filter.sinceMs)) return false;
  return matchesQuery(filter.q, [typeLabel, tx.movieTitle], tx.amount);
}

export function matchesDeposit(deposit: Deposit, q: string): boolean {
  return matchesQuery(q, [deposit.reference, deposit.paymentMethod, deposit.accountName], deposit.amount);
}

export function matchesWithdrawal(withdrawal: Withdrawal, q: string): boolean {
  return matchesQuery(
    q,
    [withdrawal.accountType, withdrawal.accountName, withdrawal.accountNumber, withdrawal.bankName],
    withdrawal.amount,
  );
}

/**
 * Sum of `amount` over rows. Number() on every value: money can arrive as a
 * serialised Decimal string, and `+` on a string concatenates.
 */
export function sumAmounts(rows: readonly { amount: number }[]): number {
  return rows.reduce((total, row) => {
    const value = Number(row.amount);
    return Number.isFinite(value) ? total + value : total;
  }, 0);
}
