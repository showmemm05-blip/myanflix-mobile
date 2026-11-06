/**
 * The SHARED SHAPES of the Lottery screens — and the last two bits of
 * sample art.
 *
 * Since phase 3 (2026-10-19) everything the Lottery shows is the API's: the
 * dreams, the draws, purchases, tickets, the wallet, the results, prizes and
 * winners. The shapes at the top (DrawInfo, TicketItem, PurchaseItem) are
 * what data/draws.ts maps the API into and what every ticket surface reads.
 * What stays sample is decoration only: the two tickets fanned on Home's
 * current-draw card (printed on the real draw; their numbers are the
 * board's) — plus the one sample draw the dream generator prints on while
 * there is no real draw yet.
 *
 * Every lottery number is a six-digit STRING ("004821"): leading zeros are
 * part of it, so never turn one into a number.
 */

import type { LotteryTicketClaimStatus } from "@/types/lottery";

/** The sample draw's price and per-number limit (real draws carry their own). */
export const TICKET_PRICE = 1000;
export const MOST_PER_NUMBER = 20;

export type DrawNo = 24;
export type DrawStatus = "open" | "paused" | "closed" | "scheduled" | "published";

/**
 * What every screen needs to know about a draw — printed on the ticket, in
 * the card heads and the captions (data/draws.ts `drawInfoOf`).
 */
export interface DrawInfo {
  no: number;
  /** The draw's calendar date in Myanmar time, "YYYY-MM-DD". */
  dateIso: string;
  /** "2:00 PM" — when the draw happens, Myanmar time. */
  drawTime: string;
  /** "1:00 PM" — when sales close (with its day in front when that is not the draw's day). */
  closeTime: string;
  price: number;
  /** Tickets one customer may hold of one number in this draw. */
  maxPerNumber: number;
  status: DrawStatus;
  /** ISO — real draws only; the countdown is measured to it. */
  salesCloseAt?: string;
  /** "6:20 PM" — published draws only (Myanmar time). */
  publishedAt?: string;
  /** The admin's picture for a draw's tickets; null or missing = the picture slot stays empty. */
  pictureUrl?: string | null;
  /** The frame a real draw's tickets were sold with (copied into the draw); null or missing = the bundled frame. */
  frameUrl?: string | null;
}

export interface SampleDraw extends DrawInfo {
  no: DrawNo;
}

/** The one sample draw: what the hero fan and the dream generator print on while there is no real draw. */
export const SAMPLE_DRAWS: Record<DrawNo, SampleDraw> = {
  24: {
    no: 24,
    dateIso: "2026-10-31",
    drawTime: "6:00 PM",
    closeTime: "5:00 PM",
    price: TICKET_PRICE,
    maxPerNumber: MOST_PER_NUMBER,
    status: "open",
  },
};

export const SAMPLE_CURRENT_DRAW: DrawNo = 24;

export type TicketStatus = "waiting" | "won" | "notwon";

/** One prize group a ticket won, as the API says it (types/lottery.ts LotteryTicketWonGroup). */
export interface TicketWonGroup {
  key: string;
  name: string;
  ks: number;
}

/**
 * One ticket as every ticket surface reads it (TicketPile, DrawGroup,
 * TicketView): the API ticket mapped by data/draws.ts
 * `ticketItemOf`.
 */
export interface TicketItem {
  /** The ticket number, "MFL-24-000184". */
  id: string;
  drawNo: number;
  number: string;
  /** "Mon 26 Oct 2026, 7:02 PM" — as printed in rows (Myanmar time). */
  boughtAt: string;
  /** For sorting and day grouping. */
  boughtIso: string;
  purchaseRef: string;
  status: TicketStatus;
  /** Ks won once the result is out; null until then. */
  prizeKs?: number | null;
  /** The groups it won in (the API's verdict); null until the draw is published, [] when it did not win. */
  wonGroups?: readonly TicketWonGroup[] | null;
  /**
   * Where a WON ticket's prize payment stands (2026-10-24: prizes are paid by
   * request, one claim per draw); null or missing unless it won.
   */
  claimStatus?: LotteryTicketClaimStatus | null;
}

export interface PurchaseLine {
  number: string;
  quantity: number;
}

/**
 * One purchase as History and Printed read it: the real API purchase mapped
 * by data/draws.ts `purchaseItemOf`. `status` "failed" is the design's
 * "attempt that did not complete"; the API only ever records paid ones.
 */
export interface PurchaseItem {
  /** "LP-261028-0144". */
  ref: string;
  drawNo: number;
  lines: PurchaseLine[];
  /** One ticket record per ticket bought (spec rule 4), in the order they were issued. */
  ticketIds: string[];
  /** "Wed 28 Oct 2026, 6:20 PM". */
  at: string;
  atIso: string;
  /** For the day headers: "Wednesday 28 October 2026". */
  day: string;
  /** "6:20 PM". */
  time: string;
  total: number;
  /** Ks per ticket in this purchase. */
  unitPrice: number;
  status: "paid" | "failed";
  /** The wallet right after it — only known on the purchase that was just made. */
  balanceAfter?: number;
}

/**
 * Home's current-draw card: two sample tickets fanned on it (back, then
 * front), printed on the current draw — the board's numbers (22 Oct 2026).
 * Their IDs take the draw's own number: MFL-NN-<seq>.
 */
export const SAMPLE_HOME_HERO = {
  back: { seq: "000309", number: "004821" },
  front: { seq: "000184", number: "372694" },
} as const;
