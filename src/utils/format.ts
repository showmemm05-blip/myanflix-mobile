/** Rendered where a runtime slot must stay visible but the value is unknown (labelled cells, episode rows). Meta lines omit the runtime instead. */
export const UNKNOWN_DURATION = "—";

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
