import { useLanguageStore } from "@/store/languageStore";
import { translations, type Language, type TranslationShape } from "@/localization/translations";

interface UseLanguageResult {
  language: Language;
  setLanguage: (language: Language) => void;
  t: TranslationShape;
}

/**
 * No React Context wrapper needed — Zustand stores are already globally
 * accessible without one. This hook just derives the active dictionary
 * (`t`) from the persisted language, mirroring the web app's useLanguage().
 */
export function useLanguage(): UseLanguageResult {
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  return { language, setLanguage, t: translations[language] };
}

/** True once the persisted language preference has been read from AsyncStorage — gate splash-hide on this. */
export function hasLanguageHydrated(): boolean {
  return useLanguageStore.persist.hasHydrated();
}

export function onLanguageHydrated(callback: () => void): () => void {
  return useLanguageStore.persist.onFinishHydration(callback);
}
