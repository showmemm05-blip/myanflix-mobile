/**
 * Corner ads (2026-11-04): a small picture in the top-right of the player
 * while the movie plays (`corner` in `POST /ads/session`, one per viewing).
 * It first shows after a minute of watching, stays for the ad's seconds —
 * counted only while it can actually be seen — and comes back after the
 * ad's repeat seconds of watching, or never; an ad with no show time stays
 * until the viewer closes it. ✕ ends it for the rest of the viewing.
 *
 * KEEP IN SYNC — this file exists twice, byte for byte:
 *   userwebsite/lib/player/corner.ts (the website; the tests sit beside it)
 *   mobile/src/video/corner.ts       (the phone app)
 * Change one, copy it over the other: the website's `npm test` fails while
 * the two differ. No imports, no DOM, no React Native, no clock.
 *
 * Pure and immutable like midroll.ts: every function returns a new state, or
 * the SAME object when nothing changed. Only naturally watched seconds count
 * — seeks, paused ticks and backward steps never do. The page decides
 * `canShow` (movie playing, not seeking, controls hidden, not buffering, no
 * ad, no error, no open menu) and sends the events: `started` the first time
 * it is visible with the picture loaded (`showings === 1`), `shown` each time
 * a later showing becomes visible, `clicked` per link tap, `skipped` on ✕,
 * `failed` when the picture cannot load (then `cornerFail`).
 * Spec: docs/in-movie-ads-2026-11-04/SCHEDULER-SPEC.md.
 */

/** The first showing comes after this many seconds watched (the server may send its own). */
export const CORNER_DEFAULT_FIRST_AFTER_SECONDS = 60;
/** Seconds visible per showing when the ad's own figure is unusable. */
export const CORNER_DEFAULT_SHOW_SECONDS = 10;
/** A repeat sooner than this is stretched to it. */
export const CORNER_MIN_REPEAT_SECONDS = 60;
/** Never visible in the last this-many seconds of the movie. */
export const CORNER_END_GUARD_SECONDS = 120;
/** A position step bigger than this is a seek, not watching. */
export const CORNER_MAX_STEP_SECONDS = 4;

/** The timing part of the wire `CornerAd`. */
export interface CornerPlanInput {
  /** Seconds visible per showing; null = until the viewer closes it. */
  showSeconds: number | null;
  /** Seconds WATCHED after it leaves before it comes back; null = once. */
  repeatSeconds: number | null;
  closable: boolean;
  firstShowAfterSeconds?: number;
}

export interface CornerState {
  readonly phase: "off" | "waiting" | "showing" | "done";
  /** Null = until closed. */
  readonly showSeconds: number | null;
  /** Null = once. */
  readonly repeatSeconds: number | null;
  readonly closable: boolean;
  /** Seconds naturally watched this viewing. */
  readonly watched: number;
  readonly last: number | null;
  /** The `watched` figure at which the next showing starts. */
  readonly dueAt: number;
  /** Wall seconds the current showing has been visible. */
  readonly shownFor: number;
  /** How many showings have started (1 = the impression). */
  readonly showings: number;
}

export interface CornerTickInput {
  /** The movie's current second. */
  position: number;
  /** The movie's length in seconds; ≤ 0 / NaN while unknown. */
  duration: number;
  playing: boolean;
  /** The playback rate, so visible time is counted in wall seconds. */
  rate: number;
  canShow: boolean;
}

/** No corner ad this viewing. Every function hands it back unchanged. */
export const CORNER_OFF: CornerState = Object.freeze({
  phase: "off",
  showSeconds: null,
  repeatSeconds: null,
  closable: false,
  watched: 0,
  last: null,
  dueAt: 0,
  shownFor: 0,
  showings: 0,
});

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** The ad's timing, cleaned up; CORNER_OFF when there is no corner ad this viewing. */
export function createCornerState(plan: CornerPlanInput | null | undefined): CornerState {
  if (!plan) return CORNER_OFF;
  const showSeconds =
    plan.showSeconds === null
      ? null
      : isFiniteNumber(plan.showSeconds) && plan.showSeconds > 0
        ? plan.showSeconds
        : CORNER_DEFAULT_SHOW_SECONDS;
  const repeatSeconds =
    isFiniteNumber(plan.repeatSeconds) && plan.repeatSeconds > 0
      ? Math.max(CORNER_MIN_REPEAT_SECONDS, plan.repeatSeconds)
      : null;
  return {
    phase: "waiting",
    showSeconds,
    repeatSeconds,
    // Until closed with no ✕ would never go away.
    closable: showSeconds === null || plan.closable === true,
    watched: 0,
    last: null,
    dueAt:
      isFiniteNumber(plan.firstShowAfterSeconds) && plan.firstShowAfterSeconds >= 0
        ? plan.firstShowAfterSeconds
        : CORNER_DEFAULT_FIRST_AFTER_SECONDS,
    shownFor: 0,
    showings: 0,
  };
}

/** The last 2 minutes, when the credits roll and the corner stays away. */
export function cornerNearEnd(position: number, duration: number): boolean {
  return duration > 0 && position > duration - CORNER_END_GUARD_SECONDS;
}

/** One movie tick (website `timeupdate`, phone `onProgress`). */
export function cornerTick(s: CornerState, input: CornerTickInput): CornerState {
  if (s.phase === "off" || s.phase === "done") return s;
  const pos = input.position;
  if (!isFiniteNumber(pos) || pos < 0) return s;
  if (s.last === null) return { ...s, last: pos };

  const step = pos - s.last;
  if (!input.playing || step <= 0 || step > CORNER_MAX_STEP_SECONDS) {
    return step === 0 ? s : { ...s, last: pos };
  }
  const watched = s.watched + step;

  if (s.phase === "waiting") {
    return watched >= s.dueAt
      ? { ...s, phase: "showing", watched, last: pos, shownFor: 0, showings: s.showings + 1 }
      : { ...s, watched, last: pos };
  }

  const visible = input.canShow && !cornerNearEnd(pos, input.duration);
  if (!visible || s.showSeconds === null) return { ...s, watched, last: pos };
  // Wall seconds: at 2× the position moves twice as fast as the viewer's clock.
  const rate = isFiniteNumber(input.rate) && input.rate > 0 ? Math.max(0.25, input.rate) : 1;
  const shownFor = s.shownFor + step / rate;
  if (shownFor < s.showSeconds) return { ...s, watched, last: pos, shownFor };
  // The repeat counts from the moment it left.
  return s.repeatSeconds === null
    ? { ...s, phase: "done", watched, last: pos, shownFor }
    : { ...s, phase: "waiting", watched, last: pos, shownFor: 0, dueAt: watched + s.repeatSeconds };
}

/** ✕: gone for the rest of the viewing (only while showing, and only if it may be closed). */
export function cornerDismiss(s: CornerState): CornerState {
  return s.phase === "showing" && s.closable ? { ...s, phase: "done" } : s;
}

/** The picture could not load: no corner ad for the rest of the viewing. */
export function cornerFail(s: CornerState): CornerState {
  return s.phase === "off" || s.phase === "done" ? s : { ...s, phase: "done" };
}

/** Whether the picture is on screen right now. */
export function cornerVisible(
  s: CornerState,
  input: Pick<CornerTickInput, "position" | "duration" | "canShow">,
): boolean {
  return s.phase === "showing" && input.canShow && !cornerNearEnd(input.position, input.duration);
}

/**
 * The ad's link, if it is a plain http(s) address; null otherwise. A regex,
 * not `new URL` — React Native's URL is incomplete.
 */
export function safeAdLink(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const link = raw.trim();
  return /^https?:\/\/[^\s/?#]+[^\s]*$/i.test(link) ? link : null;
}
