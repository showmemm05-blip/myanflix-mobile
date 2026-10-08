// Deep subpaths, NOT `from "date-fns"`: Metro does not tree-shake, and the
// root barrel pulls every date-fns module plus its locales into the bundle.
import { format } from "date-fns/format";
import { isToday } from "date-fns/isToday";
import { isYesterday } from "date-fns/isYesterday";
import { startOfDay } from "date-fns/startOfDay";
import { subDays } from "date-fns/subDays";
import type { Language } from "@/localization/translations";

/**
 * Wallet dates in the APP's language rather than the device locale (which is
 * what `toLocaleDateString()` used to follow). date-fns ships no Burmese
 * locale, so Burmese gets unambiguous numeric day-month-year and a 24-hour
 * clock; English gets "3 Oct 2026" and "4:05 PM". Every helper returns "" for
 * an unparseable timestamp instead of throwing inside a list row.
 */
const PATTERNS: Record<Language, { day: string; time: string; dateTime: string }> = {
  en: { day: "d MMM yyyy", time: "h:mm a", dateTime: "d MMM yyyy, h:mm a" },
  mm: { day: "dd/MM/yyyy", time: "HH:mm", dateTime: "dd/MM/yyyy HH:mm" },
};

function parse(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Local calendar day, "yyyy-MM-dd" — the grouping key of the day headers. */
function dayKey(value: string): string {
  const date = parse(value);
  return date ? format(date, "yyyy-MM-dd") : "";
}

export function dayLabel(value: string, language: Language, words: { today: string; yesterday: string }): string {
  const date = parse(value);
  if (!date) return "";
  if (isToday(date)) return words.today;
  if (isYesterday(date)) return words.yesterday;
  return format(date, PATTERNS[language].day);
}

export function timeLabel(value: string, language: Language): string {
  const date = parse(value);
  return date ? format(date, PATTERNS[language].time) : "";
}

export function dateTimeLabel(value: string, language: Language): string {
  const date = parse(value);
  return date ? format(date, PATTERNS[language].dateTime) : "";
}

/**
 * Start of the local day `days - 1` days ago, as an ISO timestamp — "the last
 * 7 days" includes today. Call it when a range is PICKED and keep the result:
 * computing it during render would change the query key every millisecond.
 */
export function rangeStartIso(days: number): string {
  return startOfDay(subDays(new Date(), days - 1)).toISOString();
}

/** Where a row sits inside its day group — drives the grouped-list corners and dividers. */
export type RowPosition = "only" | "first" | "middle" | "last";

export type DayListItem<T> =
  | { kind: "day"; key: string; label: string }
  | { kind: "row"; key: string; row: T; position: RowPosition };

/**
 * Splits rows that arrive newest first into day groups: a header item before
 * each new calendar day, and every row told its position inside its group.
 */
export function withDayHeaders<T extends { id: string }>(
  rows: readonly T[],
  getDate: (row: T) => string,
  labelFor: (date: string) => string,
): DayListItem<T>[] {
  const items: DayListItem<T>[] = [];
  let index = 0;
  while (index < rows.length) {
    const key = dayKey(getDate(rows[index]));
    let end = index + 1;
    while (end < rows.length && dayKey(getDate(rows[end])) === key) end += 1;
    items.push({ kind: "day", key: `day-${key || index}`, label: labelFor(getDate(rows[index])) });
    for (let i = index; i < end; i += 1) {
      items.push({ kind: "row", key: rows[i].id, row: rows[i], position: positionIn(i - index, end - index) });
    }
    index = end;
  }
  return items;
}

/** Position of row `index` in a flat group of `size` rows (no day headers). */
export function positionIn(index: number, size: number): RowPosition {
  if (size <= 1) return "only";
  if (index === 0) return "first";
  return index === size - 1 ? "last" : "middle";
}
