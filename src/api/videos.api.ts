import { apiClient } from "@/api/client";
import type { PaginatedResponse, PaginationParams, RequestSignalOptions } from "@/types/api";
import type { StreamInfo, WatchHistoryEntry } from "@/types/video";

export const videosApi = {
  getStreamInfo(movieId: string, options: RequestSignalOptions = {}) {
    return apiClient.get<StreamInfo>(`/videos/${movieId}/stream`, options);
  },

  getMyWatchHistory(pagination: PaginationParams = {}, options: RequestSignalOptions = {}) {
    return apiClient.get<PaginatedResponse<WatchHistoryEntry>>("/videos/me/watch-history", {
      params: pagination,
      ...options,
    });
  },

  updateWatchProgress(movieId: string, progress: number, lastPosition: number) {
    return apiClient.patch<WatchHistoryEntry>(`/videos/${movieId}/watch-progress`, {
      progress,
      lastPosition,
    });
  },
};
