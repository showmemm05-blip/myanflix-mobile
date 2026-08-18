import { create } from "zustand";
import type { AppUser } from "@/types/user";

interface AuthState {
  user: AppUser | null;
  isAuthenticated: boolean;
  /** True until the app-boot token check + profile fetch has resolved. */
  isBootstrapping: boolean;
  setUser: (user: AppUser) => void;
  clearUser: () => void;
  finishBootstrapping: () => void;
}

// Not persisted directly — the source of truth on cold start is the tokens
// in SecureStore plus a fresh GET /users/me, not a cached copy of this store.
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isBootstrapping: true,
  setUser: (user) => set({ user, isAuthenticated: true }),
  clearUser: () => set({ user: null, isAuthenticated: false }),
  finishBootstrapping: () => set({ isBootstrapping: false }),
}));
