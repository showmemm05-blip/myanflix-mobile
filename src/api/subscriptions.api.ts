import { apiClient } from "@/api/client";
import type { RequestSignalOptions } from "@/types/api";
import type { SubscriptionPlan, SubscriptionStatus } from "@/types/subscription";

export const subscriptionsApi = {
  getPlans(options: RequestSignalOptions = {}) {
    return apiClient.get<SubscriptionPlan[]>("/subscription-plans", options);
  },

  getStatus(options: RequestSignalOptions = {}) {
    return apiClient.get<SubscriptionStatus>("/subscriptions/me", options);
  },

  subscribe(planId: string) {
    return apiClient.post<{ id: string; userId: string; planId: string; amount: number; expiresAt: string }>(
      "/subscriptions/subscribe",
      { planId },
    );
  },
};
