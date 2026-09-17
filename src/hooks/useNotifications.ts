import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsService } from "@/services/notifications.service";
import type { PaginatedResponse, PaginationParams } from "@/types/api";
import type { AppNotification } from "@/types/notification";

export function useNotifications(pagination: PaginationParams = {}) {
  return useQuery({
    queryKey: ["notifications", pagination],
    queryFn: ({ signal }) => notificationsService.getNotifications(pagination, { signal }),
  });
}

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
     * count, hence the `Array.isArray(prev.items)` guard: on the count entry it
     * is a no-op and the `setQueryData` below handles it instead.
     */
    onSuccess: (_data, id) => {
      queryClient.setQueriesData<PaginatedResponse<AppNotification>>(
        { queryKey: ["notifications"], exact: false },
        (prev) =>
          prev && Array.isArray(prev.items)
            ? { ...prev, items: prev.items.map((n) => (n.id === id ? { ...n, isRead: true } : n)) }
            : prev,
      );
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
