/**
 * The advertisements the backend hands a title — `POST /ads/session` once per
 * open, then `POST /ads/midroll` a little before each ad break. The backend
 * decides eligibility (schedule, daily window, targeting, the viewer's caps,
 * the admin's "who sees breaks and corner ads" rule); the phone only plays
 * what it is given, and reports how that went.
 * Wire contract: docs/in-movie-ads-2026-11-04/CONTRACT.md.
 */

/** One video ad — before the film (the pre-roll) or at a break. */
export interface VideoAd {
  /** One decided play — the impression id every event below is filed under. */
  playbackId: string;
  advertisementId: string;
  title: string;
  /** Signed https link to the MP4 on the cache server (same 4 h TTL as a stream). */
  videoUrl: string;
  /** From the uploaded file; the countdown's total until the player reports its own. */
  durationSeconds: number;
  isSkippable: boolean;
  /** Seconds into the ad before Skip appears; null when the ad cannot be skipped. */
  skipAfterSeconds: number | null;
}

/**
 * The mid-roll plan for one viewing: a break every `intervalSeconds` of MOVIE
 * position (break k sits at k × interval). Kept for the whole viewing — an
 * admin change applies from the next open. Scheduled by `@/video/midroll`.
 */
export interface BreakPlan {
  /** Whole minutes × 60, at least 60. */
  intervalSeconds: number;
  /** Every break at or before this movie second is already done for this viewer (0 = none). */
  doneThroughSeconds: number;
  /** No break in the last this-many seconds of the title. */
  endGuardSeconds: number;
  /** `/ads/midroll` is asked this many movie seconds before a break. */
  askAheadSeconds: number;
}

/** The small picture in the stage's top-right corner. Scheduled by `@/video/corner`. */
export interface CornerAd {
  /** One play per viewing — every showing, tap and close is filed under it. */
  playbackId: string;
  advertisementId: string;
  title: string;
  /** Public PNG / JPG / WebP / GIF, absolute. */
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  /** http(s) only — the phone checks again (`safeAdLink`) before it is ever opened. */
  linkUrl: string | null;
  /** Seconds visible per showing; null = until the viewer closes it. */
  showSeconds: number | null;
  /** Seconds WATCHED after it leaves before it comes back; null = once. */
  repeatSeconds: number | null;
  /** Whether the ✕ shows (always true when `showSeconds` is null). */
  closable: boolean;
  /** The first showing comes after this many seconds watched. */
  firstShowAfterSeconds: number;
}

/** Everything one open of a title gets — `POST /ads/session`. */
export interface AdSession {
  /** The ad before the film, or null to play it straight away. */
  preroll: VideoAd | null;
  /** Null = no ad breaks this viewing. */
  breaks: BreakPlan | null;
  /** Null = no corner ad this viewing. */
  corner: CornerAd | null;
}

/** `POST /ads/midroll` — `{ad: null}` means "no ad at this break, carry on". */
export interface MidrollDecision {
  ad: VideoAd | null;
}

/**
 * What became of a play — `POST /ads/playbacks/:playbackId/events`. Only
 * `started` counts as an impression; the server treats a repeat or an
 * out-of-order event as a no-op, so the phone need not be exact, only honest.
 *
 * Video ads: `started` on the first frame, then exactly one of `completed` /
 * `skipped` / `failed`. The corner: `started` the first time it is seen,
 * `shown` each later showing, `clicked` per link tap, `skipped` on ✕,
 * `failed` when the picture cannot load — never `completed`.
 */
export type AdPlaybackEvent = "started" | "completed" | "skipped" | "failed" | "shown" | "clicked";

export interface AdPlaybackEventResult {
  playbackId: string;
  status: string;
}
