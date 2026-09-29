export type UserRole = "SUPER_ADMIN" | "ADMIN" | "USER";
/** CLOSED = the owner deleted the account (DELETE /users/me); it can never sign in again. */
export type UserStatus = "ACTIVE" | "SUSPENDED" | "BANNED" | "CLOSED";

/** Shape returned by GET /users/me. */
export interface AppUser {
  id: string;
  username: string;
  /**
   * The editable, human-facing name. Null until the account owner sets one —
   * `displayNameOf()` in utils/format.ts is what turns it into something to
   * render, falling back to the username.
   */
  displayName: string | null;
  /**
   * The login identity for end users (staff sign in with `username` instead),
   * which is why neither is editable from the profile sheet. Always present in
   * the response, null on an account that has none.
   */
  phone: string | null;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  balance: number;
  totalDeposited: number;
  totalSpent: number;
  moviesPurchased: number;
}

/** Shape returned inline by /auth/register and /auth/login (a smaller subset of AppUser). */
export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
}

/**
 * What a one-time code is for — backend/src/auth/dto/request-otp.dto.ts
 * OTP_REQUEST_PURPOSES. The server binds each code to its purpose: a sign-in
 * code is refused by POST /auth/password/reset and a reset code by POST
 * /auth/otp/verify. Omitted means "login".
 */
export type OtpPurpose = "login" | "password_reset";
