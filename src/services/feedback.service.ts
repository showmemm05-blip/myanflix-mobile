import { feedbackApi } from "@/api/feedback.api";
import type { FeedbackCategory } from "@/types/feedback";

export const feedbackService = {
  submitFeedback(category: FeedbackCategory, message: string) {
    return feedbackApi.submitFeedback(category, message.trim());
  },
};
