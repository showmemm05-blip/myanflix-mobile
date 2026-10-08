import { memo, useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { Button } from "@/components/ui/Button";
import { Surface } from "@/components/ui/Surface";
import { Skeleton } from "@/components/common/Skeleton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { useComments, useLoadMoreReplies, usePostComment } from "@/hooks/useComments";
import { useLanguage } from "@/localization/LanguageProvider";
import { displayNameOf, formatRelativeTime } from "@/utils/format";
import { ApiError } from "@/utils/errors";
import { useScrollIntoView } from "@/hooks/useKeyboardLift";
import { theme } from "@/theme";
import { COMMENT_MAX_LENGTH, type Comment, type CommentTarget } from "@/types/comment";

/**
 * The comment thread under a movie, a series or a book — the mobile counterpart of the
 * website's components/comments/CommentsSection.tsx, same behaviour and the
 * same strings, drawn as Marquee draws it (MovieDetail.dc.html): the heading
 * with its count, a 48pt pill that opens the composer, then flat rows — a
 * 36pt initials disc, the name and time, the comment, and quiet text actions.
 *
 * REPLY-FIRST BY DESIGN, inherited from the web: the only affordance on a
 * comment is "reply", and there are deliberately no reactions — a like button
 * turns a conversation into a scoreboard, and this section exists to hold
 * conversation.
 *
 * Replies are one level deep because the API is: replying to a reply is
 * refused server-side, so a reply row simply has no reply button.
 *
 * A thread read carries the first REPLY_PAGE_SIZE replies of each comment and
 * the full `replyCount`; the rest come a page at a time behind "Show N more
 * replies" and live in `extraReplies` for as long as the section is mounted.
 */
export function CommentsSection(target: CommentTarget) {
  const { t } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  const commentsQuery = useComments(target);
  const loadMore = useLoadMoreReplies();
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [openReplies, setOpenReplies] = useState<Record<string, boolean>>({});
  const [extraReplies, setExtraReplies] = useState<Record<string, Comment[]>>({});
  const [repliesError, setRepliesError] = useState<string | null>(null);

  const comments = useMemo(() => commentsQuery.data ?? [], [commentsQuery.data]);
  const total = useMemo(
    () => comments.reduce((sum, comment) => sum + 1 + comment.replyCount, 0),
    [comments],
  );

  const appendReplies = useCallback(
    (commentId: string, replies: Comment[]) =>
      setExtraReplies((prev) => ({ ...prev, [commentId]: [...(prev[commentId] ?? []), ...replies] })),
    [],
  );

  const loadMoreReplies = async (commentId: string, loaded: number) => {
    setRepliesError(null);
    try {
      const page = await loadMore.mutateAsync({ commentId, loaded });
      appendReplies(commentId, page.items);
    } catch {
      setRepliesError(commentId);
    }
  };

  /**
   * One handler for every row. `replyingTo` lives above the map and the rows
   * are memoized, so a per-row arrow here would re-render every comment in the
   * thread (up to the server's 200, plus replies) to open one reply box.
   */
  const toggleReplyTo = useCallback(
    (id: string) => setReplyingTo((current) => (current === id ? null : id)),
    [],
  );

  const handleReplyPosted = (parentId: string, reply: Comment) => {
    setReplyingTo(null);
    // A thread you just replied to should never sit collapsed under its toggle.
    setOpenReplies((prev) => ({ ...prev, [parentId]: true }));
    // The thread is refetched, but a reply past the preview would not be in
    // it — keep the one just posted on screen whatever page it landed on.
    appendReplies(parentId, [reply]);
  };

  return (
    <View style={styles.section}>
      <SectionHeader
        title={t.comments.heading}
        inset={false}
        style={styles.header}
        accessory={
          commentsQuery.isSuccess ? (
            <ThemedText variant="caption" tabular color={theme.colors.textFaint}>
              {countLabel(total, t.comments.countOne, t.comments.count)}
            </ThemedText>
          ) : undefined
        }
      />

      {isAuthenticated ? (
        /* The display name, because that is what a posted comment renders with
           (`comment.user.displayName ?? username` below) — using the username
           here made your own pending comment disagree with its posted self. */
        <Composer
          target={target}
          avatarUrl={user?.avatarUrl ?? null}
          name={displayNameOf(user) || t.comments.you}
        />
      ) : (
        /* The tab navigator is only mounted while signed in, so in practice a
           visitor never reaches a detail screen — this branch exists so the
           section stays correct if that ever changes, and it deliberately
           offers no "sign in" button: losing the session already drops the app
           back to the auth stack on its own, so a button here would have
           nowhere of its own to go. */
        <Surface tone="sunken" radius="xl" style={styles.signedOut}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.colors.textMuted} />
          <ThemedText variant="caption" style={styles.signedOutText}>
            {t.comments.signedOutPrompt}
          </ThemedText>
        </Surface>
      )}

      {commentsQuery.isLoading ? (
        <View style={styles.thread} accessible accessibilityLabel={t.common.loading}>
          <CommentSkeleton />
          <CommentSkeleton />
        </View>
      ) : commentsQuery.isError ? (
        <EmptyState
          icon="cloud-offline-outline"
          message={t.comments.loadError}
          tone={theme.colors.danger}
          actionLabel={t.common.retry}
          onAction={() => {
            commentsQuery.refetch();
          }}
          fill={false}
          style={styles.state}
        />
      ) : comments.length === 0 ? (
        <EmptyState
          icon="chatbubble-ellipses-outline"
          title={t.comments.emptyTitle}
          message={t.comments.emptyBody}
          fill={false}
          style={styles.state}
        />
      ) : (
        <View style={styles.thread}>
          {comments.map((comment) => {
            const repliesOpen = !!openReplies[comment.id];
            const replies = visibleReplies(comment, extraReplies[comment.id]);
            const remaining = Math.max(0, comment.replyCount - replies.length);
            const loadingMore = loadMore.isPending && loadMore.variables?.commentId === comment.id;
            return (
              <View key={comment.id}>
                <CommentRow
                  comment={comment}
                  onReplyPress={isAuthenticated ? toggleReplyTo : undefined}
                />

                {replyingTo === comment.id && (
                  <ReplyComposer
                    target={target}
                    parentId={comment.id}
                    avatarUrl={user?.avatarUrl ?? null}
                    name={displayNameOf(user) || t.comments.you}
                    onCancel={() => setReplyingTo(null)}
                    onPosted={(reply) => handleReplyPosted(comment.id, reply)}
                  />
                )}

                {comment.replyCount > 0 && (
                  <View style={styles.repliesBlock}>
                    <Pressable
                      onPress={() => setOpenReplies((prev) => ({ ...prev, [comment.id]: !prev[comment.id] }))}
                      style={styles.repliesToggle}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: repliesOpen }}
                      accessibilityLabel={repliesOpen ? t.comments.hideReplies : t.comments.showReplies}
                    >
                      <ThemedText variant="caption" weight="bold" style={styles.repliesToggleText}>
                        {countLabel(comment.replyCount, t.comments.replyCountOne, t.comments.replyCount)}
                      </ThemedText>
                      <Ionicons
                        name={repliesOpen ? "chevron-up" : "chevron-down"}
                        size={14}
                        color={theme.colors.link}
                      />
                    </Pressable>

                    {repliesOpen && (
                      <View style={styles.replies}>
                        {replies.map((reply) => (
                          <CommentRow key={reply.id} comment={reply} compact />
                        ))}
                        {remaining > 0 && (
                          <Pressable
                            onPress={() => loadMoreReplies(comment.id, replies.length)}
                            disabled={loadingMore}
                            style={styles.repliesToggle}
                            hitSlop={10}
                            accessibilityRole="button"
                            accessibilityState={{ disabled: loadingMore, busy: loadingMore }}
                          >
                            <ThemedText variant="caption" weight="bold" style={styles.repliesToggleText}>
                              {loadingMore
                                ? t.comments.loadingReplies
                                : countLabel(remaining, t.comments.moreRepliesOne, t.comments.moreReplies)}
                            </ThemedText>
                          </Pressable>
                        )}
                        {repliesError === comment.id && !loadingMore && (
                          <InlineError message={t.comments.repliesLoadError} />
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

/** Two placeholder rows while the thread loads — Marquee never draws a spinner. */
function CommentSkeleton() {
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Skeleton width={36} height={36} radius="pill" />
      <View style={styles.skeletonBody}>
        <Skeleton width="40%" height={13} radius="xs" />
        <Skeleton width="90%" height={13} radius="xs" />
        <Skeleton width="65%" height={13} radius="xs" />
      </View>
    </View>
  );
}

/** Burmese has no plural form, so the two templates are separate keys, not a suffix rule. */
function countLabel(count: number, one: string, many: string): string {
  return count === 1 ? one : many.replace("{n}", String(count));
}

/**
 * The preview the thread read carried plus the replies loaded (or posted)
 * since, oldest first, each reply once. A refetch can move a reply from a
 * later page into the preview, and a reply you just posted is appended
 * before its page is ever loaded, so ids are deduplicated here rather than
 * at every write.
 */
function visibleReplies(comment: Comment, extra: Comment[] | undefined): Comment[] {
  if (!extra?.length) return comment.replies;
  const seen = new Set<string>();
  const merged: Comment[] = [];
  for (const reply of [...comment.replies, ...extra]) {
    if (seen.has(reply.id)) continue;
    seen.add(reply.id);
    merged.push(reply);
  }
  return merged.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** The server's per-account 429 codes (CommentsService); any other 429 is the IP backstop. */
const RATE_DAY_CODE = "COMMENT_RATE_DAY";

/** The notice a failed post shows: the limit's own line, else the server's rule, else the fallback. */
function postErrorMessage(err: unknown, t: ReturnType<typeof useLanguage>["t"]): string {
  if (!(err instanceof ApiError)) return t.comments.postError;
  if (err.status === 429) {
    return err.code === RATE_DAY_CODE ? t.comments.dailyLimit : t.comments.rateLimited;
  }
  return err.message;
}

/* ------------------------------------------------------------------ */

const CommentAvatar = memo(function CommentAvatar({
  url,
  name,
  size,
}: {
  url: string | null;
  name: string;
  size: number;
}) {
  const dimension = { width: size, height: size, borderRadius: theme.radius.pill };

  if (url) {
    return <Image source={{ uri: url }} style={[styles.avatar, dimension]} contentFit="cover" />;
  }

  return (
    <View style={[styles.avatar, styles.avatarFallback, dimension]}>
      <ThemedText
        variant="caption"
        weight="extrabold"
        color={theme.colors.onAvatar}
        style={size < 32 ? styles.avatarInitialsSmall : undefined}
      >
        {name.slice(0, 2).toUpperCase()}
      </ThemedText>
    </View>
  );
});

/**
 * Memoized: `replyingTo` and `openReplies` live above the map, so a single tap
 * would otherwise re-render every rendered comment to change one. The `comment`
 * objects come straight from the query cache, so their identity is stable
 * between fetches — which is what makes the memo actually hold. Note this is a
 * plain `.map()` inside a View, not a FlatList, so `memo` genuinely applies.
 */
const CommentRow = memo(function CommentRow({
  comment,
  onReplyPress,
  compact = false,
}: {
  comment: Comment;
  /** Takes the id, so the section can hand every row ONE stable handler. */
  onReplyPress?: (commentId: string) => void;
  compact?: boolean;
}) {
  const { t } = useLanguage();
  const authorName = comment.user.displayName ?? comment.user.username;

  return (
    <View style={styles.row}>
      <CommentAvatar url={comment.user.avatarUrl} name={authorName} size={compact ? 30 : 36} />

      <View style={styles.rowBody}>
        <View style={styles.rowMeta}>
          <ThemedText variant="muted" weight="extrabold" numberOfLines={1} style={styles.authorName}>
            {authorName}
          </ThemedText>
          <ThemedText variant="muted" tabular style={styles.timestamp}>
            {`· ${formatRelativeTime(comment.createdAt, t.comments)}`}
          </ThemedText>
        </View>

        <ThemedText variant="muted" style={styles.commentBody}>
          {comment.body}
        </ThemedText>

        {onReplyPress && (
          <Pressable
            onPress={() => onReplyPress(comment.id)}
            style={styles.replyAction}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t.comments.reply}
          >
            <ThemedText variant="caption" weight="bold" style={styles.replyActionText}>
              {t.comments.reply}
            </ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
});

/**
 * Collapsed to a single quiet pill until it is tapped — the invitation to
 * comment shouldn't weigh more than the comments themselves, and an always-open
 * multiline field would push the thread off the first screenful.
 */
function Composer({
  target,
  avatarUrl,
  name,
}: {
  target: CommentTarget;
  avatarUrl: string | null;
  name: string;
}) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <Pressable
        onPress={() => setExpanded(true)}
        style={({ pressed }) => [styles.composerPill, pressed && styles.composerPillPressed]}
        accessibilityRole="button"
        accessibilityLabel={t.comments.placeholder}
      >
        <CommentAvatar url={avatarUrl} name={name} size={28} />
        <ThemedText variant="body" color={theme.colors.textFaint} numberOfLines={1} style={styles.composerPlaceholder}>
          {t.comments.placeholder}
        </ThemedText>
      </Pressable>
    );
  }

  return (
    <View style={styles.composer}>
      <CommentAvatar url={avatarUrl} name={name} size={36} />
      {/* Collapsing unmounts the editor, which is what discards the draft and
          any error notice — the same clearing the old inline `collapse()` did
          by hand. */}
      <CommentEditor
        target={target}
        placeholder={t.comments.placeholder}
        submitLabel={t.comments.post}
        onCancel={() => setExpanded(false)}
        onPosted={() => setExpanded(false)}
      />
    </View>
  );
}

function ReplyComposer({
  target,
  parentId,
  avatarUrl,
  name,
  onCancel,
  onPosted,
}: {
  target: CommentTarget;
  parentId: string;
  avatarUrl: string | null;
  name: string;
  onCancel: () => void;
  onPosted: (reply: Comment) => void;
}) {
  const { t } = useLanguage();

  return (
    <View style={styles.replyComposer}>
      <CommentAvatar url={avatarUrl} name={name} size={30} />
      <CommentEditor
        target={target}
        parentId={parentId}
        placeholder={t.comments.replyPlaceholder}
        submitLabel={t.comments.reply}
        minHeight={72}
        onCancel={onCancel}
        onPosted={onPosted}
      />
    </View>
  );
}

/**
 * The editor both composers wrap: the field, the error notice and the
 * cancel + submit row. Written once so the post path — above all the rule for
 * which message a failure shows — has one home instead of two that drifted.
 *
 * It holds its own mutation instance because it is instantiated per call site:
 * a pending reply then spins only its own button and never the top-level
 * composer's, which is the behaviour the reply path had and must keep.
 */
function CommentEditor({
  target,
  parentId,
  placeholder,
  submitLabel,
  minHeight,
  onCancel,
  onPosted,
}: {
  target: CommentTarget;
  /** Set only by the reply composer; the API refuses a reply to a reply. */
  parentId?: string;
  placeholder: string;
  submitLabel: string;
  minHeight?: number;
  onCancel: () => void;
  /** Receives the comment as the server returned it. */
  onPosted: (comment: Comment) => void;
}) {
  const { t } = useLanguage();
  const mutation = usePostComment(target);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const post = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    setError(null);
    try {
      const posted = await mutation.mutateAsync(parentId ? { body: trimmed, parentId } : { body: trimmed });
      setBody("");
      onPosted(posted);
    } catch (err) {
      // A failed post keeps what was typed — the notice says why, and
      // retrying should not mean writing the comment again. The posting
      // limit (429) has its own translated line; any other server message is
      // preferred when there is one (it names the actual rule that was
      // broken); anything else falls back to the localized line.
      setError(postErrorMessage(err, t));
    }
  };

  return (
    <View style={styles.composerBody}>
      <CommentInput
        value={body}
        onChangeText={setBody}
        placeholder={placeholder}
        accessibilityLabel={placeholder}
        minHeight={minHeight}
      />
      {error ? <InlineError message={error} /> : null}
      <View style={styles.composerActions}>
        <Button title={t.common.cancel} variant="ghost" onPress={onCancel} />
        <Button
          title={mutation.isPending ? t.comments.posting : submitLabel}
          onPress={post}
          loading={mutation.isPending}
          disabled={!body.trim()}
        />
      </View>
    </View>
  );
}

/** The one multiline field both composers use. */
function CommentInput({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  minHeight = 92,
}: {
  value: string;
  onChangeText: (next: string) => void;
  placeholder: string;
  accessibilityLabel: string;
  minHeight?: number;
}) {
  // The composer opens under an ALREADY visible keyboard when a reply is
  // started mid-typing; that focus change fires no keyboard event, so the
  // field asks the screen for itself — a beat later, once the box has laid
  // out. The first open is covered by keyboardDidShow in useKeyboardLift.
  const scrollIntoView = useScrollIntoView();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.textFaint}
      accessibilityLabel={accessibilityLabel}
      multiline
      autoFocus
      onFocus={() => setTimeout(scrollIntoView, 80)}
      // The server rejects anything longer; stopping at the bound is kinder
      // than letting someone write past it and lose the overflow to a 400.
      maxLength={COMMENT_MAX_LENGTH}
      // Android centres multiline text vertically without this, so a
      // one-line draft floats in the middle of the box.
      textAlignVertical="top"
      style={[styles.input, { minHeight }]}
    />
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <View style={styles.errorRow}>
      <Ionicons name="alert-circle" size={15} color={theme.colors.danger} />
      <ThemedText variant="caption" weight="semibold" style={styles.errorText}>
        {message}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: theme.layout.screenPadding, gap: theme.spacing.md },
  /** The section's own gap already spaces the heading from the composer. */
  header: { marginBottom: 0 },

  signedOut: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  signedOutText: { flex: 1 },

  state: { paddingVertical: theme.spacing.lg },
  thread: { gap: 20, marginTop: theme.spacing.xs },
  skeletonBody: { flex: 1, gap: 8, paddingTop: 2 },

  /* ---- one comment ---- */
  row: { flexDirection: "row", gap: 12 },
  rowBody: { flex: 1, minWidth: 0 },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  // `flexShrink: 1` keeps a long display name from pushing the timestamp out
  // of the row instead of ellipsizing itself.
  authorName: { flexShrink: 1, color: theme.colors.text },
  timestamp: { color: theme.colors.textFaint, flexShrink: 0 },
  commentBody: { color: theme.colors.textBody, marginTop: 4 },
  // paddingVertical + hitSlop 10 clear the 44pt minimum without the row
  // itself being 44pt tall, which would put too much air under every comment.
  replyAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingRight: theme.spacing.sm,
  },
  replyActionText: { color: theme.colors.textMuted },

  avatar: { backgroundColor: theme.colors.avatar, overflow: "hidden" },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitialsSmall: { fontSize: 11 },

  /* ---- replies ---- */
  repliesBlock: { paddingLeft: 48 },
  repliesToggle: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingVertical: 8 },
  repliesToggleText: { color: theme.colors.link },
  replies: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
    paddingLeft: theme.spacing.md,
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.border,
  },

  /* ---- composers ---- */
  composer: { flexDirection: "row", gap: theme.spacing.sm + 2 },
  replyComposer: { flexDirection: "row", gap: theme.spacing.sm + 2, marginTop: theme.spacing.sm, paddingLeft: 48 },
  composerBody: { flex: 1, gap: theme.spacing.sm },
  /** MovieDetail.dc.html: a 48pt, radius-24 pill with the avatar inside it. */
  composerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: theme.spacing.xs,
    borderRadius: 24,
    backgroundColor: theme.colors.surfaceElevated,
  },
  composerPillPressed: { opacity: 0.8 },
  composerPlaceholder: { flex: 1 },
  composerActions: { flexDirection: "row", justifyContent: "flex-end", gap: theme.spacing.sm },
  input: {
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 4,
    color: theme.colors.text,
    fontFamily: theme.font.regular,
    fontSize: 15,
    lineHeight: 21,
  },

  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    padding: theme.spacing.sm + 2,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.dangerSoft,
    borderWidth: 1,
    borderColor: theme.colors.danger + "3D",
  },
  errorText: { flex: 1, color: theme.colors.danger },
});
