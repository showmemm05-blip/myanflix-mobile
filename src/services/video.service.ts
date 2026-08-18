import { videosApi } from "@/api/videos.api";
import { ApiError } from "@/utils/errors";
import type { PaginationParams } from "@/types/api";

export type StreamAccessResult =
  | { status: "ready"; playlistUrl: string }
  | { status: "forbidden" } // premium + not purchased
  | { status: "not-ready" }; // 404 — movie doesn't exist, or video isn't READY yet (backend can't distinguish these for a normal user)

export const videoService = {
  async getStreamInfo(movieId: string): Promise<StreamAccessResult> {
    try {
      const { playlistUrl } = await videosApi.getStreamInfo(movieId);
      return { status: "ready", playlistUrl };
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) return { status: "forbidden" };
      if (err instanceof ApiError && err.status === 404) return { status: "not-ready" };
      throw err;
    }
  },

  getMyWatchHistory(pagination: PaginationParams = {}) {
    return videosApi.getMyWatchHistory(pagination);
  },

  updateWatchProgress(movieId: string, progress: number, lastPosition: number) {
    return videosApi.updateWatchProgress(movieId, Math.min(100, Math.max(0, progress)), Math.round(lastPosition));
  },
};
