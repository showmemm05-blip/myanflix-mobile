import { useMutation } from "@tanstack/react-query";
import { profileService } from "@/services/profile.service";
import { useAuthStore } from "@/store/authStore";

/**
 * The signed-in user is not a React Query entry — it lives in the zustand auth
 * store, and every screen that shows a name reads it from there. So the way a
 * rename reaches the profile hero, the top-bar avatar, the wallet card and the
 * comment composer is one store write, not an invalidation.
 *
 * The response is the full GET /users/me shape, so it REPLACES the stored user
 * rather than being merged into it: hand-merging `{ ...user, displayName }`
 * would drift from whatever the server actually stored (it trims). Nothing
 * money-related changed, so no wallet query is invalidated either.
 */
export function useUpdateProfile() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (displayName: string | null) => profileService.updateProfile(displayName),
    onSuccess: (updated) => setUser(updated),
  });
}

/**
 * Same one-store-write rule as the rename above, and for the same reason: the
 * only readers of `avatarUrl` — the profile hero, the top-bar button and the
 * comment composer — all subscribe to the auth store, so `setUser` is what
 * repaints them. There is no `/users/me` query to invalidate and nothing
 * money-related changed.
 */
export function useUploadAvatar() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (form: FormData) => profileService.uploadAvatar(form),
    onSuccess: (updated) => setUser(updated),
  });
}

/** The mirror of the upload; the response carries `avatarUrl: null`. */
export function useRemoveAvatar() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: () => profileService.removeAvatar(),
    onSuccess: (updated) => setUser(updated),
  });
}

/**
 * Nothing to refresh: the backend deliberately leaves every existing session
 * signed in on a password change, so no token, no cached view and no store
 * slice is affected by a success.
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      profileService.changePassword(currentPassword, newPassword),
  });
}
