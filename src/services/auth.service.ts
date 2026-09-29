import { authApi } from "@/api/auth.api";
import { usersApi } from "@/api/users.api";
import { tokenStore } from "@/services/token-store";
import { profileService } from "@/services/profile.service";
import type { AppUser, OtpPurpose } from "@/types/user";

export const authService = {
  checkPhoneExists(phone: string) {
    return authApi.checkPhoneExists(phone);
  },

  /** Resolves with the server's `stepToken` — the proof step 3 must present for an existing account. */
  async verifyPhonePassword(phone: string, password: string): Promise<string> {
    const { stepToken } = await authApi.verifyPhonePassword(phone, password);
    return stepToken;
  },

  requestOtp(phone: string, purpose?: OtpPurpose) {
    return authApi.requestOtp(phone, purpose);
  },

  /** The moment the session actually starts — verifying the code either logs into an existing account or creates one. */
  async verifyOtp(phone: string, code: string, password?: string, stepToken?: string): Promise<AppUser> {
    const result = await authApi.verifyOtp(phone, code, password, stepToken);
    await tokenStore.setTokens(result.accessToken, result.refreshToken);
    // Only the tokens are persisted. The user is held in the auth store and
    // re-fetched on cold start, so there is nothing to write to SecureStore.
    return profileService.getProfile();
  },

  /** Opens no session: the user signs in afterwards with the new password. */
  async resetPassword(phone: string, code: string, newPassword: string): Promise<void> {
    await authApi.resetPassword(phone, code, newPassword);
  },

  /**
   * Closes the account on the server, then forgets this device's tokens. The
   * server has already revoked every session, so there is no /auth/logout to
   * send, and a failed keystore wipe is harmless: the next request with the
   * dead token 401s and the refresh path clears it.
   */
  async deleteAccount(): Promise<void> {
    await usersApi.deleteMe();
    await tokenStore.clear().catch(() => {});
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
