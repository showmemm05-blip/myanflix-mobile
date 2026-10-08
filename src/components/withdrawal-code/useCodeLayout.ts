import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { clamp } from "@/utils/format";

/** The boards' 72pt keys, drawn for a 390×844 phone. */
const KEY_HEIGHT = 72;
/** Small enough for a 320×568 phone, still a generous thumb target. */
const MIN_KEY_HEIGHT = 48;
/** The share of the usable height one key gets: 72pt on an 844pt phone after its insets. */
const KEY_SHARE = 0.095;
/** At large text sizes the words need the room more than the keys do. */
const LARGE_TEXT_KEY_HEIGHT = 60;
/** Below this usable height the 56pt icon disc is left out so the dots stay above the keypad. */
const COMPACT_HEIGHT = 700;
/** Below this the keypad scrolls with the page instead of being pinned (a phone on its side). */
const SHORT_HEIGHT = 480;
/** From this OS text size the disc is left out too — the words need the room. */
const LARGE_TEXT = 1.3;
/** A keypad never grows wider than this on a tablet. */
export const KEYPAD_MAX_WIDTH = 420;

export interface CodeLayout {
  /** One key's height: the board's 72pt, less on shorter phones. */
  keyHeight: number;
  /** Leave the icon disc out (short phones, large text). */
  compact: boolean;
  /** Too short to pin the keypad: it scrolls with the rest of the page. */
  short: boolean;
}

/**
 * Sizes for the code pages and the code sheet, from the window: the boards
 * are drawn at 390×844, and a 320pt phone, a phone on its side or text at
 * 200% must still show the dots, the keypad and the button. LAYOUT ONLY.
 */
export function useCodeLayout(): CodeLayout {
  const { height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const usable = height - insets.top - insets.bottom;
  return useMemo(
    () => ({
      keyHeight: clamp(
        Math.round(usable * KEY_SHARE),
        MIN_KEY_HEIGHT,
        fontScale >= LARGE_TEXT ? LARGE_TEXT_KEY_HEIGHT : KEY_HEIGHT,
      ),
      compact: usable < COMPACT_HEIGHT || fontScale >= LARGE_TEXT,
      short: usable < SHORT_HEIGHT,
    }),
    [usable, fontScale],
  );
}
