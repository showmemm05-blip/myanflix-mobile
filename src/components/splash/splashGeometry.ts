import { WORDMARK_FONT, WORDMARK_INK, WORDMARK_LETTERS, type WordmarkLetter } from "./wordmarkPaths";

/**
 * The splash mark's geometry and timeline — pure numbers, no React, so the
 * component, the status doc and a node script (the reviewer's check) all read
 * ONE source. Every length is in points (dp on Android); every time in ms.
 *
 * The numbers must match docs/mobile-splash-2026-10-12/BRAND-ASSETS.md § 4,
 * which is what the native splash image and the icon were built from: the
 * first frame of the JS splash is the native splash, byte for byte, and the
 * finished mark is the picture the owner approved (artifact BcejNJb7…).
 */

/**
 * The crimson bar: the app bar's 6 × 24 / radius 2 mark (AppTopBar
 * `logoMark`) at 2x — and exactly what `assets/splash-icon.png` renders at
 * app.json's `imageWidth` 200 on both platforms (6% × 24% of the 1200 px
 * square = 12 × 48 pt, radius 1% = 2 pt, centred on the full window).
 */
export const BAR = { width: 12, height: 48, radius: 2 } as const;
/**
 * Air between the bar and the word's first ink: the approved preview's 12 px
 * gap beside its 10 px bar, scaled to the 12 pt bar.
 */
export const BAR_WORD_GAP = 14;
/**
 * The word's type size. 40 pt TYPE (cap height 28.56 pt, cap/bar 0.60) is the
 * approved preview's proportion (34 px type beside a 40 px bar); a literal
 * 40 pt cap height would be 56 pt type and taller than the bar
 * (BRAND-ASSETS.md § 5.1).
 */
export const TYPE_SIZE = 40;
/** Font units → points: 40 / 1000 = 0.04. */
export const SCALE = TYPE_SIZE / WORDMARK_FONT.unitsPerEm;

/** The word's ink, left edge of the M to right edge of the x: 4605 units = 184.20 pt. */
export const WORD_INK_WIDTH = WORDMARK_INK.width * SCALE;
/** The word's drawing box, i dot to y tail: 1016 units = 40.64 pt. */
export const WORD_BOX_HEIGHT = WORDMARK_INK.height * SCALE;
/** 714 units = 28.56 pt. */
export const CAP_HEIGHT = WORDMARK_FONT.capHeight * SCALE;

/**
 * The finished mark's box — bar, gap, the word's INK (not its advance width:
 * the side bearings are not symmetric) — centred on the window: 210.20 × 48.
 */
export const MARK = { width: BAR.width + BAR_WORD_GAP + WORD_INK_WIDTH, height: BAR.height } as const;
/**
 * How far the bar travels from the window's centre (frame 0) to the head of
 * the mark: -(210.20 / 2 - 6) = -99.10 pt, whatever the window's width.
 */
export const BAR_SLIDE_X = -(MARK.width / 2 - BAR.width / 2);
/**
 * The word's pen origin inside the mark box: bar + gap, pulled back by the
 * M's left side bearing (77 units = 3.08 pt) so the INK starts at bar + gap.
 * 22.92.
 */
export const WORD_ORIGIN_X = BAR.width + BAR_WORD_GAP - WORDMARK_INK.left * SCALE;
/**
 * The baseline inside the mark box: the cap-height midline sits on the bar's
 * centre line, so baseline = 24 + 28.56 / 2 = 38.28 (= H/2 + 14.28 on screen).
 */
export const BASELINE_Y = BAR.height / 2 + CAP_HEIGHT / 2;
/** Top of every letter's drawing box inside the mark: baseline − the i dot's 776 units = 7.24. */
export const WORD_BOX_TOP = BASELINE_Y + WORDMARK_INK.top * SCALE;

export interface LetterBox {
  readonly letter: WordmarkLetter;
  /** Left edge of the letter's ink inside the mark box (pt). */
  readonly left: number;
  /** Width of the letter's ink (pt). */
  readonly width: number;
  /**
   * The SVG viewBox that maps exactly that ink box — `xMin top width height`
   * in font units, so nothing is clipped (the y's ink starts 1 unit left of
   * its origin) and every letter shares the word's vertical box, which puts
   * them all on one baseline.
   */
  readonly viewBox: string;
}

/**
 * Each letter placed by its advance-width origin (`letter.x`, kerning
 * included — every pair in this word is 0) plus its own ink box.
 */
export const LETTER_BOXES: readonly LetterBox[] = WORDMARK_LETTERS.map((letter) => {
  const inkWidth = letter.bounds.xMax - letter.bounds.xMin;
  return {
    letter,
    left: WORD_ORIGIN_X + (letter.x + letter.bounds.xMin) * SCALE,
    width: inkWidth * SCALE,
    viewBox: `${letter.bounds.xMin} ${WORDMARK_INK.top} ${inkWidth} ${WORDMARK_INK.height}`,
  };
});

/**
 * The timeline, in ms from the handoff — the overlay's first layout, when the
 * native splash is told to hide. The approved preview's figures, with one
 * addition: the first `leadIn` ms nothing moves, so the native splash (hidden
 * asynchronously on both platforms, a frame or two later) always disappears
 * over a frame identical to itself.
 */
export const TIMELINE = {
  /** Still frames at the start: the handoff's slack. */
  leadIn: 60,
  /** The halo swells over this long (from `leadIn`)… */
  haloIn: 200,
  /** …and dies away over this long: the bar glows once, 0.06–0.56 s. */
  haloOut: 300,
  /** The bar's slide left, from `leadIn`: 0.06–0.48 s. */
  slide: 420,
  /** The first letter starts here… */
  lettersFrom: 260,
  /** …each next one this much later… */
  letterStagger: 40,
  /** …and each takes this long: the last (x) lands at 0.92 s. */
  letter: 380,
  /** The earliest the fade may start, even on an instant app start. */
  minHold: 1550,
  /** The fade-out, then the overlay unmounts: 1.55–1.87 s on a fast start. */
  exit: 320,
} as const;
/** Letters enter from 14 pt left of their place (opacity 0) — out from behind the bar. */
export const LETTER_ENTER_X = -14;
/** When the entrance is complete: 260 + 7 × 40 + 380 = 920 ms. */
export const TIMELINE_END =
  TIMELINE.lettersFrom + (WORDMARK_LETTERS.length - 1) * TIMELINE.letterStagger + TIMELINE.letter;
