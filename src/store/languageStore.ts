import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Language } from "@/localization/translations";

interface LanguageState {
  language: Language;
  setLanguage: (language: Language) => void;
}

/**
 * Our own "the read has finished, one way or the other" flag.
 *
 * zustand's persist.hasHydrated() stays FALSE FOREVER when the AsyncStorage
 * read REJECTS: in zustand/esm/middleware.mjs the `.then` branch sets the flag
 * and fires the finish-hydration listeners, and the `.catch` branch does
 * neither — it only calls onRehydrateStorage with the error. App.tsx gates
 * first paint on that flag, so a corrupt RKStorage database or a non-JSON
 * stored blob (persistStorage.getItem parses inside the promise) meant a
 * permanent splash screen whose only cure was reinstalling.
 *
 * Do not "simplify" this back to persist.hasHydrated(). The default state
 * ("mm") is already correct for the failure path, so settling on an error
 * costs nothing but a preference the read could not return anyway.
 */
let languageSettled = false;
const settledListeners = new Set<() => void>();

function markLanguageSettled() {
  if (languageSettled) return;
  languageSettled = true;
  settledListeners.forEach((cb) => cb());
  settledListeners.clear();
}

export function hasLanguageSettled(): boolean {
  return languageSettled;
}

export function onLanguageSettled(callback: () => void): () => void {
  if (languageSettled) {
    callback();
    return () => {};
  }
  settledListeners.add(callback);
  return () => {
    settledListeners.delete(callback);
  };
}

// Default is "mm" per requirement, persisted across app restarts —
// non-sensitive preference, AsyncStorage is fine (unlike auth tokens).
export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: "mm",
      setLanguage: (language) => set({ language }),
    }),
    {
      name: "myanflix-language",
      storage: createJSONStorage(() => AsyncStorage),
      // Fires on BOTH paths, success and error — that is the whole point.
      onRehydrateStorage: () => () => markLanguageSettled(),
    },
  ),
);
