import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { notificationsService } from "@/services/notifications.service";
import { nextPageParam } from "@/hooks/pagination";
import type { PaginatedResponse, PaginationParams } from "@/types/api";
import type { AppNotification } from "@/types/notification";

export function useNotifications(pagination: PaginationParams = {}) {
  return useQuery({
    queryKey: ["notifications", pagination],
    queryFn: ({ signal }) => notificationsService.getNotifications(pagination, { signal }),
  });
}

/**
 * The Notifications screen's endless scroll. Under the same `["notifications"]`
 * prefix as the single-page hook, so mark-all-read's prefix invalidation and
 * mark-read's prefix patch (below) reach the paged list too — a key of its own
 * would have left the feed showing unread rows the server had already cleared.
 */
export function useNotificationsInfinite(pagination: PaginationParams = {}) {
  return useInfiniteQuery({
    queryKey: ["notifications", "infinite", pagination],
    queryFn: ({ pageParam, signal }) =>
      notificationsService.getNotifications({ ...pagination, page: pageParam }, { signal }),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
    // Mark-all-read invalidates and refetches every loaded page; the rows stay
    // on screen while that happens instead of collapsing to skeletons.
    placeholderData: keepPreviousData,
  });
}

/**
 * The two shapes a `["notifications", …]` entry can hold — one page (the
 * single-page hook, and the badge's number which the guards below skip) or
 * React Query's `{pages, pageParams}` envelope from the infinite hook. Named
 * so the mark-read patch can tell them apart without a cast at the call site.
 */
type NotificationsCacheEntry = PaginatedResponse<AppNotification> | InfiniteData<PaginatedResponse<AppNotification>>;

const markPageRead = (page: PaginatedResponse<AppNotification>, id: string) => ({
  ...page,
  items: page.items.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
});

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: ({ signal }) => notificationsService.getUnreadCount({ signal }),
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsService.markAsRead(id),
    /**
     * The id says everything the server's answer says: THIS row is read, and
     * the badge is one lower. Writing both beats sweeping the ["notifications"]
     * prefix, which re-pulled a 50-row list plus the count for every single tap
     * — 20 requests to clear a backlog of ten, and a list that flashed while
     * they came back.
     *
     * The updater runs over every ["notifications", …] entry including the
     * badge count — a plain number, and the FIRST entry in the cache because
     * AppTopBar mounts it before this screen opens. The `typeof` guard must
     * come before the `in` checks: `"pages" in 5` throws a TypeError, and
     * setQueriesData would stop there — the row would stay unread on screen,
     * the decrement below would never run, and the mutation would land in
     * error state though the server had already marked it. The count is a
     * no-op here; the `setQueryData` below handles it. The infinite entry is
     * the `{pages}` envelope, so the patch is applied page by page — the same
     * optimistic write, over `pages` instead of `items`.
     */
    onSuccess: (_data, id) => {
      queryClient.setQueriesData<NotificationsCacheEntry>({ queryKey: ["notifications"], exact: false }, (prev) => {
        if (!prev || typeof prev !== "object") return prev;
        if ("pages" in prev && Array.isArray(prev.pages)) {
          return { ...prev, pages: prev.pages.map((page) => markPageRead(page, id)) };
        }
        if ("items" in prev && Array.isArray(prev.items)) return markPageRead(prev, id);
        return prev;
      });
      queryClient.setQueryData<number>(["notifications", "unread-count"], (n) =>
        typeof n === "number" ? Math.max(0, n - 1) : n,
      );
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsService.markAllAsRead(),
    // Keeps its invalidation on purpose: a bulk change is exactly the case
    // where refetching is cheaper than reconstructing, and it happens once.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
