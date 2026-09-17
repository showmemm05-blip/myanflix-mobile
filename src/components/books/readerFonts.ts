import { useFonts } from "expo-font";
// atkinson-hyperlegible keeps its ROOT import on purpose: it ships exactly the
// four faces loaded below, so its barrel wastes nothing. The other two packages
// are deep-required by file instead — see the block under the imports.
import {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_400Regular_Italic,
  AtkinsonHyperlegible_700Bold,
  AtkinsonHyperlegible_700Bold_Italic,
} from "@expo-google-fonts/atkinson-hyperlegible";
import { theme } from "@/theme";
import type { ReaderFontFamily } from "@/store/readerPrefsStore";

/**
 * Literata and Noto Serif Myanmar are required by FILE, not imported from
 * "@expo-google-fonts/literata" / "…/noto-serif-myanmar". Each package's
 * generated index.js `require()`s EVERY weight it ships and Metro does no tree
 * shaking, so touching either root bundles 16 + 9 TTFs (6.3 MB) to load the six
 * faces below. Neither package declares an `exports` map, so these per-weight
 * subpaths are legal and keep resolving across patch upgrades.
 *
 * If you add a face to the `useFonts` map in `useReaderFonts`, add its require
 * here too — nothing else pulls these files into the bundle any more.
 */
const Literata_400Regular = require("@expo-google-fonts/literata/400Regular/Literata_400Regular.ttf");
const Literata_400Regular_Italic = require("@expo-google-fonts/literata/400Regular_Italic/Literata_400Regular_Italic.ttf");
const Literata_700Bold = require("@expo-google-fonts/literata/700Bold/Literata_700Bold.ttf");
const Literata_700Bold_Italic = require("@expo-google-fonts/literata/700Bold_Italic/Literata_700Bold_Italic.ttf");
const NotoSerifMyanmar_400Regular = require("@expo-google-fonts/noto-serif-myanmar/400Regular/NotoSerifMyanmar_400Regular.ttf");
const NotoSerifMyanmar_700Bold = require("@expo-google-fonts/noto-serif-myanmar/700Bold/NotoSerifMyanmar_700Bold.ttf");

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
