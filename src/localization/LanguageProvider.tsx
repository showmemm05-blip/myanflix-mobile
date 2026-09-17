import { useLanguageStore, hasLanguageSettled, onLanguageSettled } from "@/store/languageStore";
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
  // The stored value comes back from AsyncStorage unvalidated (zustand's
  // persist merges it as-is). `t` is destructured by every screen, so an
  // unknown code would be a TypeError on first render rather than a missing
  // string — fall back to the default dictionary instead.
  return { language, setLanguage, t: translations[language] ?? translations.mm };
}

/**
 * True once the persisted language read has FINISHED — succeeded or failed.
 * Splash-hide is gated on this, so it deliberately does not use zustand's
 * persist.hasHydrated()/onFinishHydration(), which never fire when the
 * AsyncStorage read rejects and would leave the app on the splash screen
 * forever. See the comment in store/languageStore.ts.
 */
export const hasLanguageHydrated = hasLanguageSettled;

export const onLanguageHydrated = onLanguageSettled;
