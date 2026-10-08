/** Comment author as the public thread exposes it — never a phone, never an IP. */
export interface CommentAuthor {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

/**
 * One comment in a title's thread.
 *
 * Replies are exactly one level deep — the server refuses a reply to a reply
 * and re-parents nothing, so `replies` on a reply is always empty. Newest
 * top-level comment first; replies oldest-first inside their thread.
 */
export interface Comment {
  id: string;
  body: string;
  createdAt: string;
  user: CommentAuthor;
  /** For a top-level comment: its first REPLY_PAGE_SIZE replies, oldest first. */
  replies: Comment[];
  /** Every visible reply, whether or not it is in `replies`. */
  replyCount: number;
  /** `replyCount > replies.length` — `commentsApi.getReplies` has a page to load. */
  hasMoreReplies: boolean;
}

/** One page of a comment's replies as `GET /comments/:id/replies` returns it. */
export interface ReplyPage {
  items: Comment[];
  total: number;
  page: number;
  limit: number;
}

/**
 * How many replies a thread read carries under each comment, and the size of
 * every further page — the server's REPLY_PREVIEW_LIMIT, so page 2 starts
 * exactly where the preview stopped.
 */
export const REPLY_PAGE_SIZE = 20;

/**
 * Which title a thread belongs to — exactly one id of the three. Modelled as
 * a union rather than three optional fields because the API rejects a request
 * carrying more than one — this way that rule is a compile error here instead
 * of a 400 at runtime.
 */
export type CommentTarget =
  | { movieId: string; seriesId?: undefined; bookId?: undefined }
  | { seriesId: string; movieId?: undefined; bookId?: undefined }
  | { bookId: string; movieId?: undefined; seriesId?: undefined };

/** Same bound the server enforces — the composer stops typing at it. */
export const COMMENT_MAX_LENGTH = 1000;
