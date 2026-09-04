export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  /** Length of one purchase in days; renewals stack this onto the current expiry. */
  durationDays: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionStatus {
  isActive: boolean;
  expiresAt: string | null;
  planId: string | null;
  planName: string | null;
  /** Days of the active plan; null when there is no active subscription. */
  durationDays: number | null;
}
