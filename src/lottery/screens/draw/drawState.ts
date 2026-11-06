/**
 * The Draw page's rules (Draw.dc.html's script, ported; multi-number Draw,
 * owner 19 Oct 2026; typed on the ticket, 22 Oct 2026): from the digits on
 * the ticket, "Your numbers", what the draw said about each number (on sale,
 * held) and the wallet, every line the page shows — the ring round the
 * ticket's number slot, the help line, the Add button, the list's count /
 * total / wallet lines and the buy bar. Pure, so the screen only holds state
 * and draws, and every message is decided in one place.
 *
 * What Buy buys: the whole list, plus a complete, buyable number still in the
 * window that is not in the list (1 ticket, or what Confirm raised it to), so
 * "type → Buy" still works with no extra tap. A number already in the list is
 * never counted twice.
 *
 * "Held" and "off sale" are the API's answer for each number
 * (hooks/useAvailability); a number not answered yet is "checking", and the
 * page neither adds nor buys it until the answer is in.
 */
import type { NumberWindowState } from "@/lottery/components/NumberWindow";
import type { LtHelpKind } from "@/lottery/components/Surfaces";
import { totalsOf } from "@/lottery/components/confirm/confirmModel";
import { ks, pad } from "@/lottery/data/format";
import type { ListRow } from "@/lottery/data/session";
import type { Availability } from "@/lottery/hooks/useAvailability";
import { ltComma } from "@/lottery/i18n";
import { DRAW_COPY, speakNumbers } from "@/lottery/screens/draw/copy";


/**
 * How many different numbers "Your numbers" may hold: one purchase takes at
 * most this many lines (backend PurchaseLineDto, PURCHASE_MAX_LINES), and one
 * availability ask answers at most this many numbers (hooks/useAvailability
 * AVAILABILITY_MAX), so a longer list could neither be checked nor bought.
 */
export const LIST_MAX_NUMBERS = 50;

/** A line with its spoken form (six-digit numbers read digit by digit). */
export interface DrawLine {
  kind: LtHelpKind;
  text: string;
  spoken: string;
}

function line(kind: LtHelpKind, text: string): DrawLine {
  return { kind, text, spoken: speakNumbers(text) };
}

export interface DrawInput {
  drawNo: number;
  digits: string;
  /** The last change dropped something that was not a digit (a pasted "No.", a letter). */
  dropped: boolean;
  /** What the draw said about a number — off sale, held, left; undefined while it has not answered. */
  availabilityOf: (number: string) => Availability | undefined;
  /** "Your numbers" (the session's shared list). */
  list: readonly ListRow[];
  /** The typed number's tickets when Buy includes it: 1, unless Confirm changed it. */
  typedQty: number;
  price: number;
  /** The draw's per-number limit. */
  most: number;
  /** The wallet; null while it has not loaded (the list then says only where it is paid from). */
  balance: number | null;
}

export interface DrawView {
  /** "Add to list" is live: six digits, on sale, and that number still under the limit (held + the list). */
  canAdd: boolean;
  /** "Add 047319 to your list" · "Add 1 more of 581206" · "Add to list" (disabled). */
  add: { label: string; spoken: string };
  /** Buy includes the window's number as its own row: complete, buyable, not in the list. */
  typedIn: boolean;
  /** The ring round the ticket's number slot (the number window's own states, kept). */
  windowState: NumberWindowState;
  numberHelp: DrawLine;
  /** What Buy buys (the list + the typed number). Ready: something to buy and no empty box. */
  buy: { tickets: number; ready: boolean };
  barCaption: DrawLine;
  barLabel: string;
}

export function drawView({
  drawNo,
  digits,
  dropped,
  availabilityOf,
  list,
  typedQty,
  price,
  most,
  balance,
}: DrawInput): DrawView {
  const C = DRAW_COPY;
  const length = digits.length;
  const full = length === 6;
  const row = full ? list.find((r) => r.number === digits) : undefined;
  const inList = !!row;
  // The list holds the most numbers one purchase can carry and this is a new one: it is neither asked nor added.
  const listFull = full && !inList && list.length >= LIST_MAX_NUMBERS;
  const known = full && !listFull ? availabilityOf(digits) : undefined;
  // All six are in but the draw has not answered yet: nothing can be added or bought until it has.
  const checking = full && !listFull && !known;
  const offSale = !!known?.offSale;
  const held = known?.held ?? 0;
  // What is left of the limit for the typed number.
  const left = known ? Math.max(0, Math.min(known.left, most - held)) : 0;
  const atMost = full && !!known && !offSale && left === 0;
  // Its tickets in the list (an empty box counts 0), and whether that row is at the most already.
  const inQty = row ? Math.min(row.qty ?? 0, left) : 0;
  const rowFull = inList && !atMost && !checking && inQty >= left;
  const canAdd = full && !listFull && !checking && !offSale && !atMost && !rowFull;
  const typedIn = canAdd && !inList;
  const buyable = full && !listFull && !checking && !offSale && !atMost;

  // The ring round the number slot follows the help line: complete indigo · warn at the most · error.
  const windowState: NumberWindowState =
    (dropped && !full) || offSale
      ? "error"
      : checking
        ? "loading"
        : full
          ? atMost || rowFull || listFull
            ? "warn"
            : "complete"
          : length
            ? "typing"
            : "empty";

  let numberHelp: DrawLine;
  if (dropped && !full) numberHelp = line("err", C.help.dropped);
  else if (!length) numberHelp = line("tap", C.help.empty);
  else if (!full) numberHelp = line("info", C.help.partial(length));
  else if (listFull) numberHelp = line("warn", C.help.listFull(LIST_MAX_NUMBERS));
  else if (checking) numberHelp = line("info", C.help.checking(digits));
  else if (offSale) numberHelp = line("err", C.help.offSale(digits, drawNo));
  else if (atMost) numberHelp = line("warn", C.help.atMost(digits, most));
  else if (rowFull)
    numberHelp = line("warn", held ? C.help.inListMostHeld(digits, inQty, held) : C.help.inListMost(digits, inQty));
  else if (inList) numberHelp = line("info", C.help.inList(digits, inQty));
  else if (held > 0) numberHelp = line("ok", C.help.held(digits, held, left));
  else numberHelp = line("ok", C.help.ready(digits, most));

  // The Add button names the number it adds.
  const addLabel = !buyable ? C.add.plain : inList ? C.add.oneMore(digits) : C.add.number(digits);

  // What Buy buys: the list, + the typed number (inside what is left of its limit).
  const lt = totalsOf(list, price, balance ?? 0);
  const typedTickets = typedIn ? Math.min(Math.max(1, typedQty), left) : 0;
  const buyNumbers = lt.numbers + (typedIn ? 1 : 0);
  const buyTickets = lt.tickets + typedTickets;
  const ready = buyNumbers > 0 && lt.gaps === 0;

  let barCaption: DrawLine;
  if (lt.firstGap !== null) barCaption = line("plain", C.bar.gap(lt.firstGap));
  else if (!buyNumbers) {
    if (length && !full) barCaption = line("plain", C.bar.enterSix);
    else if (offSale) barCaption = line("plain", C.bar.offSale);
    else if (atMost) barCaption = line("plain", C.bar.atMost(most));
    else barCaption = line("plain", C.bar.none(drawNo));
  } else if (typedIn && lt.numbers) {
    barCaption = {
      kind: "plain",
      text: C.bar.listAndTyped(lt.numbers, digits, drawNo),
      spoken: C.bar.listAndTypedSpoken(lt.numbers, digits, typedTickets, drawNo),
    };
  } else if (typedIn) barCaption = line("plain", C.bar.ready(digits, drawNo));
  else barCaption = line("plain", C.bar.list(lt.numbers, drawNo));

  return {
    canAdd,
    add: { label: addLabel, spoken: speakNumbers(addLabel) },
    typedIn,
    windowState,
    numberHelp,
    buy: { tickets: buyTickets, ready },
    barCaption,
    barLabel: ready ? C.bar.buy(buyTickets, ks(buyTickets * price)) : buyNumbers ? C.bar.buyBlocked : C.bar.addFirst,
  };
}

/** "Your numbers" card's own lines (the list alone, never the typed number). */
export interface ListView {
  /** "3 numbers · 5 tickets". */
  count: string;
  countSpoken: string;
  /** "Total · 5 tickets" + "5,000 Ks". */
  totalLabel: string;
  total: string;
  totalSpoken: string;
  /** Paid from the wallet · more than the balance (you can still open Confirm, which offers a deposit). */
  wallet: DrawLine;
}

export function listView(list: readonly ListRow[], price: number, balance: number | null): ListView {
  const C = DRAW_COPY;
  const t = totalsOf(list, price, balance ?? 0);
  const count = C.list.count(t.numbers, t.tickets);
  const wallet =
    balance === null
      ? line("info", C.wallet.loading)
      : t.total > balance
        ? line("warn", C.wallet.over(ks(balance)))
        : line("info", C.wallet.paid(ks(balance)));
  return {
    count,
    countSpoken: count.replace(/ · /g, `${ltComma()} `),
    totalLabel: C.list.totalLabel(t.tickets),
    total: ks(t.total),
    totalSpoken: C.list.totalSpoken(t.tickets, ks(t.total)),
    wallet,
  };
}

/** "Your list: 3 numbers, 5 tickets, 5,000 Ks." / "Your list is empty." — the tail of every spoken list change. */
export function listLine(list: readonly ListRow[], price: number): string {
  if (!list.length) return DRAW_COPY.list.say.empty;
  const t = totalsOf(list, price, 0);
  return DRAW_COPY.list.say.list(t.numbers, t.tickets, ks(t.total));
}

/**
 * Add 1 ticket of `number` (or 1 more when it is in the list already, an
 * empty box counting 0), never above `max` (the limit less what you hold). A
 * new number goes at the end.
 */
export function withAdded(list: readonly ListRow[], number: string, max: number): ListRow[] {
  const at = list.findIndex((r) => r.number === number);
  if (at < 0) return [...list, { number, qty: 1, last: 1 }];
  const qty = Math.min((list[at].qty ?? 0) + 1, Math.max(1, max));
  const next = list.slice();
  next[at] = { number, qty, last: qty };
  return next;
}

/** One row's quantity (null = its box is empty; the last quantity is kept for it). */
export function withQty(list: readonly ListRow[], number: string, qty: number | null): ListRow[] {
  return list.map((r) => (r.number === number ? { number, qty, last: qty ?? r.last } : r));
}

/**
 * Undo: put removed rows back where they were, with their quantities (an
 * empty box comes back as 1). A number added again since the removal is taken
 * out first, so Undo really brings back the row as it was — in its place, with
 * its quantity — rather than skipping it.
 */
export function withRestored(list: readonly ListRow[], rows: readonly ListRow[], at: number): ListRow[] {
  const saved = new Set(rows.map((r) => r.number));
  const next = list.filter((r) => !saved.has(r.number));
  const back = rows.map((r) => {
    const qty = r.qty ?? 1;
    return { number: r.number, qty, last: qty };
  });
  next.splice(Math.min(at, next.length), 0, ...back);
  return next;
}

/** A number handed in from elsewhere (Home's "Buy this number"): digits only, the first six — a string, zeros kept. */
export function cleanNumber(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 6);
}

/**
 * Quick pick: six random digits, zero-padded (4821 → "004821"), never a
 * number already in your list. Whether it is on sale, or at the most, is the
 * draw's answer once it is in the window (the help line says). Math.random is
 * fine here — it is a suggestion, not a draw.
 */
export function quickPick(inList: (number: string) => boolean): string {
  let next = "";
  for (let tries = 0; tries < 20; tries++) {
    next = pad(Math.floor(Math.random() * 1_000_000), 6);
    if (!inList(next)) break;
  }
  return next;
}
