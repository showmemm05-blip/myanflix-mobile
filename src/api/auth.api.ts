import { apiClient } from "@/api/client";
import type { AuthUser, OtpPurpose } from "@/types/user";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export type OtpVerifyResponse = { user: AuthUser } & AuthTokens;

/**
 * POST /auth/otp/request's body, mirrored from
 * backend/src/auth/dto/request-otp.dto.ts, which declares these two
 * properties and nothing else.
 */
type RequestOtpBody = { phone: string; purpose?: OtpPurpose };

/**
 * The guard that makes "exactly `{ phone, purpose? }`" a BUILD failure rather
 * than a comment two files are asked to respect.
 *
 * This project has no test runner (no jest/vitest, no `test` script, no spec
 * files), so `npm run typecheck` is the gate everything has to pass — and this
 * is written to fail it. The `Record<Exclude<keyof T, keyof RequestOtpBody>,
 * never>` half is what earns its keep: a bare `{ phone, channel }` literal is
 * already caught by excess-property checking, but an object assembled
 * elsewhere and passed in, or spread in, is NOT. Here every key of `T` outside
 * `RequestOtpBody` resolves to `never`, which no value can satisfy, so all
 * three spellings are errors.
 *
 * Why it matters: backend/src/app.module.ts registers the global
 * ValidationPipe with `forbidNonWhitelisted: true`, so an unknown property is
 * REJECTED, not stripped. One extra key here 400s every OTP request for every
 * user — there is no partial failure and no slow rollout. A delivery
 * channel (Telegram, Viber — see components/auth/OtpMethodPicker.tsx) is the
 * field most likely to be added by reflex; it must not be sent until the
 * backend DTO and a real delivery service ship first.
 */
function exactRequestOtpBody<
  T extends RequestOtpBody & Record<Exclude<keyof T, keyof RequestOtpBody>, never>,
>(body: T): RequestOtpBody {
  return body;
}

export const authApi = {
  checkPhoneExists(phone: string) {
    return apiClient.post<{ exists: boolean }>("/auth/phone/check", { phone }, { skipAuth: true });
  },

  /**
   * Step 2 for a returning phone. `stepToken` is the server's proof that the
   * password step passed: POST /auth/otp/verify refuses an existing account
   * without it (audit H-6), so "password, then code" is enforced by the
   * server rather than by this screen. It lives 10 minutes and is voided by
   * any password change. Keep it in component memory only — never store it.
   */
  verifyPhonePassword(phone: string, password: string) {
    return apiClient.post<{ valid: boolean; stepToken: string }>(
      "/auth/phone/verify-password",
      { phone, password },
      { skipAuth: true },
    );
  },

  /**
   * The body is EXACTLY `{ phone, purpose? }` and must stay that way. The
   * backend's RequestOtpDto declares only those two, and the global
   * ValidationPipe runs with `forbidNonWhitelisted: true` — an unknown
   * property is rejected, not stripped, so adding (say) the sign-in screen's
   * chosen OTP channel here makes every OTP request 400 and stops sign-in
   * dead. Both stay bare parameters rather than an options object, so there
   * is no comfortable slot to drop an extra field into. See the comment on
   * exactRequestOtpBody above.
   *
   * Sign-in passes no purpose, so its body is still exactly `{ phone }`
   * (JSON drops the undefined key). "password_reset" is refused with 400 "No
   * account was found for this phone number." — before any code is created —
   * when the number has no customer account.
   *
   * `exactRequestOtpBody` above enforces this at compile time — the body goes
   * through it rather than straight into `post`, whose `data` is `unknown` and
   * would accept anything.
   */
  requestOtp(phone: string, purpose?: OtpPurpose) {
    return apiClient.post<{ sent: boolean }>(
      "/auth/otp/request",
      exactRequestOtpBody({ phone, purpose }),
      { skipAuth: true },
    );
  },

  /**
   * `password` is only meaningful (and required by the backend) when this
   * phone has no account yet; `stepToken` is required when it HAS one (from
   * verifyPhonePassword above). Without it the server answers 401 "Please
   * enter your password again." before it even looks at the code. Undefined
   * keys are dropped by JSON serialisation, so each branch sends only its own.
   */
  verifyOtp(phone: string, code: string, password?: string, stepToken?: string) {
    return apiClient.post<OtpVerifyResponse>(
      "/auth/otp/verify",
      { phone, code, password, stepToken },
      { skipAuth: true },
    );
  },

  /**
   * "Forgot password" (audit H-8), on the same OTP service as sign-in: the
   * code comes from `requestOtp` above with purpose "password_reset" (a
   * sign-in code is refused here). On success every session of the account is
   * signed out and NO new one is opened — the user then signs in normally
   * with the new password. Customer accounts only.
   */
  resetPassword(phone: string, code: string, newPassword: string) {
    return apiClient.post<{ reset: boolean }>(
      "/auth/password/reset",
      { phone, code, newPassword },
      { skipAuth: true },
    );
  },

  /*
   * There is deliberately NO `refresh` here. The refresh lives in api/client.ts
   * and must stay there: it is issued with a bare `axios.post`, outside this
   * instance, so it cannot recurse through the very 401 handler it exists to
   * escape. A helper on this object would route it straight back in.
   * `AuthTokens` above stays — OtpVerifyResponse intersects it.
   */

  logout(refreshToken: string) {
    return apiClient.post<{ loggedOut: true }>("/auth/logout", { refreshToken }, { skipAuth: true });
  },
};
