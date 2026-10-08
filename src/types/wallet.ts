export interface Wallet {
  id: string;
  balance: number;
}

/**
 * Ledger vocabulary — the backend's enums, shared by the rows and the screens.
 *
 * They live here rather than in `api/wallet.api.ts` for the same reason every
 * other domain's do: a component reads its types from `types/`, never from the
 * api layer, so the wire module stays the one place a field rename has to be
 * absorbed. Wallet was the single exception to that rule.
 */
export type TransactionType =
  | "PURCHASE"
  | "DEPOSIT"
  | "REFUND"
  | "SUBSCRIPTION"
  | "WITHDRAWAL"
  | "ADJUSTMENT_CREDIT"
  | "ADJUSTMENT_DEBIT";
export type TransactionStatus = "COMPLETED" | "PENDING" | "FAILED";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  movieId: string | null;
  /**
   * The purchased title, joined in by the wallet service for rows that carry
   * a movieId (null otherwise). Optional because it is a read-only extra the
   * row does not depend on: a purchase without it still reads as "Purchase".
   */
  movieTitle?: string | null;
  createdAt: string;
}
