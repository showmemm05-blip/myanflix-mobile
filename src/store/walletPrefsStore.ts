import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface WalletPrefsState {
  /** Masks the wallet's money figures on this device ("•••••• Ks"). */
  balanceHidden: boolean;
  toggleBalanceHidden: () => void;
}

/**
 * AsyncStorage with every call made safe. A failed read comes back as "nothing
 * stored" (so the default, shown, wins) and a failed write is dropped: losing
 * this preference is harmless, an unhandled rejection out of a tap is not.
 */
const safeStorage: StateStorage = {
  getItem: async (name) => {
    try {
      return await AsyncStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: async (name, value) => {
    try {
      await AsyncStorage.setItem(name, value);
    } catch {
      // A preference that could not be saved simply resets on next launch.
    }
  },
  removeItem: async (name) => {
    try {
      await AsyncStorage.removeItem(name);
    } catch {
      // Same: nothing to recover.
    }
  },
};

/**
 * The wallet's "hide my balance" switch — a non-sensitive DEVICE preference
 * (it hides figures from someone looking over a shoulder; the data itself is
 * still fetched), so AsyncStorage, not SecureStore (kept for tokens).
 *
 * Nothing waits for hydration: the default is "shown", and a cold start that
 * paints the balance for a frame before the stored "hidden" lands is accepted.
 * Gating paint on persist.hasHydrated() is exactly what store/languageStore.ts
 * warns about — it never settles when the storage read rejects.
 */
export const useWalletPrefsStore = create<WalletPrefsState>()(
  persist(
    (set) => ({
      balanceHidden: false,
      toggleBalanceHidden: () => set((state) => ({ balanceHidden: !state.balanceHidden })),
    }),
    {
      name: "myanflix-wallet-prefs",
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({ balanceHidden: state.balanceHidden }),
      // The stored blob comes back unvalidated; only a real boolean may flip it.
      merge: (persisted, current) => {
        const stored = (persisted as { balanceHidden?: unknown } | null | undefined)?.balanceHidden;
        return typeof stored === "boolean" ? { ...current, balanceHidden: stored } : current;
      },
    },
  ),
);
