/**
 * Ticket PILES (Tickets.dc.html `build` / `pileOf`) and the "Check my tickets"
 * totals (CheckTickets.dc.html `ENTRIES` / `D`). The same number bought more
 * than once in the same draw is ONE pile: the tickets behind peek their top
 * strip, the newest lies in front, whole, and the pile has one result. Piles
 * never mix draws. Pure functions over TicketItem lists.
 *
 * ─── API for the screens ────────────────────────────────────────────────────
 *
 * Types
 *   TicketPile   { key, drawNo, number, tickets, count, front, behind, status, wins, each, total, cost }
 *   FoldedPile   { strips, hidden, folds, front }
 *   DrawCheck    { drawNo, piles, tickets, wonTickets, total }
 *
 * Constants
 *   PILE_MAX = 4                 (kept for the folding code; the owner asked on 2026-10-20 that every
 *                                ticket is shown, so a pile never folds and "+N more" is never drawn)
 *
 * Functions
 *   pileKey(drawNo: number, number: string): string                     "24-372694"
 *   pileTickets(tickets, price?, sheet?): TicketPile[]                   group + order (see below)
 *   pilesForDraw(drawNo, tickets, price?, sheet?): TicketPile[]
 *   foldPile(pile: TicketPile, open: boolean): FoldedPile                what to draw for the pile right now
 *   drawCheck(drawNo, tickets, sheet, price?): DrawCheck                 "3 of 4 tickets won · 60,040,000 Ks"
 *
 * Order: inside a pile, tickets lie in buying order (boughtIso, then ticket
 * ID, which rises with each sale): tickets[0] is the top strip, the last one
 * is the front. Piles come in the order their number was FIRST bought.
 *
 * A pile's RESULT (phase 3, 2026-10-19): with the draw's published SHEET
 * (data/prizes.ts) the number is matched against all nine groups, as the
 * boards do — that is what Check my tickets reveals, group by group. Without
 * a sheet on the page (My tickets, TicketView) the pile carries its tickets'
 * own verdict from the API — status, `wonGroups` and `prizeKs` (every ticket
 * of one number in one draw has the same one) — all "waiting" until the
 * draw is published.
 */
import { matchNumber, prizeTotal, winsFromGroups, type PrizeSheet, type PrizeWin } from "@/lottery/data/prizes";
import type { TicketItem, TicketStatus } from "@/lottery/data/sample";

/** Over this many tickets a pile folds (Tickets `PILE_MAX`). */
export const PILE_MAX = 4;

export interface TicketPile {
  /** "23-731560" — stable key for lists and the open / closed map. */
  key: string;
  drawNo: number;
  number: string;
  /** Buying order: [0] = the top strip (bought first), last = the front. Always ≥ 1. */
  tickets: readonly TicketItem[];
  count: number;
  /** The newest ticket, drawn whole. */
  front: TicketItem;
  /** Every ticket behind the front (top strip first); [] for a single ticket. */
  behind: readonly TicketItem[];
  /** One number in one draw has one result: waiting / won / notwon. */
  status: TicketStatus;
  /** The prizes ONE ticket of this pile wins (board order); [] = waiting or not won. */
  wins: readonly PrizeWin[];
  /** Ks per ticket. */
  each: number;
  /** Ks for the whole pile = each × count. */
  total: number;
  /** What the pile cost: count × the draw's price (the caption "372694 × 3 · 3,000 Ks"). */
  cost: number;
}

export function pileKey(drawNo: number, number: string): string {
  return `${drawNo}-${number}`;
}

function boughtOrder(a: TicketItem, b: TicketItem): number {
  if (a.boughtIso !== b.boughtIso) return a.boughtIso < b.boughtIso ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Same draw + same number → one pile. Works on any list (any order); the
 * input is not changed. `price` is the draw's own Ks per ticket for the cost
 * caption — unknown (undefined) while the draw loads, and then the cost is 0
 * and the caption leaves it out; never the sample's price. `sheet` is the
 * draw's published sheet when the page has it, and then decides the result
 * (every pile must be of that sheet's draw).
 */
export function pileTickets(tickets: readonly TicketItem[], price?: number, sheet?: PrizeSheet): TicketPile[] {
  const sorted = tickets.slice().sort(boughtOrder);
  const order: string[] = [];
  const by = new Map<string, TicketItem[]>();
  for (const t of sorted) {
    const key = pileKey(t.drawNo, t.number);
    let list = by.get(key);
    if (!list) {
      list = [];
      by.set(key, list);
      order.push(key);
    }
    list.push(t);
  }
  return order.map((key) => {
    const list = by.get(key) ?? [];
    const first = list[0];
    const front = list[list.length - 1];
    const bySheet = !!sheet && sheet.drawNo === first.drawNo;
    // The sheet decides when the page has it; otherwise the tickets say for themselves.
    const wins = bySheet ? matchNumber(sheet, first.number) : winsFromGroups(front.number, front.wonGroups);
    // The Ks per ticket is what the API paid whenever the ticket is settled
    // (the wallet credit, to the satang); the sheet's per-group sum stands
    // in only for a ticket still cached as waiting.
    const settled = front.status !== "waiting" && front.prizeKs !== null && front.prizeKs !== undefined;
    const each = settled ? Math.max(0, front.prizeKs as number) : prizeTotal(wins);
    const status: TicketStatus = bySheet ? (wins.length ? "won" : "notwon") : front.status;
    return {
      key,
      drawNo: first.drawNo,
      number: first.number,
      tickets: list,
      count: list.length,
      front,
      behind: list.slice(0, -1),
      status,
      wins,
      each,
      total: each * list.length,
      cost: price ? list.length * price : 0,
    };
  });
}

/** The piles of one draw, in first-purchase order. */
export function pilesForDraw(
  drawNo: number,
  tickets: readonly TicketItem[],
  price?: number,
  sheet?: PrizeSheet,
): TicketPile[] {
  return pileTickets(
    tickets.filter((t) => t.drawNo === drawNo),
    price,
    sheet,
  );
}

export interface FoldedPile {
  /** The strips to draw behind the front, top first. */
  strips: readonly TicketItem[];
  /** Tickets hidden behind the "+N more" strip (0 when nothing is hidden). */
  hidden: number;
  /** The pile has more than PILE_MAX tickets, so a "+N more" / "Show fewer" strip is drawn. */
  folds: boolean;
  front: TicketItem;
}

/**
 * Every strip, then the front — a pile never folds. The board folded piles
 * of more than PILE_MAX ("+N more" / "Show fewer"), but the owner wants to
 * see all the tickets at a glance (2026-10-20), so `open` is ignored and
 * `folds` is always false; the strip is kept in TicketPile for the day the
 * rule comes back.
 */
export function foldPile(pile: TicketPile, _open: boolean): FoldedPile {
  return { strips: pile.behind, hidden: 0, folds: false, front: pile.front };
}

export interface DrawCheck {
  drawNo: number;
  /** One entry per number (CheckTickets checks a pile as one: "Check both tickets"). */
  piles: readonly TicketPile[];
  tickets: number;
  wonTickets: number;
  /** Ks for the draw. */
  total: number;
}

/**
 * "Check my tickets" for one published draw: the customer's piles of that
 * draw in first-purchase order, each matched against the sheet, and the
 * totals — "3 of 4 tickets won · 60,040,000 Ks".
 */
export function drawCheck(drawNo: number, tickets: readonly TicketItem[], sheet: PrizeSheet, price?: number): DrawCheck {
  const piles = pilesForDraw(drawNo, tickets, price, sheet);
  let count = 0;
  let wonTickets = 0;
  let total = 0;
  for (const pile of piles) {
    count += pile.count;
    if (pile.wins.length) wonTickets += pile.count;
    total += pile.total;
  }
  return { drawNo, piles, tickets: count, wonTickets, total };
}
