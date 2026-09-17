import { notificationsApi } from "@/api/notifications.api";
import type { PaginatedResponse, PaginationParams, RequestSignalOptions } from "@/types/api";
import type { AppNotification } from "@/types/notification";

export const notificationsService = {
  async getNotifications(
    pagination: PaginationParams = {},
    options: RequestSignalOptions = {},
  ): Promise<PaginatedResponse<AppNotification>> {
    return notificationsApi.getNotifications(pagination, options);
  },

  async getUnreadCount(options: RequestSignalOptions = {}): Promise<number> {
    const { unreadCount } = await notificationsApi.getUnreadCount(options);
    return unreadCount;
  },

  async markAsRead(id: string): Promise<void> {
    await notificationsApi.markAsRead(id);
  },

  async markAllAsRead(): Promise<void> {
    await notificationsApi.markAllAsRead();
  },
};
