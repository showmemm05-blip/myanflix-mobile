/**
 * The Confirm sheet's rules (Confirm.dc.html + Draw.dc.html's sheet, v3 ·
 * compact, ported): the rows, the totals, what one row shows and says, and
 * the polite lines read out after each change. Pure, so the sheet only holds
 * state and draws, and every message is decided in one place.
 *
 * "Held" and the per-number limit come from the draw and the availability
 * the page asked the API for (hooks/useAvailability); the balance is the real
 * wallet's.
 */
import { ks } from "@/lottery/data/format";
import type { PurchaseLine } from "@/lottery/data/sample";
import { ltComma, ltSentence } from "@/lottery/i18n";
import { DRAW_COPY } from "@/lottery/screens/draw/copy";

const C = DRAW_COPY.confirm;

/** Where a dream's digits sit in a picked number (DreamTickets): its name, its dream number and the first index. */
export interface DreamMark {
  name: string;
  number: string;
  at: number;
}

/**
 * What a row's caption says when it is not a dream's (multi-number Draw, 19 Oct 2026):
 * "list" = "In your list" · "typed" = "Typed, not in your list" (the window's number,
 * which Buy included) · "none" = no caption (Draw's own "Your numbers" rows).
 * Without one: the dream's name, or "Your number".
 */
export type RowCaption = "list" | "typed" | "none";

/** A line handed to Confirm: a number × quantity, and — from a dream — the dream it came from. */
export interface ConfirmLine extends PurchaseLine {
  dream?: DreamMark;
  /** Draw: which of its numbers this is. DreamTickets leaves it out. */
  caption?: RowCaption;
}

/** One row while the sheet is open (and one row of Draw's "Your numbers"). */
export interface ConfirmRow {
  number: string;
  /** null while the typed box is empty: it counts 0 and blocks Confirm until it is filled. */
  qty: number | null;
  /** The last quantity it had — what the page keeps when the sheet closes on an empty box. */
  last: number;
  dream?: DreamMark;
  caption?: RowCaption;
}

/** 1 to `max`, whole tickets (a typed 0 is 1, a typed 25 is the most left). */
export function clampQty(n: number, max: number): number {
  return Math.min(Math.max(1, Math.floor(n) || 1), Math.max(1, max));
}

/** What is left of the draw's per-number limit for a number (never below 1: a number at the most never reaches the sheet). */
export function maxFor(held: number, most: number): number {
  return Math.max(1, most - held);
}

/** The rows a sheet opens with: one per number (a repeated number is merged), each quantity inside its limit. */
export function startRows(lines: readonly ConfirmLine[], maxOf: (number: string) => number): ConfirmRow[] {
  const out: ConfirmRow[] = [];
  for (const line of lines) {
    const max = maxOf(line.number);
    const same = out.find((row) => row.number === line.number);
    if (same) {
      const merged = clampQty((same.qty ?? same.last) + line.quantity, max);
      same.qty = merged;
      same.last = merged;
      continue;
    }
    const qty = clampQty(line.quantity, max);
    out.push({ number: line.number, qty, last: qty, dream: line.dream, caption: line.caption });
  }
  return out;
}

/** The rows as lines again (an empty box counts as its last quantity): what was bought, or what the page keeps. */
export function toLines(rows: readonly ConfirmRow[]): ConfirmLine[] {
  return rows.map((row) => ({ number: row.number, quantity: row.qty ?? row.last, dream: row.dream, caption: row.caption }));
}

export interface ConfirmTotals {
  numbers: number;
  /** Empty boxes count 0. */
  tickets: number;
  total: number;
  /** How much the total is above the wallet (0 when it is covered). */
  short: number;
  /** Rows with an empty box. */
  gaps: number;
  firstGap: string | null;
}

export function totalsOf(rows: readonly ConfirmRow[], price: number, balance: number): ConfirmTotals {
  let tickets = 0;
  let gaps = 0;
  let firstGap: string | null = null;
  for (const row of rows) {
    if (row.qty === null) {
      gaps++;
      if (firstGap === null) firstGap = row.number;
    } else {
      tickets += row.qty;
    }
  }
  const total = tickets * price;
  return { numbers: rows.length, tickets, total, short: Math.max(0, total - balance), gaps, firstGap };
}

export type RowTone = "ok" | "err" | "max";

export interface RowDigit {
  digit: string;
  /** Inside the dream's digits (one indigo-tint chip). */
  dream: boolean;
  /** The chip's two ends get the rounded corners. */
  first: boolean;
  last: boolean;
}

export interface RowView {
  /** The stepper's edge: err (empty box) · max (at the most) · ok. */
  tone: RowTone;
  digits: RowDigit[];
  /** "Fish · dream 027" · "Your number" · "In your list" · "Typed, not in your list"; "" = none (not drawn). */
  caption: string;
  /** "Number 0 2 7 5 1 4, from the Fish dream, dream number 0 2 7." */
  spoken: string;
  /** The typed box. */
  value: string;
  canLess: boolean;
  canMore: boolean;
  sum: string;
  sumSpoken: string;
  /** The limit line — only when it matters (empty · at the most · already holding some). */
  note: { kind: "warn" | "err"; text: string } | null;
  /** The limits, for screen readers on every row (the board's aria-describedby). */
  hint: string;
}

/** A "·" is a pause, not a word, when read out. */
function speakDots(text: string): string {
  return text.replace(/ · /g, `${ltComma()} `);
}

/** The caption under the number and the row's spoken name (an empty caption is not drawn). */
function captionOf(row: ConfirmRow): { caption: string; spoken: string } {
  const R = C.row;
  switch (row.caption) {
    case "list":
      return { caption: R.inList, spoken: R.spokenInList(row.number) };
    case "typed":
      return { caption: R.typedNotInList, spoken: R.spokenTypedNotInList(row.number) };
    case "none":
      return { caption: "", spoken: R.spokenPlain(row.number) };
    default:
      return {
        caption: row.dream ? R.dream(row.dream.name, row.dream.number) : R.typed,
        spoken: R.spoken(row.number, row.dream),
      };
  }
}

export function rowView(row: ConfirmRow, held: number, max: number, price: number, busy: boolean): RowView {
  const R = C.row;
  const empty = row.qty === null;
  const qty = row.qty ?? 0;
  const atMost = !empty && qty >= max;

  let note: RowView["note"] = null;
  let extra = "";
  if (empty) note = { kind: "err", text: R.empty(max) };
  else if (atMost) {
    note = { kind: "warn", text: held ? R.mostHeld(held) : R.most };
    extra = ` ${R.noMore}`;
  } else if (held) note = { kind: "warn", text: R.held(held, max) };
  // Minimum 1: − refuses, and Remove is the way to drop the number.
  if (!empty && qty <= 1) extra += ` ${R.least}`;
  // A row with nothing held: its whole limit is the draw's (max + held = the per-number most).
  const hint = `${ltSentence(note ? speakDots(note.text) : R.rule(max + held))}${extra}`;

  const dream = row.dream;
  const digits: RowDigit[] = row.number.split("").map((digit, i) => {
    const inDream = !!dream && i >= dream.at && i < dream.at + dream.number.length;
    return {
      digit,
      dream: inDream,
      first: inDream && !!dream && i === dream.at,
      last: inDream && !!dream && i === dream.at + dream.number.length - 1,
    };
  });

  return {
    tone: empty ? "err" : atMost ? "max" : "ok",
    digits,
    ...captionOf(row),
    value: empty ? "" : String(qty),
    canLess: !busy && !empty && qty > 1,
    canMore: !busy && (empty || qty < max),
    sum: ks(qty * price),
    sumSpoken: R.lineSpoken(qty, ks(price), ks(qty * price)),
    note,
    hint,
  };
}

/** "3 numbers, 4 tickets, total 4,000 Ks." (+ "Not enough in your wallet…" when short). */
export function sumLine(t: ConfirmTotals): string {
  return C.say.sum(t.numbers, t.tickets, ks(t.total), t.short ? ks(t.short) : null);
}

/** The polite line after a quantity changes (a step, a typed value, an empty box filled with 1). */
export function saySet({
  rows,
  number,
  qty,
  max,
  price,
  balance,
  wasShort,
}: {
  rows: readonly ConfirmRow[];
  number: string;
  qty: number | null;
  max: number;
  price: number;
  balance: number;
  wasShort: boolean;
}): string {
  if (qty === null) return C.say.empty(number, max);
  const t = totalsOf(rows, price, balance);
  const most = qty >= max;
  const covered = wasShort && t.short === 0;
  // One row (Draw): its total is the whole total, so the sentence is the Draw board's shorter one.
  if (rows.length === 1) return C.say.setOne(number, qty, ks(qty * price), most, t.short ? ks(t.short) : null, covered);
  return C.say.set(number, qty, ks(qty * price), most, sumLine(t), covered ? C.say.covered(t.gaps === 0) : "");
}

/** After Remove: what is left, and where Undo is. */
export function sayRemoved(number: string, left: readonly ConfirmRow[], price: number, balance: number): string {
  return C.say.removed(number, left.length ? sumLine(totalsOf(left, price, balance)) : C.say.none);
}

/** After Undo. */
export function sayBack(number: string, qty: number, rows: readonly ConfirmRow[], price: number, balance: number): string {
  if (rows.length === 1) return C.say.backOne(number, qty, ks(qty * price));
  return C.say.back(number, qty, sumLine(totalsOf(rows, price, balance)));
}
