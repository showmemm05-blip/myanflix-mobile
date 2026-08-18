import { apiClient } from "@/api/client";
import type { PaginatedResponse, PaginationParams } from "@/types/api";
import type { AppNotification } from "@/types/notification";

export const notificationsApi = {
  getNotifications(pagination: PaginationParams = {}) {
    return apiClient.get<PaginatedResponse<AppNotification>>("/notifications", { params: pagination });
  },

  getUnreadCount() {
    return apiClient.get<{ unreadCount: number }>("/notifications/unread-count");
  },

  markAsRead(id: string) {
    return apiClient.patch<AppNotification>(`/notifications/${id}/read`);
  },

  markAllAsRead() {
    return apiClient.patch<void>("/notifications/read-all");
  },
};
