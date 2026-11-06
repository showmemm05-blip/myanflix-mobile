/**
 * Mid-roll ad breaks (2026-11-04): while a title plays, the movie stops for
 * one ad every N minutes of MOVIE POSITION — break k (k ≥ 1) sits at
 * k × interval seconds — and then carries on from the same spot. The plan
 * (`breaks` in `POST /ads/session`) is kept for the whole viewing; the ad
 * itself is asked from `POST /ads/midroll` a little before each break.
 *
 * KEEP IN SYNC — this file exists twice, byte for byte:
 *   userwebsite/lib/player/midroll.ts (the website; the tests sit beside it)
 *   mobile/src/video/midroll.ts       (the phone app)
 * Change one, copy it over the other: the website's `npm test` fails while
 * the two differ. No imports, no DOM, no React Native, no clock.
 *
 * Everything is pure and immutable: each function returns a new state, or
 * the SAME object when nothing changed, so the ref that holds it can tell
 * "no change" cheaply. Callers pass the time (`nowMs`, monotonic). The rules,
 * in the viewer's words:
 *   - playing across a break stops the movie on the tick that crosses it and
 *     resumes from that spot (no seek); it works at 2× too;
 *   - a forward seek over breaks not yet played gives ONE ad (for the last
 *     break crossed), then the movie continues where the viewer landed;
 *     backward seeks never replay one;
 *   - a drag (or a run of ±10 taps) is one seek, decided once it has ended
 *     and the movie has played for 700 ms; a seek while paused waits for Play;
 *   - no break within min(5 min, interval / 2) after the start point or any
 *     ad, none in the last 2 minutes, none before the start point;
 *   - a break crossed while the player cannot be interrupted (a menu or sheet
 *     is open, the tab / app is hidden) is OWED and plays on the first tick
 *     that may interrupt — unless the movie is then in its last minutes.
 * Spec: docs/in-movie-ads-2026-11-04/SCHEDULER-SPEC.md.
 */

/** An interval below this (or a missing / broken one) means "no breaks". */
export const MIDROLL_MIN_INTERVAL_SECONDS = 60;
/** No break when it would sit in the last this-many seconds (the server may send its own). */
export const MIDROLL_DEFAULT_END_GUARD_SECONDS = 120;
/** The ad is asked this many movie seconds before its break (the server may send its own). */
export const MIDROLL_DEFAULT_ASK_AHEAD_SECONDS = 20;
/** A position step bigger than this that nobody declared is a programmatic jump, not playback. */
export const MIDROLL_MAX_NATURAL_STEP_SECONDS = 4;
/** A user-seek burst ends after this much quiet while playing. */
export const MIDROLL_SEEK_SETTLE_MS = 700;
/** The quiet gap after the start point or an ad is min(this, interval / 2). */
export const MIDROLL_QUIET_MAX_SECONDS = 300;
/** `/ads/midroll` must answer this fast. */
export const MIDROLL_DECISION_TIMEOUT_MS = 4_000;
/** A break whose decision has not settled by now is given up and the movie resumes. */
export const MIDROLL_DECISION_BACKSTOP_MS = 8_000;
/** A prefetched decision older than this is asked again (its signed link may be stale). */
export const MIDROLL_DECISION_MAX_AGE_MS = 8 * 60_000;
/**
 * The latest break second the API accepts (`breakAtSeconds` ≤ 86 400). Later
 * breaks are never scheduled, which also keeps every loop here bounded.
 */
export const MIDROLL_MAX_BREAK_SECONDS = 86_400;

/** The wire `BreakPlan` from `POST /ads/session`. */
export interface MidrollPlanInput {
  intervalSeconds: number;
  /** Every break at or before this movie second is already done for this viewer (0 = none). */
  doneThroughSeconds: number;
  endGuardSeconds?: number;
  askAheadSeconds?: number;
}

export interface MidrollState {
  /** Seconds between breaks; 0 = off. */
  readonly interval: number;
  readonly endGuard: number;
  readonly askAhead: number;
  /** Break indexes (k ≥ 1) that never play again: done on the server ∪ consumed ∪ forgiven. */
  readonly done: ReadonlySet<number>;
  /** Breaks whose decision was already asked for ahead of time. */
  readonly asked: ReadonlySet<number>;
  /** The last movie position accepted; null = not started yet. */
  readonly last: number | null;
  /** A break whose second is below this is consumed silently (the quiet gap). */
  readonly quietUntil: number;
  /** The open user-seek burst: where it began and when its latest seek happened. */
  readonly seek: { readonly from: number; readonly at: number } | null;
  /** Breaks crossed while the player could not be interrupted, ascending. */
  readonly owed: readonly number[] | null;
}

export interface MidrollTickInput {
  /** The movie's current second. */
  position: number;
  /** The movie's length in seconds; ≤ 0 / NaN while unknown. */
  duration: number;
  playing: boolean;
  /** A monotonic clock in ms (performance.now() on the website). */
  nowMs: number;
  /** The viewer is dragging the seek bar. */
  scrubbing?: boolean;
  /** False while a menu / sheet is open or the tab / app is hidden. */
  canInterrupt: boolean;
}

export type MidrollAction =
  | { kind: "none" }
  /** Ask `/ads/midroll` for this break now; the break itself comes later. */
  | { kind: "prefetch"; breakIndex: number; breakAtSeconds: number }
  /** Pause the movie and play ONE ad for all of `consumed` (ascending; `breakIndex` is the last). */
  | { kind: "break"; breakIndex: number; breakAtSeconds: number; consumed: readonly number[] };

export interface MidrollStep {
  state: MidrollState;
  action: MidrollAction;
}

/** No breaks this viewing. Every function hands it back unchanged. */
export const MIDROLL_OFF: MidrollState = Object.freeze({
  interval: 0,
  endGuard: MIDROLL_DEFAULT_END_GUARD_SECONDS,
  askAhead: MIDROLL_DEFAULT_ASK_AHEAD_SECONDS,
  done: new Set<number>(),
  asked: new Set<number>(),
  last: null,
  quietUntil: 0,
  seek: null,
  owed: null,
});

const NONE: MidrollAction = Object.freeze({ kind: "none" });
const NO_BREAKS: readonly number[] = Object.freeze([]);

/** A state that has a position — every one past `midrollStart`. */
type Running = MidrollState & { readonly last: number };

function isRunning(s: MidrollState): s is Running {
  return s.last !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** A position the scheduler can use: finite and never below 0. */
function cleanSeconds(value: number): number {
  return isFiniteNumber(value) && value > 0 ? value : 0;
}

/** The plan as sent, or MIDROLL_OFF when there are no breaks this viewing. */
export function createMidrollState(plan: MidrollPlanInput | null | undefined): MidrollState {
  if (
    !plan ||
    !isFiniteNumber(plan.intervalSeconds) ||
    plan.intervalSeconds < MIDROLL_MIN_INTERVAL_SECONDS
  ) {
    return MIDROLL_OFF;
  }
  const interval = Math.floor(plan.intervalSeconds);
  const doneThrough = isFiniteNumber(plan.doneThroughSeconds) ? plan.doneThroughSeconds : 0;
  return {
    interval,
    endGuard:
      isFiniteNumber(plan.endGuardSeconds) && plan.endGuardSeconds >= 0
        ? plan.endGuardSeconds
        : MIDROLL_DEFAULT_END_GUARD_SECONDS,
    askAhead:
      isFiniteNumber(plan.askAheadSeconds) && plan.askAheadSeconds > 0
        ? plan.askAheadSeconds
        : MIDROLL_DEFAULT_ASK_AHEAD_SECONDS,
    done: withBreaksThrough(new Set<number>(), interval, doneThrough),
    asked: new Set<number>(),
    last: null,
    quietUntil: 0,
    seek: null,
    owed: null,
  };
}

/** No break within this many seconds after the start point or an ad. */
export function midrollQuietSeconds(interval: number): number {
  return Math.min(MIDROLL_QUIET_MAX_SECONDS, interval / 2);
}

/**
 * The open's real start: after the pre-roll, at the resume second. Breaks at
 * or before it are forgiven (never owed), and the quiet gap starts here.
 */
export function midrollStart(s: MidrollState, startSeconds: number): MidrollState {
  if (s.interval === 0) return s;
  const at = cleanSeconds(startSeconds);
  return {
    ...s,
    done: withBreaksThrough(s.done, s.interval, at),
    last: at,
    quietUntil: at + midrollQuietSeconds(s.interval),
    seek: null,
    owed: null,
  };
}

/**
 * A programmatic re-seek (the resume seek, a quality switch, link recovery,
 * a rebuilt player): the position moves without crossing anything — nothing
 * is consumed, no quiet gap starts, owed breaks stay owed.
 */
export function midrollRebase(s: MidrollState, seconds: number): MidrollState {
  if (s.interval === 0) return s;
  const at = cleanSeconds(seconds);
  if (s.last === at && s.seek === null) return s;
  return { ...s, last: at, seek: null };
}

/**
 * Every USER seek (website `applySeek`; phone `handleSkip` / `handleSeek`).
 * Seeks close together form one burst that keeps the position it began at;
 * the tick decides once the burst has settled.
 */
export function midrollNoteSeek(s: MidrollState, from: number, to: number, nowMs: number): MidrollState {
  if (s.interval === 0) return s;
  return {
    ...s,
    seek: { from: s.seek?.from ?? s.last ?? cleanSeconds(from), at: nowMs },
    last: cleanSeconds(to),
  };
}

/** One movie tick (website `timeupdate`, phone `onProgress`). */
export function midrollTick(s: MidrollState, input: MidrollTickInput): MidrollStep {
  const pos = input.position;
  if (s.interval === 0 || !isFiniteNumber(pos) || pos < 0) return { state: s, action: NONE };
  // Only a safety net: the players start the scheduler themselves.
  if (!isRunning(s)) return { state: midrollStart(s, pos), action: NONE };

  if (s.seek !== null) {
    // A clock that went backwards counts as settled rather than holding the burst open.
    const quiet = input.nowMs - s.seek.at;
    const settled =
      !input.scrubbing && input.playing && (quiet >= MIDROLL_SEEK_SETTLE_MS || quiet < 0);
    if (!settled) return { state: s.last === pos ? s : { ...s, last: pos }, action: NONE };
    const base: Running = { ...s, seek: null, last: pos };
    return pos > s.seek.from ? cross(base, s.seek.from, pos, input, true) : settle(base, input);
  }

  const step = pos - s.last;
  // Android keeps ticking while paused, and an OS pause leaves `playing` true: same second, no crossing.
  if (step === 0) return settle(s, input);
  if (step < 0 || step > MIDROLL_MAX_NATURAL_STEP_SECONDS) {
    return { state: { ...s, last: pos }, action: NONE };
  }
  return cross({ ...s, last: pos }, s.last, pos, input, false);
}

/** The seek-bar ticks: the seconds of every break still to come. */
export function midrollMarkers(s: MidrollState, duration: number): number[] {
  const top = lastEligibleBreak(s, duration);
  const seconds: number[] = [];
  for (let k = 1; k <= top; k++) {
    if (!s.done.has(k) && k * s.interval >= s.quietUntil) seconds.push(k * s.interval);
  }
  return seconds;
}

/**
 * Whether the decision asked ahead may serve this break, or a fresh one must
 * be asked. Only a decision for the LAST break crossed: after a jump over
 * several breaks the server must record the furthest one (that is what makes
 * every break before it done), so an earlier break's decision is asked again
 * for the new position — the server moves its open row there.
 */
export function midrollDecisionUsable(
  cached: { readonly breakIndex: number; readonly askedAt: number } | null | undefined,
  consumed: readonly number[],
  nowMs: number,
): boolean {
  if (!cached || consumed.length === 0) return false;
  if (cached.breakIndex !== Math.max(...consumed)) return false;
  const age = nowMs - cached.askedAt;
  return age >= 0 && age < MIDROLL_DECISION_MAX_AGE_MS;
}

/** The movie ran (or a settled seek landed) from `from` to `to`. */
function cross(s: Running, from: number, to: number, input: MidrollTickInput, landing: boolean): MidrollStep {
  const crossed = breaksBetween(s, from, to, input.duration);
  if (crossed.length === 0) return settle(s, input);
  // Consumed the moment they are crossed, so a null decision or a failed ad needs no undo.
  const done = withBreaks(s.done, crossed);
  const firing = crossed.filter((k) => k * s.interval >= s.quietUntil);
  const limit = breakLimit(s, input.duration);
  if (firing.length === 0 || (landing && limit !== null && to > limit)) {
    return { state: { ...s, done }, action: NONE };
  }
  const owed = sortedUnique([...(s.owed ?? NO_BREAKS), ...firing]);
  if (!input.playing || !input.canInterrupt) return { state: { ...s, done, owed }, action: NONE };
  return fire({ ...s, done }, owed, to);
}

/** No crossing on this tick: pay what is owed, or ask ahead for the next break. */
function settle(s: Running, input: MidrollTickInput): MidrollStep {
  if (s.owed !== null) {
    if (!input.playing || !input.canInterrupt) return { state: s, action: NONE };
    const limit = breakLimit(s, input.duration);
    return limit !== null && s.last <= limit
      ? fire(s, s.owed, s.last)
      : { state: { ...s, owed: null }, action: NONE };
  }
  if (!input.playing || s.seek !== null) return { state: s, action: NONE };
  const k = nextBreak(s, s.last, input.duration);
  if (k === null || s.asked.has(k) || k * s.interval - s.last > s.askAhead) {
    return { state: s, action: NONE };
  }
  return {
    state: { ...s, asked: withBreaks(s.asked, [k]) },
    action: { kind: "prefetch", breakIndex: k, breakAtSeconds: k * s.interval },
  };
}

function fire(s: MidrollState, consumed: readonly number[], at: number): MidrollStep {
  const breakIndex = Math.max(...consumed);
  return {
    state: { ...s, owed: null, quietUntil: at + midrollQuietSeconds(s.interval) },
    action: { kind: "break", breakIndex, breakAtSeconds: breakIndex * s.interval, consumed },
  };
}

/** The last second a break may sit at; null while the duration is unknown. */
function breakLimit(s: MidrollState, duration: number): number | null {
  return isFiniteNumber(duration) && duration > 0 ? duration - s.endGuard : null;
}

/** The highest break index that may still play in a title this long (0 = none). */
function lastEligibleBreak(s: MidrollState, duration: number): number {
  const limit = breakLimit(s, duration);
  if (s.interval === 0 || limit === null) return 0;
  return Math.floor(Math.min(limit, MIDROLL_MAX_BREAK_SECONDS) / s.interval);
}

/** Breaks not yet done with from < k × interval ≤ to, ascending. */
function breaksBetween(s: MidrollState, from: number, to: number, duration: number): readonly number[] {
  if (to <= from) return NO_BREAKS;
  const top = Math.min(lastEligibleBreak(s, duration), Math.floor(to / s.interval));
  const found: number[] = [];
  for (let k = Math.max(1, Math.floor(from / s.interval) + 1); k <= top; k++) {
    if (!s.done.has(k)) found.push(k);
  }
  return found;
}

/** The first break after `after` that is still due and outside the quiet gap. */
function nextBreak(s: MidrollState, after: number, duration: number): number | null {
  const top = lastEligibleBreak(s, duration);
  for (let k = Math.max(1, Math.floor(after / s.interval) + 1); k <= top; k++) {
    if (!s.done.has(k) && k * s.interval >= s.quietUntil) return k;
  }
  return null;
}

/** `set` plus every break at or before `seconds`. */
function withBreaksThrough(set: ReadonlySet<number>, interval: number, seconds: number): ReadonlySet<number> {
  const top = Math.floor(Math.min(seconds, MIDROLL_MAX_BREAK_SECONDS) / interval);
  const ks: number[] = [];
  for (let k = 1; k <= top; k++) ks.push(k);
  return withBreaks(set, ks);
}

function withBreaks(set: ReadonlySet<number>, ks: readonly number[]): ReadonlySet<number> {
  if (ks.every((k) => set.has(k))) return set;
  const next = new Set(set);
  for (const k of ks) next.add(k);
  return next;
}

function sortedUnique(ks: readonly number[]): number[] {
  return Array.from(new Set(ks)).sort((a, b) => a - b);
}
