import { videosApi } from "@/api/videos.api";
import { ApiError } from "@/utils/errors";
import type { PaginationParams, RequestSignalOptions } from "@/types/api";
import type { StreamQuality, StreamSubtitle } from "@/types/video";

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
      /**
       * Every subtitle the title has, each with a signed link to its source
       * file. This — not the manifest's renditions — is what the picker lists
       * and what the caption overlay reads, so it is never filtered by format:
       * the app's own parser handles SRT, VTT and ASS alike.
       */
      subtitles: StreamSubtitle[];
      /**
       * The rendition ladder, best-first, as the backend ordered it — the two
       * producers of the stored column disagree about order, so the client
       * never sorts. Normalised to an array here, so the player screen can
       * treat "no quality control" as an empty list rather than branching on
       * an older backend's missing field.
       */
      qualities: StreamQuality[];
    }
  | { status: "forbidden" } // premium + not purchased
  | { status: "not-ready" }; // 404 — movie doesn't exist, or video isn't READY yet (backend can't distinguish these for a normal user)

export const videoService = {
  async getStreamInfo(movieId: string, options: RequestSignalOptions = {}): Promise<StreamAccessResult> {
    try {
      const { playlistUrl, subtitles, qualities } = await videosApi.getStreamInfo(movieId, options);
      const rows = subtitles ?? [];
      const defaultSubtitle = rows.find((s) => s.isDefault);
      return {
        status: "ready",
        playlistUrl,
        defaultSubtitleLanguage: defaultSubtitle?.language ?? null,
        subtitles: rows,
        qualities: qualities ?? [],
      };
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) return { status: "forbidden" };
      if (err instanceof ApiError && err.status === 404) return { status: "not-ready" };
      throw err;
    }
  },

  getMyWatchHistory(pagination: PaginationParams = {}, options: RequestSignalOptions = {}) {
    return videosApi.getMyWatchHistory(pagination, options);
  },

  updateWatchProgress(movieId: string, progress: number, lastPosition: number) {
    return videosApi.updateWatchProgress(movieId, Math.min(100, Math.max(0, progress)), Math.round(lastPosition));
  },
};
