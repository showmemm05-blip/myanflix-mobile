import { apiClient } from "@/api/client";
import type { AppUser } from "@/types/user";

export const usersApi = {
  getMe() {
    return apiClient.get<AppUser>("/users/me");
  },

  /**
   * Only `displayName` goes in the body — the backend's global ValidationPipe
   * runs with `forbidNonWhitelisted`, so an extra key is a 400 rather than a
   * silently ignored field. `null` clears the name back to unset; `""` is a
   * 400 (it is trimmed, then fails the 1..40 length rule).
   *
   * The response is the same full shape as GET /users/me, wallet totals
   * included, so the caller can replace its stored user wholesale.
   */
  updateMe(displayName: string | null) {
    return apiClient.patch<AppUser>("/users/me", { displayName });
  },

  /**
   * The FormData is built by services/photo-picker.ts — it is the only place
   * that knows what the picker returned. Field name "file", 5 MB cap and the
   * JPEG/PNG/WebP allowlist are all enforced server-side too.
   *
   * Both avatar routes answer with the same full GET /users/me shape (the
   * controller's `toResponse`), with `avatarUrl` already derived from the newly
   * stored key, so the caller replaces its stored user wholesale.
   */
  uploadAvatar(form: FormData) {
    return apiClient.postMultipart<AppUser>("/users/me/avatar", form);
  },

  /** Returns a body, so it is NOT the 204 case the client documents. */
  removeAvatar() {
    return apiClient.delete<AppUser>("/users/me/avatar");
  },

  changePassword(currentPassword: string, newPassword: string) {
    return apiClient.patch<{ changed: boolean }>("/users/me/password", { currentPassword, newPassword });
  },

  /**
   * Closes the caller's own account (audit H-16). Refused with 409 while the
   * wallet holds money or a deposit/withdrawal is waiting for review (the
   * message says which), and with 403 for a staff account. On success the
   * personal data is anonymised, every session is revoked and the money
   * records are kept.
   */
  deleteMe() {
    return apiClient.delete<{ deleted: boolean }>("/users/me");
  },
};
