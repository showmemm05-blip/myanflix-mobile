import { apiClient } from "@/api/client";
import type { PaginatedResponse, PaginationParams } from "@/types/api";
import type { StreamInfo, WatchHistoryEntry } from "@/types/video";

export const videosApi = {
  getStreamInfo(movieId: string) {
    return apiClient.get<StreamInfo>(`/videos/${movieId}/stream`);
  },

  getMyWatchHistory(pagination: PaginationParams = {}) {
    return apiClient.get<PaginatedResponse<WatchHistoryEntry>>("/videos/me/watch-history", {
      params: pagination,
    });
  },

  updateWatchProgress(movieId: string, progress: number, lastPosition: number) {
    return apiClient.patch<WatchHistoryEntry>(`/videos/${movieId}/watch-progress`, {
      progress,
      lastPosition,
    });
  },
};
