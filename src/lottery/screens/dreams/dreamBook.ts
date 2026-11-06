import { BOOKS, placeAt, type GenPlace } from "@/lottery/data/generator";
import { LT, LT_SPACE } from "@/lottery/theme/tokens";
import type { DreamBook, LotteryDream } from "@/types/lottery";
import { spaced } from "@/lottery/data/format";
import { ltLanguage } from "@/lottery/i18n";
import { burmeseSearchKey, typedDigits } from "@/utils/burmeseSearch";

/**
 * What differs between the two dream books, and the dream book's live
 * search, ported from the Dream1000 / Dream100 board scripts (the same block
 * on both boards; only `BOOK` changes). The dreams themselves come from the
 * API (hooks/useDreams.ts) — this module only shapes them for the page.
 *
 * Accent (spec §0.5): Dream Number 1000 = indigo tint, Dream Number 100 =
 * seal tint — picture discs, the intro mark, the marked dream digits and the
 * place patterns only. Picking and focus stay indigo, and the one main action
 * stays seal, on both.
 */
export interface BookLook {
  /** The disc behind each picture, and the dream digits' highlight. */
  tint: string;
  /** The intro mark, the place pattern's filled cells, the dream digits' underline. */
  mark: string;
  /** Dream cards per row. */
  cols: number;
  /** The tint disc and the picture on it (board sizes at 390pt). */
  disc: number;
  pic: number;
  /** Card padding: top, sides. */
  padTop: number;
  padSide: number;
  /** The number strip under the card. */
  numH: number;
  numSize: number;
  /** The card's names (1000: 14/18 + 14/24 · 100: 12/16 + 12/20). */
  small: boolean;
}

export const BOOK_LOOK: Record<DreamBook, BookLook> = {
  "1000": { tint: LT.indigoTint, mark: LT.indigo, cols: 3, disc: 98, pic: 88, padTop: 10, padSide: 6, numH: 44, numSize: 28, small: false },
  "100": { tint: LT.sealTint, mark: LT.seal, cols: 4, disc: 72, pic: 60, padTop: 8, padSide: 4, numH: 36, numSize: 24, small: true },
};

/** The grid's gap (board `.lt-drgrid` gap 8). */
export const GRID_GAP = 8;

/** Dreams a book page shows at first, and adds with each "Load more" (the board: 24). */
export const PAGE_SIZE = 24;

/**
 * The 560pt content column's inner width on this window (LotteryScreen: at
 * most 560 wide, 16pt gutters) — what the grids divide. Worked out from the
 * window rather than measured so the first frame is already the right size.
 */
export function columnWidth(windowWidth: number): number {
  return Math.min(windowWidth, LT_SPACE.contentMax) - 2 * LT_SPACE.gutter;
}

/**
 * A dream card's disc and picture for this window. The board's sizes leave a
 * ~9pt tint ring around each picture at 390pt; on a narrower phone the disc
 * shrinks to the card's inside and the picture keeps the same ring ratio,
 * never overflowing the card.
 */
export function cardMetrics(book: DreamBook, windowWidth: number): { card: number; disc: number; pic: number } {
  const look = BOOK_LOOK[book];
  const card = (columnWidth(windowWidth) - GRID_GAP * (look.cols - 1)) / look.cols;
  const inside = Math.floor(card - 2 * look.padSide - 2);
  const disc = Math.min(look.disc, inside);
  return { card, disc, pic: Math.round((disc * look.pic) / look.disc) };
}

/** A dream as a book page shows it, with its search keys. */
export interface BookDream {
  /** "027" (1000) / "07" (100): the card's key, and what the generator is opened with. */
  num: string;
  /** At least one of the two is set (the API sends only named dreams). */
  en: string | null;
  my: string | null;
  pictureUrl: string | null;
  enN: string;
  myN: string;
}

/**
 * The API's dreams as the page lists them (already in number order), with
 * their search keys (burmeseSearchKey: spaces, look-alike letters and the
 * order of a syllable's marks no longer tell a customer's spelling from the
 * admin's).
 */
export function bookDreams(list: readonly LotteryDream[]): BookDream[] {
  return list.map((d) => ({
    num: d.number,
    en: d.nameEn,
    my: d.nameMy,
    pictureUrl: d.pictureUrl,
    enN: d.nameEn ? burmeseSearchKey(d.nameEn) : "",
    myN: d.nameMy ? burmeseSearchKey(d.nameMy) : "",
  }));
}

/**
 * The names a dream is read by, in the order they are shown: the reader's
 * language first — "Fish, ငါး" in English, "ငါး၊ Fish" in Burmese (one of
 * them when the other is not set).
 */
export function dreamNames(dream: { en: string | null; my: string | null }): string {
  const burmese = ltLanguage() === "mm";
  return (burmese ? [dream.my, dream.en] : [dream.en, dream.my])
    .filter((name): name is string => !!name)
    .join(burmese ? "၊ " : ", ");
}

/**
 * What a dream is called in a sentence (the Confirm row's "Fish · dream 027"):
 * the name in the reader's language, else the other one, else its number.
 */
export function dreamName(dream: { nameEn: string | null; nameMy: string | null; number: string }): string {
  return ltLanguage() === "mm"
    ? (dream.nameMy ?? dream.nameEn ?? dream.number)
    : (dream.nameEn ?? dream.nameMy ?? dream.number);
}

/** The name under the heading: the other language's name, when the heading is the reader's own. */
export function dreamSecondName(dream: { nameEn: string | null; nameMy: string | null }): string | null {
  return ltLanguage() === "mm" ? (dream.nameMy ? dream.nameEn : null) : dream.nameEn ? dream.nameMy : null;
}

export interface DreamSearch {
  found: readonly BookDream[];
  /** The query's search key (burmeseSearchKey); "" = no search. */
  qn: string;
  /** The query as typed, trimmed — what the count and the empty title quote. */
  shown: string;
  /** What a screen reader hears for it: a number digit by digit. */
  said: string;
}

/**
 * The live filter (board script): English, Burmese or the number itself. A
 * number query matches any dream whose number CONTAINS it ("2" and "၂" find
 * 027, 260 and 429), a word query any name whose key contains the query's
 * key — so "ငါးကြီး" finds "ငါး ကြီး" and "၀က်" finds "ဝက်".
 */
export function searchBook(dreams: readonly BookDream[], q: string): DreamSearch {
  const qn = burmeseSearchKey(q);
  // A number (ASCII or Burmese digits; spaces, dots, dashes and middots ignored), or null for a word.
  const qd = typedDigits(q);
  const found = !qn
    ? dreams
    : dreams.filter((d) => (qd !== null ? d.num.includes(qd) : d.enN.includes(qn) || d.myN.includes(qn)));
  const shown = q.trim();
  return { found, qn, shown, said: qd !== null ? spaced(qd) : shown };
}

/** The six cells a place fills: [first, last) digit index (the pattern and the marked digits). */
export function placeSpan(book: DreamBook, pos: GenPlace): [number, number] {
  const at = placeAt(book, pos);
  return [at, at + BOOKS[book].digits];
}
