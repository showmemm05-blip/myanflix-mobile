import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Language } from "@/localization/translations";

interface LanguageState {
  language: Language;
  setLanguage: (language: Language) => void;
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
    },
  ),
);
