import { authApi } from "@/api/auth.api";
import { tokenStore } from "@/services/token-store";
import { profileService } from "@/services/profile.service";
import type { AppUser } from "@/types/user";

export const authService = {
  checkPhoneExists(phone: string) {
    return authApi.checkPhoneExists(phone);
  },

  verifyPhonePassword(phone: string, password: string) {
    return authApi.verifyPhonePassword(phone, password);
  },

  requestOtp(phone: string) {
    return authApi.requestOtp(phone);
  },

  /** The moment the session actually starts — verifying the code either logs into an existing account or creates one. */
  async verifyOtp(phone: string, code: string, password?: string): Promise<AppUser> {
    const result = await authApi.verifyOtp(phone, code, password);
    await tokenStore.setTokens(result.accessToken, result.refreshToken);
    // Only the tokens are persisted. The user is held in the auth store and
    // re-fetched on cold start, so there is nothing to write to SecureStore.
    return profileService.getProfile();
  },

  async logout(): Promise<void> {
    const refreshToken = await tokenStore.getRefreshToken();
    await tokenStore.clear();
    if (refreshToken) {
      // Fire-and-forget — don't block the UI logout on network.
      authApi.logout(refreshToken).catch(() => {});
    }
  },
};
