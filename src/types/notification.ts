export type NotificationType =
  | "PURCHASE"
  | "SUBSCRIPTION"
  | "PAYMENT"
  | "NEW_RELEASE"
  | "PROMOTION"
  | "ANNOUNCEMENT"
  | "DEPOSIT_APPROVED"
  | "DEPOSIT_REJECTED"
  | "WITHDRAWAL_APPROVED"
  | "WITHDRAWAL_REJECTED"
  | "BALANCE_ADJUSTED";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}
