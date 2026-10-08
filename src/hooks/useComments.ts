import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { commentsService } from "@/services/comments.service";
import { REPLY_PAGE_SIZE, type CommentTarget } from "@/types/comment";

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
    // One read brings the whole first page of the thread (see
    // commentsApi.getComments), so this is the other response worth
    // cancelling: opening a title and going straight back used to leave the
    // whole comment list downloading.
    queryFn: ({ signal }) => commentsService.getComments(target, { signal }),
  });
}

export interface PostCommentInput {
  body: string;
  /** Present only when replying — one level deep, enforced server-side. */
  parentId?: string;
}

/**
 * The next page of one comment's replies. Pages are REPLY_PAGE_SIZE long and
 * the preview a thread read carries is page 1, so the page to fetch is
 * whichever one the replies already on screen stop in. The section keeps the
 * pages itself (they belong to the open thread, not to the cache).
 */
export function useLoadMoreReplies() {
  return useMutation({
    mutationFn: ({ commentId, loaded }: { commentId: string; loaded: number }) =>
      commentsService.getReplies(commentId, Math.floor(loaded / REPLY_PAGE_SIZE) + 1),
  });
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
