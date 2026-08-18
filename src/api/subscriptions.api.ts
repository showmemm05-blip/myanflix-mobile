import { apiClient } from "@/api/client";
import type { SubscriptionPlan, SubscriptionStatus } from "@/types/subscription";

export const subscriptionsApi = {
  getPlans() {
    return apiClient.get<SubscriptionPlan[]>("/subscription-plans");
  },

  getStatus() {
    return apiClient.get<SubscriptionStatus>("/subscriptions/me");
  },

  subscribe(planId: string) {
    return apiClient.post<{ id: string; userId: string; planId: string; amount: number; expiresAt: string }>(
      "/subscriptions/subscribe",
      { planId },
    );
  },
};
