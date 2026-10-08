import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { formatDuration } from "@/utils/format";
import type { TranslationShape } from "@/localization/translations";
import type { WatchHistoryEntry } from "@/types/video";

/**
 * A title this far through counts as watched. The same line the player's
 * resume lookup uses (RESUME_FINISHED_PERCENT in services/video.service.ts):
 * at 95% or more a title starts again from the top, so the library calls it
 * "Watched" and leaves it out of Continue watching.
 */
export const WATCHED_PERCENT = 95;

/** Whole percent, clamped to 0–100 — the API sends a float. */
export function percentOf(entry: WatchHistoryEntry): number {
  const raw = Number.isFinite(entry.progress) ? entry.progress : 0;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

export function isWatched(entry: WatchHistoryEntry): boolean {
  return percentOf(entry) >= WATCHED_PERCENT;
}

/**
 * "47m left" / "1h 2m left", from the runtime and the percent. Null when the
 * runtime is unknown — a meta line then simply says less, never "0m".
 */
export function timeLeftLabel(entry: WatchHistoryEntry, t: TranslationShape): string | null {
  if (!entry.durationMinutes) return null;
  const left = formatDuration((entry.durationMinutes * (100 - percentOf(entry))) / 100);
  return left ? t.library.timeLeft.replace("{time}", left) : null;
}

/**
 * The one status line under a history title:
 *  - watched → "Watched · 1h 48m" (the runtime when it is known);
 *  - otherwise → "62% · 47m left" (the time left when it is known).
 */
export function historyStatusLine(entry: WatchHistoryEntry, t: TranslationShape): string {
  if (isWatched(entry)) {
    return [t.library.watched, formatDuration(entry.durationMinutes)].filter(Boolean).join(" · ");
  }
  return [`${percentOf(entry)}%`, timeLeftLabel(entry, t)].filter(Boolean).join(" · ");
}

/** What a screen reader says for one history title: "Title, Watched" / "Title, 62% watched, 47m left". */
export function historyA11yLabel(entry: WatchHistoryEntry, t: TranslationShape): string {
  if (isWatched(entry)) return `${entry.movieTitle}, ${t.library.watched}`;
  return [entry.movieTitle, t.movie.watchedPercent.replace("{n}", String(percentOf(entry))), timeLeftLabel(entry, t)]
    .filter(Boolean)
    .join(", ");
}

/** "{n} titles", with the singular for one. */
export function titlesCountLabel(count: number, t: TranslationShape): string {
  return count === 1 ? t.library.titlesCountOne : t.library.titlesCount.replace("{n}", String(count));
}

/** Local calendar day as a sortable key ("2026-10-02"), so groups never depend on a locale's date format. */
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/**
 * Today's local calendar day, re-read whenever the app comes back to the
 * foreground. A screen that puts it in its memo deps relabels "Today" /
 * "Yesterday" after midnight (a list left open overnight is backgrounded when
 * the phone locks) instead of keeping the old day's headings until new data
 * lands. Same day → same string → no re-render.
 */
export function useCalendarDay(): string {
  const [day, setDay] = useState(() => dayKey(new Date()));
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setDay(dayKey(new Date()));
    });
    return () => subscription.remove();
  }, []);
  return day;
}

/**
 * The day heading for a timestamp: "Today", "Yesterday", or the phone's own
 * short date (toLocaleDateString, as the rest of the app prints dates).
 */
export function dayHeading(iso: string, t: TranslationShape, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayKey(date) === dayKey(now)) return t.library.today;
  if (dayKey(date) === dayKey(yesterday)) return t.library.yesterday;
  return date.toLocaleDateString();
}

/** "9:40 PM" in the phone's own locale — the time of day an entry was last played. */
export function timeOfDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export interface DayGroup<T> {
  /** Stable key: the local calendar day. */
  key: string;
  title: string;
  data: T[];
}

/**
 * Buckets an already-ordered feed by local calendar day, keeping the API's
 * order — no sorting, no filtering. A day that straddles a page boundary is
 * one group, because this runs over the flattened pages.
 */
export function groupByDay<T>(items: T[], dateOf: (item: T) => string, titleOf: (iso: string) => string): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const iso = dateOf(item);
    const date = new Date(iso);
    const key = Number.isNaN(date.getTime()) ? "unknown" : dayKey(date);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.data.push(item);
    else groups.push({ key, title: titleOf(iso), data: [item] });
  }
  return groups;
}
