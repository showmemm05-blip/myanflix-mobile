/**
 * The 6-digit withdrawal code (backend src/withdrawal-code, approved
 * 2026-10-05). The server keeps only a hash and judges every code; nothing
 * here ever holds one beyond the screen that is typing it.
 */

/** GET /users/me/withdrawal-code, and the answer of every route that changes the code. */
export interface WithdrawalCodeStatus {
  hasCode: boolean;
  /** ISO time the 15-minute lock opens again; null when not locked. */
  lockedUntil: string | null;
  /** 0..5 — 0 while locked, 5 when there is no code yet. */
  triesLeft: number;
  maxTries: number;
  /** False when the account has no phone, so "Forgot code?" cannot text one. */
  canResetBySms: boolean;
}

/** POST /users/me/withdrawal-code/reset/request. */
export interface WithdrawalCodeResetRequested {
  sent: boolean;
  resendAfterSeconds: number;
  expiresInSeconds: number;
}

/** POST /users/me/withdrawal-code/reset/verify — a single-use 10-minute token for reset/confirm. */
export interface WithdrawalCodeResetVerified {
  resetToken: string;
  expiresInSeconds: number;
}

/** The stable `code` of every withdrawal-code refusal (backend withdrawal-code.errors.ts). */
export const WITHDRAWAL_CODE_ERROR = {
  NOT_SET: "WITHDRAWAL_CODE_NOT_SET",
  ALREADY_SET: "WITHDRAWAL_CODE_ALREADY_SET",
  REQUIRED: "WITHDRAWAL_CODE_REQUIRED",
  INVALID_FORMAT: "WITHDRAWAL_CODE_INVALID_FORMAT",
  WRONG: "WITHDRAWAL_CODE_WRONG",
  LOCKED: "WITHDRAWAL_CODE_LOCKED",
  TOO_EASY: "WITHDRAWAL_CODE_TOO_EASY",
  MISMATCH: "WITHDRAWAL_CODE_MISMATCH",
  SAME: "WITHDRAWAL_CODE_SAME",
  RESET_NO_PHONE: "WITHDRAWAL_CODE_RESET_NO_PHONE",
  RESET_SMS_INVALID: "WITHDRAWAL_CODE_RESET_SMS_INVALID",
  RESET_SMS_TOO_MANY: "WITHDRAWAL_CODE_RESET_SMS_TOO_MANY",
  RESET_EXPIRED: "WITHDRAWAL_CODE_RESET_EXPIRED",
} as const;

export type WithdrawalCodeErrorCode = (typeof WITHDRAWAL_CODE_ERROR)[keyof typeof WITHDRAWAL_CODE_ERROR];
