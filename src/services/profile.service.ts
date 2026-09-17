import { usersApi } from "@/api/users.api";
import type { AppUser } from "@/types/user";

export const profileService = {
  getProfile(): Promise<AppUser> {
    return usersApi.getMe();
  },

  /**
   * Pass the TRIMMED name, or `null` to clear it — the two are different
   * instructions to the server and the caller owns that decision.
   *
   * Nothing is mirrored into SecureStore: the returned user goes straight into
   * the auth store, which every consumer subscribes to, and a cold start
   * re-fetches from the server rather than trusting a cached shape.
   */
  async updateProfile(displayName: string | null): Promise<AppUser> {
    return usersApi.updateMe(displayName);
  },

  uploadAvatar(form: FormData): Promise<AppUser> {
    return usersApi.uploadAvatar(form);
  },

  removeAvatar(): Promise<AppUser> {
    return usersApi.removeAvatar();
  },

  /**
   * Resolves on success; the `{ changed: true }` body carries nothing the app
   * needs. Existing sessions are deliberately left signed in by the backend,
   * so there is no token work to do here either.
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await usersApi.changePassword(currentPassword, newPassword);
  },
};
