import { apiClient } from "@/api/client";
import type { AuthUser } from "@/types/user";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export type OtpVerifyResponse = { user: AuthUser } & AuthTokens;

/**
 * POST /auth/otp/request's body, mirrored from
 * backend/src/auth/dto/request-otp.dto.ts, which declares this one property
 * and nothing else.
 */
type RequestOtpBody = { phone: string };

/**
 * The guard that makes "exactly `{ phone }`" a BUILD failure rather than a
 * comment two files are asked to respect.
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
 * user — there is no partial failure and no slow rollout. The OTP channel
 * picker's remembered choice (src/store/authPrefsStore.ts) is the field most
 * likely to be added by reflex; it must stay on the device until the backend
 * DTO and a real delivery service ship first.
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

  verifyPhonePassword(phone: string, password: string) {
    return apiClient.post<{ valid: boolean }>(
      "/auth/phone/verify-password",
      { phone, password },
      { skipAuth: true },
    );
  },

  /**
   * The body is EXACTLY `{ phone }` and must stay that way. The backend's
   * RequestOtpDto declares only `phone`, and the global ValidationPipe runs
   * with `forbidNonWhitelisted: true` — an unknown property is rejected, not
   * stripped, so adding (say) the sign-in screen's chosen OTP channel here
   * makes every OTP request 400 and stops sign-in dead. `phone` also stays a
   * bare string parameter rather than an options object, so there is no
   * comfortable slot to drop an extra field into. See the long comment in
   * components/auth/OtpChannelPicker.tsx.
   *
   * `exactRequestOtpBody` above enforces this at compile time — the body goes
   * through it rather than straight into `post`, whose `data` is `unknown` and
   * would accept anything.
   */
  requestOtp(phone: string) {
    return apiClient.post<{ sent: boolean }>(
      "/auth/otp/request",
      exactRequestOtpBody({ phone }),
      { skipAuth: true },
    );
  },

  /** `password` is only meaningful (and required by the backend) when this phone has no account yet. */
  verifyOtp(phone: string, code: string, password?: string) {
    return apiClient.post<OtpVerifyResponse>("/auth/otp/verify", { phone, code, password }, { skipAuth: true });
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
