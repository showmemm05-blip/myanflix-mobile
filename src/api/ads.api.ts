import { apiClient, API_BASE_URL } from "@/api/client";
import { safeAdLink } from "@/video/corner";
import { MIDROLL_DECISION_TIMEOUT_MS } from "@/video/midroll";
import type { RequestSignalOptions } from "@/types/api";
import type {
  AdPlaybackEvent,
  AdPlaybackEventResult,
  AdSession,
  CornerAd,
  MidrollDecision,
  VideoAd,
} from "@/types/ads";

/**
 * The session sits on the critical path to the first frame: the film is not
 * mounted until it has landed (the pre-roll rides in it). Four seconds is the
 * most a viewer should wait for an ad that may not even exist; past it the
 * film simply plays, and the instance-wide 15 s would have been a long black
 * stage for nothing.
 */
const SESSION_TIMEOUT_MS = 4_000;

/** Origin the API lives on, with its trailing `/api` stripped — see books.service. */
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

/**
 * Ad links come back absolute (the cache server signs them, re-hosted per
 * request); this only covers a server-relative fallback, as the website does.
 */
function absolute(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `${API_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
}

function videoAd(ad: VideoAd | null | undefined): VideoAd | null {
  return ad ? { ...ad, videoUrl: absolute(ad.videoUrl) } : null;
}

/**
 * A corner with no picture is no corner at all, and its link is only kept if
 * it is a plain http(s) address — it is handed to the OS to open.
 */
function cornerAd(ad: CornerAd | null | undefined): CornerAd | null {
  if (!ad || typeof ad.imageUrl !== "string" || ad.imageUrl.trim() === "") return null;
  return { ...ad, imageUrl: absolute(ad.imageUrl.trim()), linkUrl: safeAdLink(ad.linkUrl) };
}

export const adsApi = {
  /**
   * Everything this open of a title gets: the pre-roll, the break plan and
   * the corner picture. 404 for a hidden title (the hook treats any failure
   * as "no ads").
   */
  async getSession(movieId: string, options: RequestSignalOptions = {}): Promise<AdSession> {
    const session = await apiClient.post<AdSession>(
      "/ads/session",
      { movieId },
      { timeout: SESSION_TIMEOUT_MS, ...options },
    );
    return {
      preroll: videoAd(session.preroll),
      breaks: session.breaks ?? null,
      corner: cornerAd(session.corner),
    };
  },

  /**
   * The ad for one break, asked a little before it (only the decision — the
   * MP4 itself loads when the break starts). Null when there is none to play.
   */
  async getMidroll(movieId: string, breakAtSeconds: number, options: RequestSignalOptions = {}): Promise<VideoAd | null> {
    const decision = await apiClient.post<MidrollDecision>(
      "/ads/midroll",
      { movieId, breakAtSeconds },
      { timeout: MIDROLL_DECISION_TIMEOUT_MS, ...options },
    );
    return videoAd(decision.ad);
  },

  /**
   * Reports one event of a play. `positionSeconds` is the whole second the
   * ad was at — the contract wants an integer, so a player tick is floored.
   */
  sendPlaybackEvent(playbackId: string, event: AdPlaybackEvent, positionSeconds?: number) {
    const body =
      positionSeconds === undefined
        ? { event }
        : { event, positionSeconds: Math.max(0, Math.floor(positionSeconds)) };
    return apiClient.post<AdPlaybackEventResult>(`/ads/playbacks/${encodeURIComponent(playbackId)}/events`, body);
  },
};
