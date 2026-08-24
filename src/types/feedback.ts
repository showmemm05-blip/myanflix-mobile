/**
 * Mirrors the backend `FeedbackCategory` enum. Declared as a const tuple so
 * the picker can iterate it and the union stays derived from that one list —
 * adding a category is a single edit here plus its two labels.
 */
export const FEEDBACK_CATEGORIES = ["BUG", "SUGGESTION", "CONTENT", "PAYMENT", "OTHER"] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

/** Mirrors the backend `FeedbackStatus` enum — set by staff, read-only here. */
export type FeedbackStatus = "NEW" | "IN_REVIEW" | "RESOLVED" | "DISMISSED";

/** What POST /feedback returns. `adminNote` is deliberately never sent to the author. */
export interface Feedback {
  id: string;
  category: FeedbackCategory;
  message: string;
  status: FeedbackStatus;
  createdAt: string;
}

/** Same bounds the server enforces, so the form can validate before the round trip. */
export const FEEDBACK_MESSAGE_MIN = 5;
export const FEEDBACK_MESSAGE_MAX = 2000;
