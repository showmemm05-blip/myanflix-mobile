/**
 * The "MyanFlix" wordmark as SVG path data — GENERATED, do not edit by hand.
 *
 * Font: Noto Sans Myanmar Black (Version 2.107), the face `theme.font.black` names,
 * read from node_modules/@expo-google-fonts/noto-sans-myanmar/900Black/NotoSansMyanmar_900Black.ttf.
 * Generator: mobile/scripts/extract-wordmark.py (fontTools; see its header
 * for how to re-run it). The same run writes assets/brand/wordmark.svg and
 * assets/brand/mark.svg, and `scripts/brand-assets.mjs` renders the PNGs.
 *
 * Why paths and not <Text>: the animated splash is on screen BEFORE expo-font
 * has resolved, so drawing the word with react-native-svg <Path>s means it
 * never waits for the font and never flashes a fallback face. The icon's
 * "M" is the very same outline (WORDMARK_LETTERS[0]).
 *
 * Coordinates: font units (`unitsPerEm` per em), already flipped into SVG
 * space — y grows DOWN, the baseline is y = 0, ink above it is negative.
 * Draw a letter with `<Path d={d} transform={`translate(${x} 0)`} />` and
 * scale the whole group by `fontSizePt / unitsPerEm` to set it at a point
 * size (cap height in pt = fontSizePt * capHeight / unitsPerEm).
 *
 * Placement: `x` = cumulative advance widths plus GPOS pair kerning (the
 * font's `kern` feature for `latn`). The table was read: 0 of the
 * 7 pairs in this word kern (every pair is 0), so `x` equals the
 * plain running sum of `advance`. No tracking is baked in; the app bar sets
 * its wordmark at -0.03 em, the approved splash preview at -0.01 em — add
 * `index * trackingEm * unitsPerEm` to `x` if the splash wants either.
 */

export interface WordmarkLetter {
  /** The character this outline draws. */
  readonly char: string;
  /** The glyph's name inside the font. */
  readonly glyph: string;
  /** SVG path data in font units, y-down, origin at this letter's pen position. */
  readonly d: string;
  /** Horizontal advance in font units. */
  readonly advance: number;
  /** GPOS pair-kerning applied before this letter (font units; 0 for the first). */
  readonly kern: number;
  /** This letter's origin on the x axis, in font units from the word's origin. */
  readonly x: number;
  /** Ink box of this letter's outline (font units, y-down), relative to its origin. */
  readonly bounds: { readonly xMin: number; readonly yMin: number; readonly xMax: number; readonly yMax: number };
}

/** The font's vertical metrics, in font units (y-UP here, as the font states them). */
export const WORDMARK_FONT = {
  family: "Noto Sans Myanmar Black",
  file: "node_modules/@expo-google-fonts/noto-sans-myanmar/900Black/NotoSansMyanmar_900Black.ttf",
  version: "Version 2.107",
  unitsPerEm: 1000,
  ascender: 1324,
  descender: -860,
  capHeight: 714,
  xHeight: 536,
} as const;

/** The word, in order. `WORDMARK_LETTERS[0]` is the icon's "M". */
export const WORDMARK_LETTERS: readonly WordmarkLetter[] = [
  {
    char: "M",
    glyph: "M",
    advance: 967,
    kern: 0,
    x: 0,
    bounds: { xMin: 77, yMin: -714, xMax: 890, yMax: 0 },
    d: "M388 0L242 -514H238Q240 -494 242 -460Q244 -426 246 -386.5Q248 -347 248 -310V0H77V-714H334L483 -207H487L633 -714H890V0H713V-313Q713 -347 714 -385.5Q715 -424 717 -458.5Q719 -493 720 -513H716L572 0Z",
  },
  {
    char: "y",
    glyph: "y",
    advance: 610,
    kern: 0,
    x: 967,
    bounds: { xMin: -1, yMin: -553, xMax: 610, yMax: 240 },
    d: "M-1 -553H200L294 -236Q296 -229 298 -219Q300 -209 301.5 -198Q303 -187 303 -176H307Q309 -196 312.5 -210.5Q316 -225 319 -235L415 -553H610L391 35Q366 102 332.5 148Q299 194 250 217Q201 240 128 240Q102 240 83 237.5Q64 235 50 232V82Q61 84 76.5 86Q92 88 109 88Q141 88 160.5 75Q180 62 193 41.5Q206 21 215 -3L217 -8Z",
  },
  {
    char: "a",
    glyph: "a",
    advance: 623,
    kern: 0,
    x: 1577,
    bounds: { xMin: 36, yMin: -563, xMax: 559, yMax: 10 },
    d: "M336 -563Q441 -563 500 -511Q559 -459 559 -363V0H427L390 -73H386Q363 -44 338.5 -25.5Q314 -7 282 1.5Q250 10 204 10Q156 10 118 -9.5Q80 -29 58 -68.5Q36 -108 36 -169Q36 -258 97.5 -301Q159 -344 276 -349L368 -352V-360Q368 -397 350 -412.5Q332 -428 301 -428Q268 -428 228 -416.5Q188 -405 147 -387L92 -513Q140 -538 200.5 -550.5Q261 -563 336 -563ZM325 -245Q273 -243 251.5 -226.5Q230 -210 230 -180Q230 -152 245 -138.5Q260 -125 285 -125Q320 -125 344.5 -147Q369 -169 369 -204V-247Z",
  },
  {
    char: "n",
    glyph: "n",
    advance: 670,
    kern: 0,
    x: 2200,
    bounds: { xMin: 66, yMin: -563, xMax: 606, yMax: 0 },
    d: "M412 -563Q498 -563 552 -515Q606 -467 606 -360V0H415V-302Q415 -357 399 -385Q383 -413 348 -413Q294 -413 275.5 -369Q257 -325 257 -242V0H66V-553H210L236 -480H243Q261 -506 285.5 -524.5Q310 -543 341.5 -553Q373 -563 412 -563Z",
  },
  {
    char: "F",
    glyph: "F",
    advance: 539,
    kern: 0,
    x: 2870,
    bounds: { xMin: 77, yMin: -714, xMax: 499, yMax: 0 },
    d: "M267 0H77V-714H499V-559H267V-423H481V-268H267Z",
  },
  {
    char: "l",
    glyph: "l",
    advance: 323,
    kern: 0,
    x: 3409,
    bounds: { xMin: 66, yMin: -760, xMax: 257, yMax: 0 },
    d: "M257 0H66V-760H257Z",
  },
  {
    char: "i",
    glyph: "i",
    advance: 325,
    kern: 0,
    x: 3732,
    bounds: { xMin: 62, yMin: -776, xMax: 265, yMax: 0 },
    d: "M258 -553V0H67V-553ZM163 -776Q204 -776 234.5 -759Q265 -742 265 -691Q265 -642 234.5 -624.5Q204 -607 163 -607Q121 -607 91.5 -624.5Q62 -642 62 -691Q62 -742 91.5 -759Q121 -776 163 -776Z",
  },
  {
    char: "x",
    glyph: "x",
    advance: 630,
    kern: 0,
    x: 4057,
    bounds: { xMin: 5, yMin: -553, xMax: 625, yMax: 0 },
    d: "M183 -282L14 -553H231L315 -398L401 -553H618L445 -282L625 0H408L315 -168L222 0H5Z",
  },
];

/** Sum of the advances (+ kerning): where the pen rests after the last letter, font units. */
export const WORDMARK_ADVANCE_WIDTH = 4687;

/**
 * The ink box of the whole word in font units, y-down from the baseline:
 * `left`/`right` from the word's origin, `top` the tallest ascender/dot,
 * `bottom` the deepest descender. Centre the word by THIS box, not by the
 * advance width — the first and last side bearings are not symmetric.
 */
export const WORDMARK_INK = {
  left: 77,
  right: 4682,
  top: -776,
  bottom: 240,
  width: 4605,
  height: 1016,
} as const;
