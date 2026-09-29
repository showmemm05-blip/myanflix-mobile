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

/**
 * How many of the newest watch-history rows the resume lookup reads — the
 * backend's page-size ceiling (PaginationQueryDto @Max(100)).
 */
const RESUME_LOOKUP_ROWS = 100;
/** A title this far through counts as finished and starts again from the top. */
const RESUME_FINISHED_PERCENT = 95;
/** Less than this far in is not worth a seek — starting over costs nothing. */
const RESUME_MIN_SECONDS = 5;

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

  /**
   * The second to resume `movieId` (a film or an episode) from, or null to
   * start at 0:00 (audit H-27). Null when there is no saved position, when it
   * is under RESUME_MIN_SECONDS, or when the title was watched to 95% or more.
   *
   * The API has no single-title progress route, so this reads the newest
   * RESUME_LOOKUP_ROWS rows of the viewer's own history (newest first). A
   * title last touched further back than that starts from the top — the same
   * as before this lookup existed.
   */
  async getResumePosition(movieId: string, options: RequestSignalOptions = {}): Promise<number | null> {
    const { items } = await videosApi.getMyWatchHistory({ page: 1, limit: RESUME_LOOKUP_ROWS }, options);
    const entry = items.find((row) => row.movieId === movieId);
    if (!entry) return null;
    if (entry.progress >= RESUME_FINISHED_PERCENT) return null;
    if (!(entry.lastPosition >= RESUME_MIN_SECONDS)) return null;
    return entry.lastPosition;
  },

  updateWatchProgress(movieId: string, progress: number, lastPosition: number) {
    return videosApi.updateWatchProgress(movieId, Math.min(100, Math.max(0, progress)), Math.round(lastPosition));
  },
};
