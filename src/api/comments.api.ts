import { apiClient } from "@/api/client";
import type { Comment, CommentTarget } from "@/types/comment";

export interface CreateCommentInput {
  body: string;
  /** Omitted for a top-level comment; the parent's id for a reply. */
  parentId?: string;
}

export const commentsApi = {
  /**
   * A title's visible thread. Public — reading works without a token, so the
   * section renders for a signed-out visitor too.
   *
   * Deliberately not paginated: the server caps one read and returns every
   * top-level comment with its replies nested, which is exactly what the
   * section draws.
   */
  getComments(target: CommentTarget) {
    return apiClient.get<Comment[]>("/comments", { params: target });
  },

  createComment(target: CommentTarget, input: CreateCommentInput) {
    return apiClient.post<Comment>("/comments", { ...target, ...input });
  },
};
