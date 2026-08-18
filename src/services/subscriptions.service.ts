import { subscriptionsApi } from "@/api/subscriptions.api";
import type { SubscriptionPlan, SubscriptionStatus } from "@/types/subscription";

export const subscriptionsService = {
  async getPlans(): Promise<SubscriptionPlan[]> {
    return subscriptionsApi.getPlans();
  },

  async getStatus(): Promise<SubscriptionStatus> {
    return subscriptionsApi.getStatus();
  },

  async subscribe(planId: string) {
    return subscriptionsApi.subscribe(planId);
  },
};
