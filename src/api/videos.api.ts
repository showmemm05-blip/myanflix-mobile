import { apiClient } from "@/api/client";
import type { PaginatedResponse, PaginationParams, RequestSignalOptions } from "@/types/api";
import type { StreamInfo, WatchHistoryEntry } from "@/types/video";

/** The viewer's own saved position for one title — GET /videos/:movieId/watch-progress (null when never watched). */
export interface WatchProgressEntry {
  /** Seconds into the title. */
  position: number;
  /** Percent watched, 0-100. */
  progress: number;
  updatedAt: string;
}

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

  getWatchProgress(movieId: string, options: RequestSignalOptions = {}) {
    return apiClient.get<WatchProgressEntry | null>(`/videos/${movieId}/watch-progress`, options);
  },

  updateWatchProgress(movieId: string, progress: number, lastPosition: number) {
    return apiClient.patch<WatchHistoryEntry>(`/videos/${movieId}/watch-progress`, {
      progress,
      lastPosition,
    });
  },
};
