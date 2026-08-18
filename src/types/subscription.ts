export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionStatus {
  isActive: boolean;
  expiresAt: string | null;
  planName: string | null;
}
