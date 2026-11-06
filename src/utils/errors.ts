/**
 * What a coded refusal adds next to `message` in the error envelope
 * (`{ success: false, message, code, ...extra }` — backend
 * common/errors/coded-http.exception.ts). The withdrawal-code errors carry
 * the two timing fields; the Lottery's purchase refusals carry `details`
 * (which numbers are off sale, how many are left of a number, the balance);
 * every other error leaves all of them undefined.
 */
export interface ApiErrorDetails {
  /** A stable machine code to branch on — e.g. "WITHDRAWAL_CODE_WRONG", "LOTTERY_LIMIT_EXCEEDED". */
  code?: string;
  /** WITHDRAWAL_CODE_WRONG / _LOCKED: wrong tries left before the lock (0 while locked). */
  triesLeft?: number;
  /** WITHDRAWAL_CODE_LOCKED: when the lock opens again (ISO). */
  lockedUntil?: string;
  /** A coded refusal's own payload, as the server sent it; the caller checks its shape (hooks/useBuyTickets). */
  details?: unknown;
  /** Every other top-level field of the envelope (LOTTERY_SALES_CLOSED's `status`, LOTTERY_IDEMPOTENCY_MISMATCH's `ref`). */
  extra?: Record<string, unknown>;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  triesLeft?: number;
  lockedUntil?: string;
  details?: unknown;
  extra?: Record<string, unknown>;

  constructor(message: string, status: number, details: ApiErrorDetails = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = details.code;
    this.triesLeft = details.triesLeft;
    this.lockedUntil = details.lockedUntil;
    this.details = details.details;
    this.extra = details.extra;
  }
}

/**
 * The message to SHOW a user. Only an ApiError carries a string written for
 * them (api/client.ts phrases the network and session cases itself, and the
 * server's own body carries the rest); every other throw is a programming or
 * platform failure whose message is English, untranslated and meaningless
 * here — those get the caller's localized fallback. This is the rule the
 * sheets already apply inline; spelling it once keeps the auth flow, which is
 * this helper's only caller, from being the one screen that leaks a raw
 * JavaScript message into its error line.
 */
export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  return err instanceof ApiError ? err.message : fallback;
}

/**
 * The 503 POST /auth/otp/request answers when the code cannot be handed to
 * the SMS gateway phone right now (it has not checked in lately, or the day's
 * SMS cap is used up). Word for word the backend's text (sms.service.ts). No
 * code was kept, so the resend wait and the hourly limit are not spent.
 */
export const SMS_UNAVAILABLE_MESSAGE = "SMS service is temporarily unavailable. Please try again shortly.";

/**
 * True for that 503 — shared by the sign-in flow and the forgot-password
 * screen. Matched on the exact wording alone (the sentence is unique to it),
 * so a gateway in front of the API re-labelling the status cannot hide it.
 */
export function isSmsUnavailable(err: unknown): boolean {
  return err instanceof ApiError && err.message === SMS_UNAVAILABLE_MESSAGE;
}
