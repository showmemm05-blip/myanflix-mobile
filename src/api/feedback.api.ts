import { apiClient } from "@/api/client";
import type { Feedback, FeedbackCategory } from "@/types/feedback";

export const feedbackApi = {
  /**
   * Rate-limited server-side to a handful of submissions per account per hour;
   * over the limit the request fails with 429 and a message the sheet turns
   * into its own localized notice.
   */
  submitFeedback(category: FeedbackCategory, message: string) {
    return apiClient.post<Feedback>("/feedback", { category, message });
  },
};
