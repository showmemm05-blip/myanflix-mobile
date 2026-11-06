/**
 * Formatting helpers ported from the ticket recipe (spec/thai-ticket-recipe.md
 * §4) and the boards' scripts. Pure functions; no locale APIs (Hermes' Intl
 * differs per platform, and every string here must match the approved boards
 * character for character).
 *
 * Two languages (2026-11-04, lottery/i18n.ts): the words a reader sees —
 * weekdays, months, the clock's AM/PM, "1 ticket", the spoken ticket — follow
 * the Lottery's language at the moment they are formatted. Digits stay Latin
 * in both (the wallet's convention, and a lottery number must never change
 * shape) and money stays "1,000 Ks". The printed ticket's own dates (dateMy,
 * dateEn, DIGIT_WORDS) are artwork and never change. Every Burmese date keeps
 * its year LAST, as the English ones do, so `.replace(/ \d{4}$/, "")` still
 * drops it.
 *
 * Every lottery number is a six-digit STRING ("004821"): never parse one to a
 * number, the leading zeros are part of it.
 *
 * Times (phase 2, 2026-10-19): the API speaks UTC instants; every one of them
 * is shown in MYANMAR time (UTC+6:30, no daylight saving), worked out here by
 * hand so the phone's own time zone never leaks into a draw date.
 */

import { ltLanguage } from "@/lottery/i18n";

/** The ticket's spelled digits, index = digit (0 ZER … 9 NIN). */
export const DIGIT_WORDS = ["ZER", "ONE", "TWO", "THR", "FOU", "FIV", "SIX", "SEV", "EIG", "NIN"] as const;

/** Myanmar is UTC+6:30 all year (backend risk-rules.ts YANGON_UTC_OFFSET_MINUTES). */
export const MYANMAR_UTC_OFFSET_MINUTES = 390;

const MY_DIGITS = "၀၁၂၃၄၅၆၇၈၉";
const MY_MONTHS = [
  "ဇန်နဝါရီ",
  "ဖေဖော်ဝါရီ",
  "မတ်",
  "ဧပြီ",
  "မေ",
  "ဇွန်",
  "ဇူလိုင်",
  "ဩဂုတ်",
  "စက်တင်ဘာ",
  "အောက်တိုဘာ",
  "နိုဝင်ဘာ",
  "ဒီဇင်ဘာ",
];
const EN_MONTHS = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
];
const EN_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** Burmese weekday names, Sunday first; the long form adds နေ့ ("day"). */
const MY_DAYS = ["တနင်္ဂနွေ", "တနင်္လာ", "အင်္ဂါ", "ဗုဒ္ဓဟူး", "ကြာသပတေး", "သောကြာ", "စနေ"];
/** The date stamp's short Burmese months (calendar abbreviations). */
const MY_MONTHS_SHORT = ["ဇန်", "ဖေ", "မတ်", "ဧ", "မေ", "ဇွန်", "ဇူ", "ဩ", "စက်", "အောက်", "နို", "ဒီ"];

const burmese = () => ltLanguage() === "mm";

/** "2026-10-31" → [2026, 10, 31]. Draw dates are calendar dates in Myanmar time, never instants. */
export function ymd(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-");
  return [Number(y), Number(m), Number(d)];
}

/** 1000 → "1,000". */
export function group(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 1000 → "1,000 Ks" (the spec's only money format). */
export function ks(n: number): string {
  return `${group(n)} Ks`;
}

/**
 * A draw's exchange rate as "1 Baht = 120 Ks" / "1 Baht = 118.25 Ks" (Burmese
 * "1 ဘတ် = 120 Ks"): up to four decimals (the server's Decimal(12,4)),
 * trailing zeros dropped, only the whole part grouped.
 */
export function rateLabel(ksPerBaht: number): string {
  const fixed = Number(ksPerBaht.toFixed(4)).toString();
  const [whole, frac] = fixed.split(".");
  return `1 ${burmese() ? "ဘတ်" : "Baht"} = ${group(Number(whole))}${frac ? `.${frac}` : ""} Ks`;
}

/** "372694" → "3 7 2 6 9 4": how a screen reader must hear every lottery number. */
export function spaced(s: string): string {
  return s.split("").join(" ");
}

/** pad(8, 2) → "08". */
export function pad(n: number | string, k: number): string {
  return String(n).padStart(k, "0");
}

/** 2026 → "၂၀၂၆". */
export function myNum(n: number | string): string {
  return String(n).replace(/[0-9]/g, (d) => MY_DIGITS.charAt(Number(d)));
}

/** The ticket's Burmese date: "၂၀၂၆ ခုနှစ် အောက်တိုဘာလ ၃၁ ရက်". */
export function dateMy(iso: string): string {
  const [y, m, d] = ymd(iso);
  return `${myNum(y)} ခုနှစ် ${MY_MONTHS[m - 1]}လ ${myNum(d)} ရက်`;
}

/** The ticket's English date: "31 OCTOBER 2026". */
export function dateEn(iso: string): string {
  const [y, m, d] = ymd(iso);
  return `${d} ${EN_MONTHS[m - 1]} ${y}`;
}

function dayIndex(iso: string): number {
  const [y, m, d] = ymd(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** "Saturday" / "စနေနေ့" — the day of the week a calendar date falls on. */
export function weekday(iso: string): string {
  const i = dayIndex(iso);
  return burmese() ? `${MY_DAYS[i]}နေ့` : EN_DAYS[i];
}

/** "Sat" / "စနေ" — the short weekday of the rows. */
function weekdayShort(iso: string): string {
  const i = dayIndex(iso);
  return burmese() ? MY_DAYS[i] : EN_DAYS[i].slice(0, 3);
}

/** "October" / "အောက်တိုဘာ". */
function monthWord(m: number): string {
  if (burmese()) return MY_MONTHS[m - 1];
  const word = EN_MONTHS[m - 1];
  return word.charAt(0) + word.slice(1).toLowerCase();
}

/** "Oct" / "အောက်တိုဘာ" — Burmese has no clipped month in running text, so it keeps the whole name. */
function monthAbbr(m: number): string {
  return burmese() ? MY_MONTHS[m - 1] : monthWord(m).slice(0, 3);
}

/** "Saturday 31 October 2026" / "စနေနေ့၊ 31 အောက်တိုဘာ 2026". */
export function dateLong(iso: string): string {
  const [y, m, d] = ymd(iso);
  return burmese() ? `${weekday(iso)}၊ ${d} ${monthWord(m)} ${y}` : `${weekday(iso)} ${d} ${monthWord(m)} ${y}`;
}

/** "Sat 17 Oct 2026" / "စနေ 17 အောက်တိုဘာ 2026". */
export function dateShort(iso: string): string {
  const [y, m, d] = ymd(iso);
  return `${weekdayShort(iso)} ${d} ${monthAbbr(m)} ${y}`;
}

/** The date stamp's month: "Oct" / "အောက်" (the calendar abbreviation — the stamp is narrow). */
export function monthShort(iso: string): string {
  const m = ymd(iso)[1];
  return burmese() ? MY_MONTHS_SHORT[m - 1] : monthWord(m).slice(0, 3);
}

/** The date stamp's day: "31". */
export function dayOf(iso: string): string {
  return String(ymd(iso)[2]);
}

/* ---------- instants, shown in Myanmar time ---------- */

/** An ISO instant's calendar date and wall clock in Myanmar time; null when the string is not a date. */
export function myanmarParts(iso: string): { dateIso: string; hours: number; minutes: number } | null {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms + MYANMAR_UTC_OFFSET_MINUTES * 60_000);
  const dateIso = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1, 2)}-${pad(d.getUTCDate(), 2)}`;
  return { dateIso, hours: d.getUTCHours(), minutes: d.getUTCMinutes() };
}

/**
 * 19:02 → "7:02 PM" (the boards' twelve-hour clock, no leading zero on the
 * hour). Burmese names the part of the day first, as people say it:
 * နံနက် (morning, to noon), နေ့လယ် (midday, 12–3), ညနေ (evening, 3–7),
 * ည (night, from 7) — 19:02 → "ည 7:02".
 */
export function clock12(hours: number, minutes: number): string {
  const h = hours % 12 || 12;
  if (!burmese()) return `${h}:${pad(minutes, 2)} ${hours < 12 ? "AM" : "PM"}`;
  const part = hours < 12 ? "နံနက်" : hours < 15 ? "နေ့လယ်" : hours < 19 ? "ညနေ" : "ည";
  return `${part} ${h}:${pad(minutes, 2)}`;
}

/** An instant's Myanmar calendar date, "2026-10-26"; the string itself when it will not parse. */
export function myanmarDateIso(iso: string): string {
  return myanmarParts(iso)?.dateIso ?? iso.slice(0, 10);
}

/** An instant as "7:02 PM" Myanmar time. */
export function timeLabel(iso: string): string {
  const parts = myanmarParts(iso);
  return parts ? clock12(parts.hours, parts.minutes) : "";
}

/** The list comma: "," in English, "၊" in Burmese. */
const comma = () => (burmese() ? "၊" : ",");

/** An instant as the rows print it: "Mon 26 Oct 2026, 7:02 PM" (Myanmar time). */
export function dateTimeLabel(iso: string): string {
  const parts = myanmarParts(iso);
  return parts ? `${dateShort(parts.dateIso)}${comma()} ${clock12(parts.hours, parts.minutes)}` : iso;
}

/** An instant without the year, as a ticket's bought line prints it: "Tue 27 Oct, 10:41 AM" (Myanmar time). */
export function dayTimeLabel(iso: string): string {
  const parts = myanmarParts(iso);
  if (!parts) return iso;
  const [, m, d] = ymd(parts.dateIso);
  return `${weekdayShort(parts.dateIso)} ${d} ${monthAbbr(m)}${comma()} ${clock12(parts.hours, parts.minutes)}`;
}

/** An instant's day header: "Wednesday 28 October 2026" (Myanmar time). */
export function dayLabel(iso: string): string {
  return dateLong(myanmarDateIso(iso));
}

/** An instant's Myanmar calendar date without the weekday: "15 Jan 2027" (the claim deadline's day). */
export function dateDMY(iso: string): string {
  const parts = myanmarParts(iso);
  if (!parts) return "";
  const [y, m, d] = ymd(parts.dateIso);
  return `${d} ${monthAbbr(m)} ${y}`;
}

/** An instant as the claim block's short stamp: "24 Oct, 10:12 AM" (Myanmar time; the year is plain from the page). */
export function dateTimeShort(iso: string): string {
  const parts = myanmarParts(iso);
  if (!parts) return "";
  const [, m, d] = ymd(parts.dateIso);
  return `${d} ${monthAbbr(m)}${comma()} ${clock12(parts.hours, parts.minutes)}`;
}

/** An instant in running copy: "24 Oct 2026 at 3:40 PM" / "24 အောက်တိုဘာ 2026၊ ညနေ 3:40" (Myanmar time). */
export function dateAtTime(iso: string): string {
  const parts = myanmarParts(iso);
  if (!parts) return "";
  return burmese()
    ? `${dateDMY(iso)}၊ ${clock12(parts.hours, parts.minutes)}`
    : `${dateDMY(iso)} at ${clock12(parts.hours, parts.minutes)}`;
}

/** Whole days from one instant to another, rounded ("90 days after the results were published"); null when either will not parse. */
export function daysBetween(fromIso: string, toIso: string): number | null {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.round((to - from) / 86_400_000);
}

/**
 * A ticket's accessible label (recipe §4 `ariaLabel`):
 * "Ticket number 3 7 2 6 9 4. Draw 24, Saturday 31 October 2026. Ticket ID MFL-24-000184."
 * Without a ticket ID (a preview before buying) the last sentence is left out.
 */
export function ticketA11y(drawNo: number, dateIso: string, ticketId: string | undefined, number: string): string {
  if (burmese()) {
    const id = ticketId ? ` လက်မှတ် ID ${ticketId}။` : "";
    return `ထီလက်မှတ် နံပါတ် ${spaced(number)}။ ပွဲစဉ် ${drawNo}၊ ${dateLong(dateIso)}။${id}`;
  }
  const id = ticketId ? ` Ticket ID ${ticketId}.` : "";
  return `Ticket number ${spaced(number)}. Draw ${drawNo}, ${dateLong(dateIso)}.${id}`;
}

/** "1 ticket" / "3 tickets" — Burmese "လက်မှတ် 3 စောင်" (one count word, no plural). */
export function nTickets(n: number): string {
  if (burmese()) return `လက်မှတ် ${group(n)} စောင်`;
  return n === 1 ? "1 ticket" : `${n} tickets`;
}
