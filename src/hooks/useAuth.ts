import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authService } from "@/services/auth.service";
import { tokenStore, onUnauthorized } from "@/services/token-store";
import { profileService } from "@/services/profile.service";
import { useAuthStore } from "@/store/authStore";

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

  /** Step 2 (returning phone): throws on a wrong password. */
  const verifyPassword = useCallback(async (phone: string, password: string) => {
    await authService.verifyPhonePassword(phone, password);
  }, []);

  /** Step 3: sends a code to `phone` — throws (e.g. cooldown/rate-limit) on failure. */
  const requestOtp = useCallback(async (phone: string) => {
    await authService.requestOtp(phone);
  }, []);

  /** Step 3: verifies the code, logging into the existing account or creating one — `password` required only when creating. */
  const verifyOtp = useCallback(
    async (phone: string, code: string, password?: string) => {
      const profile = await authService.verifyOtp(phone, code, password);
      setUser(profile);
    },
    [setUser],
  );

  const logout = useCallback(async () => {
    await authService.logout();
    clearUser();
    queryClient.clear();
  }, [clearUser, queryClient]);

  return {
    user,
    isAuthenticated,
    isBootstrapping,
    checkPhoneExists,
    verifyPassword,
    requestOtp,
    verifyOtp,
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
  const { setUser, clearUser, finishBootstrapping } = useAuthStore.getState();
  const token = await tokenStore.getAccessToken();

  if (token) {
    try {
      const profile = await profileService.getProfile();
      setUser(profile);
    } catch {
      await tokenStore.clear();
      clearUser();
    }
  }

  finishBootstrapping();
}

/** Wires api/client.ts's forced-logout signal to the auth store — call once at app root. */
export function subscribeToUnauthorized(): () => void {
  return onUnauthorized(() => {
    useAuthStore.getState().clearUser();
  });
}
