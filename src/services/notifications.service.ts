import { notificationsApi } from "@/api/notifications.api";
import type { PaginatedResponse, PaginationParams } from "@/types/api";
import type { AppNotification } from "@/types/notification";

export const notificationsService = {
  async getNotifications(pagination: PaginationParams = {}): Promise<PaginatedResponse<AppNotification>> {
    return notificationsApi.getNotifications(pagination);
  },

  async getUnreadCount(): Promise<number> {
    const { unreadCount } = await notificationsApi.getUnreadCount();
    return unreadCount;
  },

  async markAsRead(id: string): Promise<void> {
    await notificationsApi.markAsRead(id);
  },

  async markAllAsRead(): Promise<void> {
    await notificationsApi.markAllAsRead();
  },
};
