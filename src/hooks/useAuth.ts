import { useCallback } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { authService } from "@/services/auth.service";
import { tokenStore, onUnauthorized } from "@/services/token-store";
import { profileService } from "@/services/profile.service";
import { useAuthStore } from "@/store/authStore";
import { ApiError } from "@/utils/errors";
import type { OtpPurpose } from "@/types/user";

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);
  const setUser = useAuthStore((s) => s.setUser);
  const clearUser = useAuthStore((s) => s.clearUser);
  const queryClient = useQueryClient();

  /** Step 1: does an account already exist for this phone? */
  const checkPhoneExists = useCallback(async (phone: string) => {
    const { exists } = await authService.checkPhoneExists(phone);
    return exists;
  }, []);

  /**
   * Step 2 (returning phone): throws on a wrong password, resolves with the
   * `stepToken` step 3 must send. The caller keeps it in memory only.
   */
  const verifyPassword = useCallback(
    (phone: string, password: string) => authService.verifyPhonePassword(phone, password),
    [],
  );

  /**
   * Step 3: requests a code for `phone` — throws (e.g. cooldown/rate-limit) on
   * failure. `purpose` "password_reset" for the forgot-password flow; sign-in
   * leaves it out.
   */
  const requestOtp = useCallback(async (phone: string, purpose?: OtpPurpose) => {
    await authService.requestOtp(phone, purpose);
  }, []);

  /**
   * Step 3: verifies the code, logging into the existing account or creating
   * one — `password` only when creating, `stepToken` only when signing in.
   */
  const verifyOtp = useCallback(
    async (phone: string, code: string, credentials: { password?: string; stepToken?: string }) => {
      const profile = await authService.verifyOtp(phone, code, credentials.password, credentials.stepToken);
      setUser(profile);
    },
    [setUser],
  );

  /**
   * "Forgot password": sets a new password with a code from `requestOtp`.
   * Opens no session — the user signs in afterwards with the new password.
   */
  const resetPassword = useCallback(
    (phone: string, code: string, newPassword: string) => authService.resetPassword(phone, code, newPassword),
    [],
  );

  /**
   * Closes the account (throws, changing nothing, when the server refuses),
   * then leaves the app in exactly the state `logout` below leaves it in.
   */
  const deleteAccount = useCallback(async () => {
    await authService.deleteAccount();
    clearUser();
    queryClient.clear();
  }, [clearUser, queryClient]);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      // NEVER conditional on the SecureStore write succeeding: both
      // getRefreshToken() and clear() reject on a keystore error, and letting
      // that skip these two lines turns "Log out" into a silent no-op — the
      // user walks away from a shared device with a live session and the
      // wallet balance still on screen. If the token wipe really failed, the
      // 401 path clears it on the next request.
      clearUser();
      queryClient.clear();
    }
  }, [clearUser, queryClient]);

  return {
    user,
    isAuthenticated,
    isBootstrapping,
    checkPhoneExists,
    verifyPassword,
    requestOtp,
    verifyOtp,
    resetPassword,
    deleteAccount,
    logout,
  };
}

/**
 * Runs once at app boot (outside React, before the first render that needs
 * auth state) — checks for a persisted token and re-fetches the profile
 * rather than trusting any cached user shape, mirroring the web app's
 * AuthProvider mount effect.
 */
export async function bootstrapAuth(): Promise<void> {
  const { clearUser, finishBootstrapping } = useAuthStore.getState();
  try {
    await restoreSession();
  } catch {
    clearUser();
  } finally {
    // The boot gate MUST be released on every path — App.tsx renders null
    // until isBootstrapping is false, so an early throw here is a permanent
    // splash screen with no error and no retry.
    finishBootstrapping();
  }
}

/**
 * Turns saved tokens back into a signed-in user. Used at boot, and again by
 * the "can't reach MyanFlix" screen's Try again.
 *
 * Throws only when SecureStore itself rejects (it does not return null when a
 * stored value cannot be decrypted — a malformed envelope, or an iOS read
 * while the device is locked, is enough); bootstrapAuth treats that as signed
 * out.
 */
export async function restoreSession(): Promise<void> {
  const { setUser, clearUser, markSessionUnreachable } = useAuthStore.getState();
  const token = await tokenStore.getAccessToken();
  if (!token) {
    // No session to restore — the sign-in screen. (At boot this changes
    // nothing; from the offline screen it is the way out when the tokens have
    // gone meanwhile.)
    clearUser();
    return;
  }
  try {
    const profile = await profileService.getProfile();
    setUser(profile);
  } catch (err) {
    /**
     * Only a REJECTED session may delete the tokens. `request()` has
     * already spent the single-flight refresh on a 401 before throwing one,
     * so a 401/403 here means the refresh token is genuinely dead.
     * Anything else — status 0 (offline, DNS, captive portal, server down,
     * or a refresh that got no answer) or a 5xx — is a TRANSPORT failure, and
     * clearing on it wipes a perfectly valid session that would have worked a
     * minute later. Logging in again costs a password and an SMS OTP, so this
     * distinction matters: the tokens stay, and RootNavigator shows the
     * offline screen (with Try again) instead of the sign-in screen (H-20).
     */
    const status = err instanceof ApiError ? err.status : -1;
    if (status === 401 || status === 403) {
      await tokenStore.clear().catch(() => {});
      clearUser();
    } else {
      markSessionUnreachable();
    }
  }
}

/**
 * Wires api/client.ts's forced-logout signal to the auth store — call once at
 * app root.
 *
 * It must undo EXACTLY what the deliberate `logout` above undoes. An expired
 * session that only cleared the store left the previous account's cached
 * balance, favourites and watch history in the query cache, so signing in as a
 * different account showed the last user's numbers for the moment before each
 * query refetched. `clear()` the cache too, in the same order, so "your
 * session expired" and "log out" leave the app in one identical state.
 *
 * The client is PASSED IN rather than reached for: this callback lives outside
 * React (module scope, fired by an axios interceptor), where `useQueryClient`
 * cannot be called. App.tsx owns the single QueryClient instance — the same one
 * QueryClientProvider hands the hook above — and it is the only caller, so
 * handing it over there is the equivalent of `useAuthStore.getState()` here.
 */
export function subscribeToUnauthorized(queryClient: QueryClient): () => void {
  return onUnauthorized(() => {
    useAuthStore.getState().clearUser();
    queryClient.clear();
  });
}
