/**
 * Estimated reading time for mixed Latin/Myanmar chapter text.
 *
 * minutes = ceil(latinWords/220 + myanmarSyllables/170)
 *
 * Myanmar syllables are approximated as the count of base consonants and
 * independent vowels — a deterministic proxy (asat finals slightly overcount,
 * fine for an estimate). Latin words are whitespace tokens containing a
 * letter, counted after Myanmar runs are stripped.
 */

const LATIN_WPM = 220;
const MYANMAR_SPM = 170;

/** Base consonants + independent vowels + the great SA / NYA-like signs. */
const MYANMAR_SYLLABLE = /[က-ဪဿ၎]/g;
/** Whole Myanmar block (plus extensions) — removed before Latin word counting. */
const MYANMAR_RUN = /[က-႟ꩠ-ꩿꧠ-꧿]+/g;
const HAS_LETTER = /\p{L}/u;

export function countMyanmarSyllables(text: string): number {
  return text.match(MYANMAR_SYLLABLE)?.length ?? 0;
}

export function countLatinWords(text: string): number {
  const stripped = text.replace(MYANMAR_RUN, " ");
  let words = 0;
  for (const token of stripped.split(/\s+/)) {
    if (token && HAS_LETTER.test(token)) words += 1;
  }
  return words;
}

/** Whole minutes, never 0 for non-empty text (a one-line chapter is "~1 min"). */
export function estimateReadingMinutes(text: string): number {
  const syllables = countMyanmarSyllables(text);
  const words = countLatinWords(text);
  if (syllables === 0 && words === 0) return 0;
  return Math.max(1, Math.ceil(words / LATIN_WPM + syllables / MYANMAR_SPM));
}

/** Convenience over per-block plain text (RichText's pmPlainBlocks). */
export function estimateReadingMinutesForBlocks(blocks: string[]): number {
  return estimateReadingMinutes(blocks.join(" "));
}
