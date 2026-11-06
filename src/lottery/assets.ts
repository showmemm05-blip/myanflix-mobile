/**
 * The Lottery's built-in art, copied from docs/lottery-design-2026-10-13: the
 * Thai-style ticket frame only. The 1800 × 940 frame covers a 358pt ticket at
 * 3× (1074 px) and the 685pt sideways view; the 2x frame is 6.6 MB, too heavy
 * for what it adds. About 2.7 MB in all.
 *
 * The draw pictures we used while building the screens (Draws 22–25) are no
 * longer bundled (owner, 27 Oct 2026): a draw's picture is only the admin's
 * upload (`pictureUrl`). Their originals stay in
 * docs/lottery-design-2026-10-13/ticket-art.
 *
 * `require()` numbers for expo-image. Only this file names the paths.
 */
export const LT_ART = {
  /**
   * The built-in Thai-style ticket frame, 1800 × 940 — what a draw prints
   * when it has no uploaded frame (`frameUrl` null).
   */
  frame: require("../../assets/lottery/frame-thai.png") as number,
  /** The same frame at 600 × 313, for tickets under 300pt wide. */
  frameThumb: require("../../assets/lottery/frame-thai-thumb.png") as number,
} as const;
