import { apiClient } from "@/api/client";
import type { PaginatedResponse, PaginationParams, RequestSignalOptions } from "@/types/api";
import type { AppNotification } from "@/types/notification";

export const notificationsApi = {
  getNotifications(pagination: PaginationParams = {}, options: RequestSignalOptions = {}) {
    return apiClient.get<PaginatedResponse<AppNotification>>("/notifications", {
      params: pagination,
      ...options,
    });
  },

  getUnreadCount(options: RequestSignalOptions = {}) {
    return apiClient.get<{ unreadCount: number }>("/notifications/unread-count", options);
  },

  markAsRead(id: string) {
    return apiClient.patch<AppNotification>(`/notifications/${id}/read`);
  },

  markAllAsRead() {
    return apiClient.patch<void>("/notifications/read-all");
  },
};
