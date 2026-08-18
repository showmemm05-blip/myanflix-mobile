import { en } from "./en";
import { mm } from "./mm";

export const translations = { en, mm };
export type Language = keyof typeof translations;
export type { TranslationShape } from "./en";
