import { videosApi } from "@/api/videos.api";
import { ApiError } from "@/utils/errors";
import type { PaginationParams } from "@/types/api";

export type StreamAccessResult =
  | {
      status: "ready";
      playlistUrl: string;
      /**
       * Language of the track the manifest marks DEFAULT=YES, or null when the
       * title has none. The player falls back to this when the viewer has never
       * expressed a subtitle preference — expo-video's SubtitleTrack carries no
       * "is default" flag of its own, so without this the manifest's default
       * would be silently switched off on a fresh install while the web client
       * (where hls.js auto-selects it) turns it on.
       */
      defaultSubtitleLanguage: string | null;
    }
  | { status: "forbidden" } // premium + not purchased
  | { status: "not-ready" }; // 404 — movie doesn't exist, or video isn't READY yet (backend can't distinguish these for a normal user)

export const videoService = {
  async getStreamInfo(movieId: string): Promise<StreamAccessResult> {
    try {
      const { playlistUrl, subtitles } = await videosApi.getStreamInfo(movieId);
      // ASS rows are deliberately left out of the manifest (neither client can
      // render them), so a default that is ASS has no rendition to match and
      // resolves to "no subtitles" — the same as any unmatched language.
      const defaultSubtitle = subtitles?.find((s) => s.isDefault);
      return {
        status: "ready",
        playlistUrl,
        defaultSubtitleLanguage: defaultSubtitle?.language ?? null,
      };
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
