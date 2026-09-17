import { subscriptionsApi } from "@/api/subscriptions.api";
import type { RequestSignalOptions } from "@/types/api";
import type { SubscriptionPlan, SubscriptionStatus } from "@/types/subscription";

export const subscriptionsService = {
  async getPlans(options: RequestSignalOptions = {}): Promise<SubscriptionPlan[]> {
    return subscriptionsApi.getPlans(options);
  },

  async getStatus(options: RequestSignalOptions = {}): Promise<SubscriptionStatus> {
    return subscriptionsApi.getStatus(options);
  },

  async subscribe(planId: string) {
    return subscriptionsApi.subscribe(planId);
  },
};
