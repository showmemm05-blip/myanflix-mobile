import { useMutation } from "@tanstack/react-query";
import { feedbackService } from "@/services/feedback.service";
import type { FeedbackCategory } from "@/types/feedback";

/**
 * Nothing to invalidate — the app never lists a user's own submissions, so a
 * successful send has no cached view to refresh.
 */
export function useSubmitFeedback() {
  return useMutation({
    mutationFn: ({ category, message }: { category: FeedbackCategory; message: string }) =>
      feedbackService.submitFeedback(category, message),
  });
}
