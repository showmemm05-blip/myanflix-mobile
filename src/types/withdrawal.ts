export type WithdrawalStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface Withdrawal {
  id: string;
  amount: number;
  accountType: string;
  accountName: string;
  accountNumber: string;
  /** Only captured for bank-transfer account types — a snapshot of this request, not the profile. */
  bankName: string | null;
  status: WithdrawalStatus;
  rejectionReason: string | null;
  approvedAt: string | null;
  createdAt: string;
}
