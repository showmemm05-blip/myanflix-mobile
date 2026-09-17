/** Rendered where a runtime slot must stay visible but the value is unknown (labelled cells, episode rows). Meta lines omit the runtime instead. */
export const UNKNOWN_DURATION = "—";

/**
 * Confines `value` to [min, max] — the one home for the arithmetic that was
 * written out ten times across the app. NaN-safe callers must guard before
 * calling: `Math.min/max` propagate NaN rather than falling back to a bound.
 *
 * This module deliberately has no imports, so anything may import it — the
 * theme included. It is a plain JS-thread function: do NOT call it from a
 * Reanimated worklet (see `PageZoomView`'s own `clampW`, which stays local for
 * exactly that reason).
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Runtime in minutes -> "45m" / "1h 32m". Returns null when the runtime is
 * unknown: 0 is the API's not-measured sentinel (a bulk-uploaded title whose
 * probe failed), and it must never surface as "0m".
 */
export function formatDuration(minutes: number | null | undefined): string | null {
  if (minutes == null || !Number.isFinite(minutes)) return null;
  // Guard the ROUNDED value: 0.4 min rounds to 0 and must be unknown, not "0m".
  const whole = Math.round(minutes);
  if (whole <= 0) return null;
  const hours = Math.floor(whole / 60);
  const remainingMinutes = whole % 60;
  if (hours === 0) return `${remainingMinutes}m`;
  return `${hours}h ${remainingMinutes}m`;
}

/** The four templates a relative timestamp picks between — pass `t.comments`. */
export interface RelativeTimeLabels {
  justNow: string;
  /** "{n}" is replaced with the count. */
  minutesAgo: string;
  hoursAgo: string;
  daysAgo: string;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * "Just now" / "5m ago" / "3h ago" / "2d ago", falling back to an absolute
 * date past a week.
 *
 * The wording is passed in rather than baked here so this stays language-
 * agnostic — Burmese puts the unit after the number and has no plural form,
 * which a hardcoded English template could not express.
 *
 * A clock skew that puts a server timestamp slightly in the future reads as
 * "just now" rather than a negative age.
 */
export function formatRelativeTime(iso: string, labels: RelativeTimeLabels, now: number = Date.now()): string {
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) return "";

  const elapsed = now - timestamp;
  if (elapsed < MINUTE_MS) return labels.justNow;
  if (elapsed < HOUR_MS) return labels.minutesAgo.replace("{n}", String(Math.floor(elapsed / MINUTE_MS)));
  if (elapsed < DAY_MS) return labels.hoursAgo.replace("{n}", String(Math.floor(elapsed / HOUR_MS)));
  if (elapsed < 7 * DAY_MS) return labels.daysAgo.replace("{n}", String(Math.floor(elapsed / DAY_MS)));
  return new Date(timestamp).toLocaleDateString();
}

/** Player clock: seconds -> "m:ss", or "h:mm:ss" once there is an hour. */
export function formatTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Avatar fallback: the first two letters of a name, uppercased; "?" when unknown. */
export function initials(name: string | undefined): string {
  if (!name) return "?";
  return name.slice(0, 2).toUpperCase();
}

/**
 * The one rule for "what do we call this person": their display name if they
 * set one, otherwise the username they sign in with. Same rule as the web
 * app's mapUser, including the trim — a stored name that is only whitespace
 * counts as unset rather than rendering as a blank line.
 *
 * Returns "" for no user at all, so a caller with its own fallback ("You" in
 * the comment composer) can `||` onto it.
 */
export function displayNameOf(
  user: { displayName?: string | null; username?: string | null } | null | undefined,
): string {
  const named = user?.displayName?.trim();
  if (named) return named;
  return user?.username ?? "";
}
