/**
 * SAMPLE TICKETS — the tickets are made up; only the dream is real.
 *
 * The Dream sample-ticket generator, ported from the DreamTickets1000 /
 * DreamTickets100 board scripts (`seedOf / rng / placeAt / fitsAt / firstFit /
 * posOf / slotNum / fill / regen`). Pure and DETERMINISTIC: a
 * ticket depends only on (book, dream, place choice, roll, its spot in the
 * list), so the page shows the same six each time, and "Show other tickets"
 * (roll + 1) changes every ticket that is not picked. The real app may use a true random
 * source; the board — and so this preview — shows the same page every time.
 *
 * A ticket = the dream number at its place + random digits everywhere else, as
 * a six-digit STRING. The dream itself is real (the API's dream books,
 * 2026-10-19): a config names it by its NUMBER in the book ("027" / "07").
 * Places: Start = the first 3 digits (2 for Dream Number 100) · End = the last
 * 3 (2) · Middle = centred: digits 2–4 for 1000, 3–4 for 100. Mixed = every
 * block of three tickets holds one Start, one Middle and one End, in a
 * shuffled order.
 */
import type { DreamBook } from "@/types/lottery";

export type GenPlace = "start" | "middle" | "end";
export type GenWant = GenPlace | "mixed";

export interface BookSpec {
  id: DreamBook;
  name: string;
  /** "1,000" / "100" — the size of the book (one dream for every number). */
  size: string;
  digits: number;
  /** Where Middle starts (0-based). */
  mid: number;
}

export const BOOKS: Record<DreamBook, BookSpec> = {
  "1000": { id: "1000", name: "Dream Number 1000", size: "1,000", digits: 3, mid: 1 },
  "100": { id: "100", name: "Dream Number 100", size: "100", digits: 2, mid: 2 },
};

export interface GenTicket {
  num: string;
  pos: GenPlace;
  /** Made by this roll (shimmers, then prints in); false for a kept pick. */
  fresh: boolean;
}

export interface GenConfig {
  /** The dream's number in this book ("027" / "07"). */
  dream: string;
  pos: GenWant;
  /** Tickets on the page: six since the simpler page of 3 Nov 2026 (the first design offered 10 or 15). */
  count: number;
  roll: number;
}

const POS: readonly GenPlace[] = ["start", "middle", "end"];

/** FNV-1a over a string. */
export function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** mulberry32: a small seeded generator in [0, 1). */
export function rng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** First digit index of a place. */
export function placeAt(book: DreamBook, pos: GenPlace): number {
  const spec = BOOKS[book];
  return pos === "start" ? 0 : pos === "end" ? 6 - spec.digits : spec.mid;
}

export function fitsAt(book: DreamBook, num: string, dn: string, pos: GenPlace): boolean {
  const at = placeAt(book, pos);
  return num.slice(at, at + BOOKS[book].digits) === dn;
}

/** The place a number fits the dream at (any place for Mixed), or null. */
export function firstFit(book: DreamBook, num: string, dn: string, want: GenWant): GenPlace | null {
  if (want !== "mixed") return fitsAt(book, num, dn, want) ? want : null;
  for (const pos of POS) if (fitsAt(book, num, dn, pos)) return pos;
  return null;
}

/** Ticket i's place: the chosen one, or its slot in a shuffled block of three for Mixed. */
export function posOf(book: DreamBook, dn: string, want: GenWant, roll: number, i: number): GenPlace {
  if (want !== "mixed") return want;
  const R = rng(seedOf(`plan|${book}|${dn}|${roll}|${Math.floor(i / 3)}`));
  const block = POS.slice();
  for (let j = 2; j > 0; j--) {
    const r = Math.floor(R() * (j + 1));
    const tmp = block[j];
    block[j] = block[r];
    block[r] = tmp;
  }
  return block[i % 3];
}

/** Ticket i of a roll (re-drawn up to 50 times when it would repeat a number already on the page). */
export function slotNum(
  book: DreamBook,
  dn: string,
  want: GenWant,
  roll: number,
  i: number,
  used: Record<string, boolean>,
): { num: string; pos: GenPlace } {
  const pos = posOf(book, dn, want, roll, i);
  const at = placeAt(book, pos);
  const digits = BOOKS[book].digits;
  const R = rng(seedOf(`num|${book}|${dn}|${want}|${roll}|${i}`));
  let num = "";
  let tries = 0;
  do {
    num = "";
    for (let d = 0; d < 6; d++) num += d >= at && d < at + digits ? dn.charAt(d - at) : String(Math.floor(R() * 10));
    tries++;
  } while (used[num] && tries < 50);
  return { num, pos };
}

/**
 * n tickets for a dream. `keep[i]` = a picked ticket that stays in spot i.
 *
 * The boards staged a held number and an off-sale number into spots 3 and 4
 * on the first roll so both states could be seen; since the draw is real
 * (phase 2) a ticket is only marked when the API says its number is held or
 * off sale, so nothing is staged.
 */
export function fill(
  book: DreamBook,
  dn: string,
  want: GenWant,
  n: number,
  roll: number,
  keep: readonly (GenTicket | undefined)[],
): GenTicket[] {
  const used: Record<string, boolean> = {};
  const out: GenTicket[] = [];
  for (let i = 0; i < n; i++) {
    const kept = keep[i];
    if (kept) used[kept.num] = true;
  }
  for (let i = 0; i < n; i++) {
    const kept = keep[i];
    if (kept) {
      out.push({ num: kept.num, pos: kept.pos, fresh: false });
      continue;
    }
    const it = slotNum(book, dn, want, roll, i, used);
    used[it.num] = true;
    out.push({ num: it.num, pos: it.pos, fresh: true });
  }
  return out;
}

/** The first page for a dream: roll 0, nothing picked. */
export function firstPage(book: DreamBook, config: GenConfig): GenTicket[] {
  return fill(book, config.dream, config.pos, config.count, config.roll, []);
}

/**
 * A new roll (Show other tickets, a new place): picked tickets stay in their
 * spots (when the list gets shorter, picked ones from the cut end move up
 * into free spots); every other spot gets a new ticket. A new dream starts
 * from firstPage instead, with nothing picked.
 */
export function regen(
  book: DreamBook,
  list: readonly GenTicket[],
  picked: ReadonlySet<string>,
  next: GenConfig,
): { list: GenTicket[]; picked: Set<string> } {
  const keepSel = new Set(picked);
  const keep: (GenTicket | undefined)[] = [];
  const extra: GenTicket[] = [];
  list.forEach((ticket, i) => {
    if (!keepSel.has(ticket.num)) return;
    if (i < next.count) keep[i] = ticket;
    else extra.push(ticket);
  });
  for (let i = next.count - 1; i >= 0 && extra.length; i--) if (!keep[i]) keep[i] = extra.shift();
  return { list: fill(book, next.dream, next.pos, next.count, next.roll, keep), picked: keepSel };
}
