import { useFonts } from "expo-font";
import {
  Literata_400Regular,
  Literata_400Regular_Italic,
  Literata_700Bold,
  Literata_700Bold_Italic,
} from "@expo-google-fonts/literata";
import { NotoSerifMyanmar_400Regular, NotoSerifMyanmar_700Bold } from "@expo-google-fonts/noto-serif-myanmar";
import {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_400Regular_Italic,
  AtkinsonHyperlegible_700Bold,
  AtkinsonHyperlegible_700Bold_Italic,
} from "@expo-google-fonts/atkinson-hyperlegible";
import { theme } from "@/theme";
import type { ReaderFontFamily } from "@/store/readerPrefsStore";

/**
 * The text reader's typeface map. Faces are chosen PER TEXT NODE by script
 * (RichText's containsMyanmar): Latin runs get the family's Latin face,
 * Myanmar runs a Myanmar-capable one.
 *
 * Honest note: no dyslexia-specific Myanmar face exists — Burmese falls back
 * to Noto Sans Myanmar under both "sans" and "dyslexic". Stated here, not in
 * the UI.
 */
export interface ReaderFontFaces {
  /**
   * Italic faces are optional and Latin-only (neither Noto Myanmar family
   * ships italics — Burmese type has no italic tradition). They must be
   * REAL face names: Android never synthesizes italics for custom-loaded
   * fonts, so `fontStyle: "italic"` on a pinned upright face is silently
   * dropped there. Where a slot is absent, consumers keep the upright face
   * and the platform does what it can.
   */
  latin: { regular: string; bold: string; italic?: string; boldItalic?: string };
  my: { regular: string; bold: string };
}

export const READER_FONTS: Record<ReaderFontFamily, ReaderFontFaces> = {
  serif: {
    latin: {
      regular: "Literata_400Regular",
      bold: "Literata_700Bold",
      italic: "Literata_400Regular_Italic",
      boldItalic: "Literata_700Bold_Italic",
    },
    my: { regular: "NotoSerifMyanmar_400Regular", bold: "NotoSerifMyanmar_700Bold" },
  },
  sans: {
    // The app face (Noto Sans Myanmar) already covers both scripts. No
    // loaded italic variant — fontStyle handles it where the OS can.
    latin: { regular: theme.font.regular, bold: theme.font.bold },
    my: { regular: theme.font.regular, bold: theme.font.bold },
  },
  dyslexic: {
    latin: {
      regular: "AtkinsonHyperlegible_400Regular",
      bold: "AtkinsonHyperlegible_700Bold",
      italic: "AtkinsonHyperlegible_400Regular_Italic",
      boldItalic: "AtkinsonHyperlegible_700Bold_Italic",
    },
    my: { regular: theme.font.regular, bold: theme.font.bold },
  },
};

/**
 * Lazily loads the reader font packs — called from BookReader (NOT App.tsx,
 * so cold start is unchanged). Until this returns true, consumers must keep
 * rendering the always-loaded sans faces.
 */
export function useReaderFonts(): boolean {
  const [loaded] = useFonts({
    Literata_400Regular,
    Literata_400Regular_Italic,
    Literata_700Bold,
    Literata_700Bold_Italic,
    NotoSerifMyanmar_400Regular,
    NotoSerifMyanmar_700Bold,
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_400Regular_Italic,
    AtkinsonHyperlegible_700Bold,
    AtkinsonHyperlegible_700Bold_Italic,
  });
  return loaded;
}
