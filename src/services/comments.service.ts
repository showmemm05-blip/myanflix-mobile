import { commentsApi, type CreateCommentInput } from "@/api/comments.api";
import type { CommentTarget } from "@/types/comment";

export const commentsService = {
  getComments(target: CommentTarget) {
    return commentsApi.getComments(target);
  },

  postComment(target: CommentTarget, input: CreateCommentInput) {
    // Trimming here as well as on the server keeps a body of nothing but
    // whitespace from ever leaving the device as a doomed request.
    return commentsApi.createComment(target, { ...input, body: input.body.trim() });
  },
};
