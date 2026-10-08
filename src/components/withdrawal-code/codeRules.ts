import { AccessibilityInfo, Platform } from "react-native";
import type { TranslationShape } from "@/localization/translations";

/**
 * The withdrawal code's client-side rules — the approved design's own checks
 * (CreateCode / ChangeCode / ForgotCode .dc.html), repeated by the server
 * (backend withdrawal-code.rules.ts), whose verdict is the one that counts.
 * These only spare the user a round trip for a code that cannot pass.
 */

export const CODE_LENGTH = 6;

/** The board's 15-minute lock, used only when a LOCKED answer carries no `lockedUntil`. */
const FALLBACK_LOCK_MS = 15 * 60 * 1000;

/**
 * Too easy to guess: one digit six times; a straight run up or down
 * (wrapping through 0 only at the ends, so 567890 and 098765 count); a pair
 * three times; a group of three twice.
 */
export function isTooEasyCode(code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  if (/^(\d)\1{5}$/.test(code)) return true;
  if ("01234567890".includes(code) || "09876543210".includes(code)) return true;
  return /^(\d\d)\1\1$/.test(code) || /^(\d\d\d)\1$/.test(code);
}

/**
 * The account phone as the SMS step shows it: "09 •••• ••• 471". The
 * stored form is "+959…" (backend normalizePhone); only the local "09" and
 * the last three digits are shown, and the middle never says how long the
 * number is.
 */
export function maskPhone(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 5) return "09 •••• •••";
  const local = digits.startsWith("95") ? `0${digits.slice(2)}` : digits;
  return `${local.slice(0, 2)} •••• ••• ${local.slice(-3)}`;
}

/** Minutes until a lock opens, rounded up, 1..15 — the server's own rounding. */
export function minutesLeft(lockedUntil: number, now: number): number {
  return Math.min(FALLBACK_LOCK_MS / 60_000, Math.max(1, Math.ceil((lockedUntil - now) / 60_000)));
}

/**
 * When a lock opens, on this phone's clock: the server's `lockedUntil`, or
 * now + 15 minutes when the answer did not say. Never more than 15 minutes
 * away — a lock is never longer, so a phone whose clock runs slow still
 * shows "15 minutes", not "23". (A fast clock may open the keys early; the
 * server then simply answers LOCKED again, with the real time.)
 */
export function lockEnd(lockedUntil: string | null | undefined, now = Date.now()): number {
  const parsed = lockedUntil ? Date.parse(lockedUntil) : Number.NaN;
  return Number.isFinite(parsed) ? Math.min(parsed, now + FALLBACK_LOCK_MS) : now + FALLBACK_LOCK_MS;
}

export function lockedMessage(t: TranslationShape, lockedUntil: number, now: number): string {
  const minutes = minutesLeft(lockedUntil, now);
  return minutes === 1 ? t.withdrawalCode.lockedOne : t.withdrawalCode.locked.replace("{n}", String(minutes));
}

export function wrongMessage(t: TranslationShape, triesLeft: number): string {
  return triesLeft === 1 ? t.withdrawalCode.wrongOne : t.withdrawalCode.wrong.replace("{n}", String(triesLeft));
}

export function digitsEnteredLabel(t: TranslationShape, count: number): string {
  return t.withdrawalCode.digitsEntered.replace("{n}", String(count));
}

/**
 * The boards' `aria-live="polite"`: said after whatever the reader is
 * already saying (the key it just read out), never over it. iOS queues the
 * announcement; Android's announcements are already polite.
 */
export function announcePolite(message: string) {
  if (!message) return;
  if (Platform.OS === "ios") {
    AccessibilityInfo.announceForAccessibilityWithOptions(message, { queue: true });
  } else {
    AccessibilityInfo.announceForAccessibility(message);
  }
}
