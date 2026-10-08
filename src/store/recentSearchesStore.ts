import { create } from "zustand";
import { useAuthStore } from "@/store/authStore";

/** How many past queries the list keeps (the boards' six chips). */
export const RECENT_SEARCH_LIMIT = 6;

interface RecentSearchesState {
  /** Newest first, no duplicates, at most RECENT_SEARCH_LIMIT. */
  terms: string[];
  /** Files a term at the front (moving it there if it was already listed). Blank terms are ignored. */
  remember: (term: string) => void;
  clear: () => void;
}

/**
 * The Media tab's recent searches. The search screen is its own route now,
 * mounted only while it is open, so the list cannot live in its state any
 * more: it has to outlive closing and reopening the screen.
 *
 * In memory only, on purpose — nothing is persisted or sent anywhere, so a
 * cold start opens with no recents, exactly as before. It IS emptied whenever
 * the signed-in account changes (sign-out, or another account signing in on
 * this phone): one person's searches must never be shown to the next.
 */
export const useRecentSearchesStore = create<RecentSearchesState>((set) => ({
  terms: [],
  remember: (term) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    set((state) => {
      if (state.terms[0] === trimmed) return state;
      return { terms: [trimmed, ...state.terms.filter((item) => item !== trimmed)].slice(0, RECENT_SEARCH_LIMIT) };
    });
  },
  clear: () => set((state) => (state.terms.length === 0 ? state : { terms: [] })),
}));

// Module scope, once: the auth store lives for the whole app session too.
useAuthStore.subscribe((state, previous) => {
  if (state.user?.id !== previous.user?.id) useRecentSearchesStore.getState().clear();
});
