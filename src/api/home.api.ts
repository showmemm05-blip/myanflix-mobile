import { apiClient } from "@/api/client";
import type { RequestSignalOptions } from "@/types/api";
import type { HomeShowcase } from "@/types/home";

export const homeApi = {
  /** Guest OK (@OptionalAuth). An expired token 401s, so the client refreshes and asks again. */
  getShowcase(options: RequestSignalOptions = {}) {
    return apiClient.get<HomeShowcase>("/home/showcase", options);
  },
};
