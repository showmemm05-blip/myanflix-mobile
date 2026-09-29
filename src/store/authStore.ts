import { create } from "zustand";
import type { AppUser } from "@/types/user";

interface AuthState {
  user: AppUser | null;
  isAuthenticated: boolean;
  /** True until the app-boot token check + profile fetch has resolved. */
  isBootstrapping: boolean;
  /**
   * A saved session exists but the server could not be reached to confirm it
   * (offline, timeout, 5xx). The tokens are kept, and RootNavigator shows the
   * "can't reach MyanFlix" screen with a retry instead of the sign-in screen
   * — signing in again would cost a password and an SMS code for nothing
   * (audit H-20). Any settled answer (setUser / clearUser) ends it.
   */
  sessionUnreachable: boolean;
  setUser: (user: AppUser) => void;
  clearUser: () => void;
  markSessionUnreachable: () => void;
  finishBootstrapping: () => void;
}

// Not persisted directly — the source of truth on cold start is the tokens
// in SecureStore plus a fresh GET /users/me, not a cached copy of this store.
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isBootstrapping: true,
  sessionUnreachable: false,
  setUser: (user) => set({ user, isAuthenticated: true, sessionUnreachable: false }),
  clearUser: () => set({ user: null, isAuthenticated: false, sessionUnreachable: false }),
  markSessionUnreachable: () => set({ sessionUnreachable: true }),
  finishBootstrapping: () => set({ isBootstrapping: false }),
}));
