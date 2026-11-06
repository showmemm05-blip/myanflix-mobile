import { createContext, useContext } from "react";
import { Platform } from "react-native";
import { useFonts } from "expo-font";
import { theme } from "@/theme";

/**
 * The Lottery's faces, required BY FILE — never from a package root. Each
 * @expo-google-fonts package's generated index.js `require()`s every weight it
 * ships and Metro does no tree shaking, so importing anything from a root
 * (`useFonts` included) would bundle 18 TTFs per family to load the eight
 * below (App.tsx and components/books/readerFonts.ts explain the same rule).
 * None of these packages declares an `exports` map, so the subpaths are legal.
 *
 * Literata 700 is also loaded by the book reader under the SAME name; loading
 * a face twice under one name is a no-op in expo-font, so the two never clash.
 * Noto Sans Myanmar is not here: App.tsx loads it for the whole app and every
 * Burmese run in the Lottery uses `theme.font`.
 *
 * Loaded where: LotteryNavigator (a paper-coloured empty view until they are
 * in or have failed) and warmed by the dark Lottery hub, so the white app
 * usually opens on fonts already in memory. NOT in App.tsx: cold start is
 * unchanged.
 */
const Literata_600SemiBold = require("@expo-google-fonts/literata/600SemiBold/Literata_600SemiBold.ttf");
const Literata_700Bold = require("@expo-google-fonts/literata/700Bold/Literata_700Bold.ttf");
const LibreFranklin_400Regular = require("@expo-google-fonts/libre-franklin/400Regular/LibreFranklin_400Regular.ttf");
const LibreFranklin_600SemiBold = require("@expo-google-fonts/libre-franklin/600SemiBold/LibreFranklin_600SemiBold.ttf");
const LibreFranklin_700Bold = require("@expo-google-fonts/libre-franklin/700Bold/LibreFranklin_700Bold.ttf");
const CourierPrime_700Bold = require("@expo-google-fonts/courier-prime/700Bold/CourierPrime_700Bold.ttf");
const Archivo_700Bold = require("@expo-google-fonts/archivo/700Bold/Archivo_700Bold.ttf");
const Archivo_900Black = require("@expo-google-fonts/archivo/900Black/Archivo_900Black.ttf");

const LOTTERY_FONT_MAP = {
  Literata_600SemiBold,
  Literata_700Bold,
  LibreFranklin_400Regular,
  LibreFranklin_600SemiBold,
  LibreFranklin_700Bold,
  CourierPrime_700Bold,
  Archivo_700Bold,
  Archivo_900Black,
};

/**
 * One face per weight: Android never synthesises a weight for a custom font,
 * so a role names the exact face instead of setting `fontWeight`.
 *  - franklin*: the UI gothic (labels, body, buttons, tabs, pills)
 *  - literata*: the display serif (headings, every six-digit number, money)
 *  - courier700: the ticket's numbering-machine digits, words, ID and code
 *  - archivo700 / archivo900: the ticket's English date / draw No., price, overprint
 */
export type LtFace =
  | "franklin400"
  | "franklin600"
  | "franklin700"
  | "literata600"
  | "literata700"
  | "courier700"
  | "archivo700"
  | "archivo900";

const FACE_NAME: Record<LtFace, string> = {
  franklin400: "LibreFranklin_400Regular",
  franklin600: "LibreFranklin_600SemiBold",
  franklin700: "LibreFranklin_700Bold",
  literata600: "Literata_600SemiBold",
  literata700: "Literata_700Bold",
  courier700: "CourierPrime_700Bold",
  archivo700: "Archivo_700Bold",
  archivo900: "Archivo_900Black",
};

/**
 * What each face falls back to when the files could not be loaded (offline
 * first run, a broken asset): the app's own Noto Sans Myanmar weights, which
 * are always loaded, and the platform's monospace for Courier Prime. A family
 * name that is not loaded draws the red unknown-font box on iOS dev builds,
 * so the fallback is a REAL face, never the missing name.
 */
const FACE_FALLBACK: Record<LtFace, string> = {
  franklin400: theme.font.regular,
  franklin600: theme.font.semibold,
  franklin700: theme.font.bold,
  literata600: theme.font.semibold,
  literata700: theme.font.bold,
  courier700: Platform.select({ ios: "Courier", default: "monospace" }),
  archivo700: theme.font.bold,
  archivo900: theme.font.black,
};

/**
 * The Burmese face for a run at a given Lottery face (ThemedText's rule: Myanmar
 * script always renders in Noto Sans Myanmar, never in a Latin face).
 */
export const LT_MYANMAR_FACE: Record<LtFace, string> = {
  franklin400: theme.font.regular,
  franklin600: theme.font.semibold,
  franklin700: theme.font.bold,
  literata600: theme.font.semibold,
  literata700: theme.font.bold,
  courier700: theme.font.bold,
  archivo700: theme.font.bold,
  archivo900: theme.font.black,
};

/**
 * Loads the eight faces. `failed` is true when expo-font rejected: it then
 * leaves `loaded` false FOREVER (App.tsx notes the same), so a gate must wait
 * for `loaded || failed`, never for `loaded` alone.
 */
export function useLotteryFonts(): { loaded: boolean; failed: boolean } {
  const [loaded, error] = useFonts(LOTTERY_FONT_MAP);
  return { loaded, failed: !!error };
}

/**
 * True when the Lottery faces FAILED to load, so `ltFace` must hand out the
 * fallbacks. Provided once by LotteryNavigator; the default (false) is right
 * for anything rendered after a successful load, and for the dark side's
 * warm-up, which draws no Lottery text.
 */
export const LtFontsContext = createContext(false);

/** The family name for a face — the loaded one, or its fallback when `failed`. */
export function ltFace(face: LtFace, failed = false): string {
  return failed ? FACE_FALLBACK[face] : FACE_NAME[face];
}

/** `ltFace` bound to this tree's load result: `const face = useLtFace(); face("literata700")`. */
export function useLtFace(): (face: LtFace) => string {
  const failed = useContext(LtFontsContext);
  return (face: LtFace) => ltFace(face, failed);
}
