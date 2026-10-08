import type { TranslationShape } from "@/localization/translations";
import { ApiError, isSmsUnavailable } from "@/utils/errors";
import { WITHDRAWAL_CODE_ERROR as E } from "@/types/withdrawal-code";
import { lockEnd, lockedMessage, wrongMessage } from "@/components/withdrawal-code/codeRules";

/**
 * A withdrawal-code refusal, read from the error's stable `code` (never from
 * its English wording) — the screens decide where each one belongs.
 */
export type CodeFailure =
  | { kind: "wrong"; triesLeft: number }
  | { kind: "locked"; until: number }
  | { kind: "notSet" }
  | { kind: "alreadySet" }
  | { kind: "required" }
  | { kind: "invalidFormat" }
  | { kind: "tooEasy" }
  | { kind: "mismatch" }
  | { kind: "same" }
  | { kind: "noPhone" }
  | { kind: "smsInvalid" }
  | { kind: "smsTooMany" }
  | { kind: "resetExpired" };

/**
 * "Wrong code. 4 tries left." — the count from the body, else from the
 * message. The contract always sends it; if neither has it, the cautious
 * reading is the last try, which steers toward "Forgot code?" rather than
 * promising tries that may not be there.
 */
function triesFrom(err: ApiError): number {
  if (typeof err.triesLeft === "number") return err.triesLeft;
  const match = /(\d+)\s+tr(?:y|ies)\s+left/i.exec(err.message);
  return match ? Number(match[1]) : 1;
}

export function readCodeFailure(err: unknown): CodeFailure | null {
  if (!(err instanceof ApiError) || !err.code) return null;
  switch (err.code) {
    case E.WRONG:
      return { kind: "wrong", triesLeft: triesFrom(err) };
    case E.LOCKED:
      return { kind: "locked", until: lockEnd(err.lockedUntil) };
    case E.NOT_SET:
      return { kind: "notSet" };
    case E.ALREADY_SET:
      return { kind: "alreadySet" };
    case E.REQUIRED:
      return { kind: "required" };
    case E.INVALID_FORMAT:
      return { kind: "invalidFormat" };
    case E.TOO_EASY:
      return { kind: "tooEasy" };
    case E.MISMATCH:
      return { kind: "mismatch" };
    case E.SAME:
      return { kind: "same" };
    case E.RESET_NO_PHONE:
      return { kind: "noPhone" };
    case E.RESET_SMS_INVALID:
      return { kind: "smsInvalid" };
    case E.RESET_SMS_TOO_MANY:
      return { kind: "smsTooMany" };
    case E.RESET_EXPIRED:
      return { kind: "resetExpired" };
    default:
      return null;
  }
}

/**
 * The 409 OtpService answers inside the 60-second resend wait — a reset code
 * for this account went out less than a minute ago, so it is still good.
 */
export function isResendWait(err: unknown): boolean {
  return err instanceof ApiError && err.status === 409 && /wait before requesting/i.test(err.message);
}

/**
 * Everything that is not a coded refusal, in the user's language: no
 * connection, the request throttle, and the SMS system's own answers (the
 * same ones the sign-in and forgot-password screens translate). Anything
 * else gets the caller's fallback — a raw server sentence is never shown.
 */
export function plainErrorMessage(err: unknown, t: TranslationShape, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  if (err.status === 0) return t.common.networkError;
  if (err.status === 429) return t.auth.forgotPassword.rateLimited;
  if (isSmsUnavailable(err)) return t.auth.otp.smsUnavailable;
  if (isResendWait(err)) return t.auth.otp.waitForCode;
  if (/too many code requests/i.test(err.message)) return t.auth.otp.tooManyCodes;
  if (/valid myanmar phone/i.test(err.message)) return t.withdrawalCode.smsPhoneInvalid;
  return fallback;
}

/** The words for a refusal that has no special place on the screen showing it. */
export function failureText(failure: CodeFailure, t: TranslationShape): string {
  const w = t.withdrawalCode;
  switch (failure.kind) {
    case "wrong":
      return wrongMessage(t, failure.triesLeft);
    case "locked":
      return lockedMessage(t, failure.until, Date.now());
    case "notSet":
      return w.notSet;
    case "alreadySet":
      return w.alreadySet;
    case "required":
      return w.required;
    case "invalidFormat":
      return w.invalidFormat;
    case "tooEasy":
      return w.tooEasy;
    case "mismatch":
      return w.mismatch;
    case "same":
      return w.same;
    case "noPhone":
      return w.noPhone;
    case "smsInvalid":
      return w.smsWrong;
    case "smsTooMany":
      return w.smsTooMany;
    case "resetExpired":
      return w.resetExpired;
  }
}
