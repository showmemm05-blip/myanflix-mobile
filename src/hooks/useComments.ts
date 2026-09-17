import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { commentsService } from "@/services/comments.service";
import type { CommentTarget } from "@/types/comment";

/**
 * One key per title, spelled out with all three ids so a movie, a series and
 * a book can never collide in the cache and so posting a comment invalidates
 * exactly the thread it belongs to.
 */
function commentsKey(target: CommentTarget) {
  return [
    "comments",
    { movieId: target.movieId ?? null, seriesId: target.seriesId ?? null, bookId: target.bookId ?? null },
  ] as const;
}

export function useComments(target: CommentTarget) {
  return useQuery({
    queryKey: commentsKey(target),
    // The thread is unpaginated (see commentsApi.getComments), so this is the
    // other response worth cancelling: opening a title and going straight back
    // used to leave the whole comment list downloading.
    queryFn: ({ signal }) => commentsService.getComments(target, { signal }),
  });
}

export interface PostCommentInput {
  body: string;
  /** Present only when replying — one level deep, enforced server-side. */
  parentId?: string;
}

export function usePostComment(target: CommentTarget) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PostCommentInput) => commentsService.postComment(target, input),
    // Refetch rather than splice the new comment in: the server owns the
    // timestamp, the id and the author shape, so the thread that comes back
    // is the truth and an optimistic copy could only disagree with it.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsKey(target) });
    },
  });
}
