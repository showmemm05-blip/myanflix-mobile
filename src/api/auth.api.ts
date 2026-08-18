import { apiClient } from "@/api/client";
import type { AuthUser } from "@/types/user";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export type OtpVerifyResponse = { user: AuthUser } & AuthTokens;

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

  requestOtp(phone: string) {
    return apiClient.post<{ sent: boolean }>("/auth/otp/request", { phone }, { skipAuth: true });
  },

  /** `password` is only meaningful (and required by the backend) when this phone has no account yet. */
  verifyOtp(phone: string, code: string, password?: string) {
    return apiClient.post<OtpVerifyResponse>("/auth/otp/verify", { phone, code, password }, { skipAuth: true });
  },

  refresh(refreshToken: string) {
    return apiClient.post<AuthTokens>("/auth/refresh", { refreshToken }, { skipAuth: true });
  },

  logout(refreshToken: string) {
    return apiClient.post<{ loggedOut: true }>("/auth/logout", { refreshToken }, { skipAuth: true });
  },
};
