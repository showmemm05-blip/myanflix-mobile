import { apiClient } from "@/api/client";
import type { RequestSignalOptions } from "@/types/api";
import { REPLY_PAGE_SIZE, type Comment, type CommentTarget, type ReplyPage } from "@/types/comment";

export interface CreateCommentInput {
  body: string;
  /** Omitted for a top-level comment; the parent's id for a reply. */
  parentId?: string;
}

export const commentsApi = {
  /**
   * A title's visible thread (movie, series or book). Public — reading works
   * without a token, so the section renders for a signed-out visitor too.
   *
   * One read: the server caps it and returns the top-level comments with
   * their first REPLY_PAGE_SIZE replies nested, which is what the section
   * draws; the replies past that come a page at a time from getReplies.
   */
  getComments(target: CommentTarget, options: RequestSignalOptions = {}) {
    return apiClient.get<Comment[]>("/comments", { params: target, ...options });
  },

  /** One page of a comment's replies beyond the preview, oldest first. Public too. */
  getReplies(commentId: string, page: number) {
    return apiClient.get<ReplyPage>(`/comments/${commentId}/replies`, {
      params: { page, limit: REPLY_PAGE_SIZE },
    });
  },

  createComment(target: CommentTarget, input: CreateCommentInput) {
    return apiClient.post<Comment>("/comments", { ...target, ...input });
  },
};
