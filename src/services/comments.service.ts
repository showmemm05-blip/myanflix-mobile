import { commentsApi, type CreateCommentInput } from "@/api/comments.api";
import type { RequestSignalOptions } from "@/types/api";
import type { CommentTarget } from "@/types/comment";

export const commentsService = {
  getComments(target: CommentTarget, options: RequestSignalOptions = {}) {
    return commentsApi.getComments(target, options);
  },

  postComment(target: CommentTarget, input: CreateCommentInput) {
    // Trimming here as well as on the server keeps a body of nothing but
    // whitespace from ever leaving the device as a doomed request.
    return commentsApi.createComment(target, { ...input, body: input.body.trim() });
  },
};
