/**
 * The Lottery's wire shapes — the dream books (phase 1, 2026-10-19), the
 * draws, purchases and tickets (phase 2) and the results, prizes and payouts
 * (phase 3, the same day). Every field mirrors the backend
 * contract exactly (backend/src/lottery): lottery numbers are zero-padded
 * STRINGS ("027" in the 1000 book, "004821" on a ticket), absent values are
 * null, instants are ISO strings in UTC (the apps show Myanmar time), and
 * money is a plain number of Ks.
 */

/** The two dream books: Dream Number 1000 (three digits) and Dream Number 100 (two). On the wire "1000" / "100". */
export type DreamBook = "1000" | "100";

export interface LotteryDream {
  id: string;
  book: DreamBook;
  /** "027" / "07" — leading zeros are part of it, so never turn one into a number. */
  number: string;
  /** At least one of the two names is set on a public row. */
  nameEn: string | null;
  nameMy: string | null;
  /** Our own upload, already rewritten for the address the request came in on; null = no picture yet. */
  pictureUrl: string | null;
}

export interface LotteryDreamsResponse {
  /** Active, named rows of one book, in number order. */
  items: LotteryDream[];
}

export interface LotteryDreamsQuery {
  book: DreamBook;
  /** A name fragment (case-insensitive contains) or a number prefix; omitted = the whole book. */
  q?: string;
}

/* ---------- draws ---------- */

/**
 * scheduled = not on sale yet · open · paused · closed = sales over ·
 * published = the result is out and the prizes are awarded (each winner
 * requests the payment; the admin confirms it — see the claims below).
 */
export type LotteryDrawStatus = "scheduled" | "open" | "paused" | "closed" | "published";

export interface LotteryDraw {
  id: string;
  drawNo: number;
  /** The Thai draw's calendar date, "YYYY-MM-DD". */
  thaiDrawDate: string;
  /** When the Thai draw happens (14:30 Bangkok = 14:00 Myanmar), ISO UTC. */
  drawAt: string;
  /** When sales close, ISO UTC — `salesCloseMinutesBefore` before `drawAt` unless the admin set it. */
  salesCloseAt: string;
  status: LotteryDrawStatus;
  /** Ks per ticket, copied into the draw when it was created. */
  ticketPrice: number;
  /** Tickets one customer may hold of one number in this draw (what is held + what is bought now). */
  maxPerNumber: number;
  /** The admin's picture for this draw's tickets; null = none yet (the app prints its bundled one). */
  pictureUrl: string | null;
  /**
   * The ticket frame (the background with every printed part) copied into the
   * draw when it was created, like `ticketPrice`; null = the app's built-in
   * frame. Same slot positions whatever the artwork (components/ticket/template.ts).
   */
  frameUrl: string | null;
  openedAt: string | null;
  closedAt: string | null;
  publishedAt: string | null;
  /** Winning tickets in this draw; null until published. */
  winnersCount: number | null;
  /** Ks paid out so far — the confirmed claims (2026-10-24: nothing is paid at publish); null until published. */
  prizesPaidKs: number | null;
}

/** GET /lottery/draws/current: the draw on sale (or next, or the latest finished) and the server's clock. */
export interface LotteryCurrentDraw {
  draw: LotteryDraw | null;
  /** ISO — the countdown is measured against this, never the phone's clock. */
  serverNow: string;
}

/** Every paged list of the Lottery API: `pageSize`, not the catalogue's `limit`. */
export interface LotteryPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LotteryPageQuery {
  page?: number;
  pageSize?: number;
}

/* ---------- availability ---------- */

/** POST /lottery/draws/:drawNo/availability — one row per number asked. */
export interface LotteryAvailability {
  number: string;
  offSale: boolean;
  /** Tickets this customer already holds of it in this draw (0 for a guest). */
  held: number;
  /** max(0, maxPerNumber − held); 0 when off sale. */
  left: number;
}

export interface LotteryAvailabilityResponse {
  items: LotteryAvailability[];
}

/* ---------- purchases ---------- */

export interface LotteryPurchaseLine {
  number: string;
  quantity: number;
}

export interface LotteryPurchaseInput {
  drawNo: number;
  /** A v4 uuid kept until the purchase succeeds: a replay returns the stored purchase, never a second charge. */
  idempotencyKey: string;
  /** 1 to 50 lines, distinct numbers, each 1..maxPerNumber. */
  lines: LotteryPurchaseLine[];
}

export interface LotteryPurchaseTicket {
  ticketNo: string;
  number: string;
}

export interface LotteryPurchase {
  /** "LP-261028-0144". */
  ref: string;
  drawNo: number;
  lines: LotteryPurchaseLine[];
  /** One record per ticket, in the order they were issued. */
  tickets: LotteryPurchaseTicket[];
  total: number;
  unitPrice: number;
  status: "paid";
  createdAt: string;
  /** The wallet right after this purchase — only on the POST answer. */
  balanceAfter?: number;
}

/* ---------- tickets ---------- */

export type LotteryTicketStatus = "waiting" | "won" | "notwon";

/** One prize group a ticket won: its key, the group's name and the Ks it paid for this ticket. */
export interface LotteryTicketWonGroup {
  key: LotteryPrizeGroupKey;
  name: string;
  ks: number;
}

/**
 * Where a WON ticket's prize stands (prize payment by request, 2026-10-24):
 * not_requested = awarded, nobody asked yet · requested = the customer's
 * claim waits for the admin · paid = confirmed and in the wallet · rejected =
 * the admin refused it (the reason is on the draw's claim view) · expired =
 * the claim deadline passed first.
 */
export type LotteryTicketClaimStatus = "not_requested" | "requested" | "paid" | "rejected" | "expired";

export interface LotteryTicket {
  /** "MFL-24-000468". */
  ticketNo: string;
  drawNo: number;
  number: string;
  status: LotteryTicketStatus;
  /** Ks won by this ticket once the result is published (the groups' Ks added up); null until then. */
  prizeKs: number | null;
  /** The groups it won in, in the fixed order; null until the draw is published (and [] for a ticket that did not win). */
  wonGroups: LotteryTicketWonGroup[] | null;
  /** Where its prize stands; null unless the ticket WON (one claim covers all of a customer's winning tickets in a draw). */
  claimStatus: LotteryTicketClaimStatus | null;
  purchaseRef: string;
  boughtAt: string;
}

export interface LotteryTicketsQuery extends LotteryPageQuery {
  drawNo?: number;
}

/** What a refused purchase carries beside its `code` (the error envelope's `details`). */
export interface LotteryLimitDetail {
  number: string;
  held: number;
  left: number;
}

/* ---------- results, prizes and winners (phase 3) ---------- */

/**
 * The nine Thai prize groups, in their fixed order (173 numbers a draw):
 * first (1, six digits) · nearFirst (2: the 1st prize ±1) · second (5) ·
 * third (10) · fourth (50) · fifth (100) · front3 (2 numbers of 3 digits:
 * the FIRST three) · back3 (2 of 3: the LAST three) · back2 (1 of 2: the
 * last two).
 */
export type LotteryPrizeGroupKey =
  | "first"
  | "nearFirst"
  | "second"
  | "third"
  | "fourth"
  | "fifth"
  | "front3"
  | "back3"
  | "back2";

/** One prize group of a published draw's sheet. */
export interface LotteryResultGroup {
  key: LotteryPrizeGroupKey;
  name: string;
  /** The Thai prize per ticket, in Baht. */
  baht: number;
  /** The same in Ks at the draw's rate — what a winning ticket is paid. */
  ks: number;
  /** How many numbers the group holds. */
  count: number;
  digits: 6 | 3 | 2;
  /** Zero-padded strings of `digits` digits, as the source listed them. */
  numbers: string[];
}

/**
 * GET /lottery/draws/:drawNo/results and each item of GET /lottery/results:
 * a published draw's whole sheet. 404 LOTTERY_RESULTS_NOT_PUBLISHED while
 * the draw is not published.
 */
export interface LotteryDrawResult {
  drawNo: number;
  /** "YYYY-MM-DD". */
  thaiDrawDate: string;
  /** ISO — when the admin published the result (the prizes are awarded then; each one is paid once its claim is confirmed). */
  publishedAt: string;
  /** Ks per Baht, copied into the draw at publish. */
  rate: number;
  /** The nine groups in the fixed order. */
  groups: LotteryResultGroup[];
}

/** GET /lottery/draws/:drawNo/winners — one winning ticket, by number only (never a name). */
export interface LotteryWinner {
  number: string;
  groupKey: LotteryPrizeGroupKey;
  groupName: string;
  /** Ks this ticket won (every group it won, added up). */
  ks: number;
}

export interface LotteryWinnersResponse {
  /** Biggest prize first, then by ticket number. */
  items: LotteryWinner[];
}

/* ---------- prize claims: payment by request (2026-10-24) ---------- */

/**
 * The customer's claim on one draw (GET /lottery/claims/draws/:drawNo):
 * none = no winning ticket in it · not_requested · requested · paid ·
 * rejected · expired — one claim per customer per draw, bundling every
 * winning ticket.
 */
export type LotteryDrawClaimStatus = "none" | LotteryTicketClaimStatus;

/** Why the admin rejected a claim, on the wire. */
export type LotteryClaimRejectReason = "suspicious_account" | "duplicate_request" | "ticket_under_review" | "other";

/** One winning ticket inside a draw's claim view. */
export interface LotteryDrawClaimTicket {
  ticketNo: string;
  number: string;
  /** Ks this ticket won (its groups added up). */
  ks: number;
  wonGroups: LotteryTicketWonGroup[];
}

/**
 * GET /lottery/claims/draws/:drawNo and the answer of POST /lottery/claims —
 * the customer's prize in one draw and where its payment stands. Money is a
 * plain number of Ks like the rest of the customer API; instants ISO UTC;
 * absent values null. 404 LOTTERY_DRAW_NOT_FOUND for an unknown draw.
 */
export interface LotteryDrawClaim {
  drawNo: number;
  /** "YYYY-MM-DD". */
  thaiDrawDate: string;
  drawStatus: LotteryDrawStatus;
  /** Winning tickets of this customer in the draw. */
  wonTickets: number;
  /** Their prizes added up, in Ks. */
  prizeKs: number;
  status: LotteryDrawClaimStatus;
  claimId: string | null;
  requestedAt: string | null;
  /** When the admin confirmed or rejected it. */
  decidedAt: string | null;
  /** Ks credited to the wallet when PAID. */
  paidKs: number | null;
  rejectReason: LotteryClaimRejectReason | null;
  /** The admin's note (≤ 300 chars; always set when the reason is "other"). */
  rejectNote: string | null;
  /** Until when the prize can be requested (publishedAt + the claim deadline setting); null until published. */
  claimDeadlineAt: string | null;
  tickets: LotteryDrawClaimTicket[];
}

/** POST /lottery/claims — one request covers every winning ticket of the draw. */
export interface LotteryClaimRequestInput {
  drawNo: number;
}

/** One row of GET /lottery/claims (my claims, newest first). */
export interface LotteryMyClaim {
  claimId: string;
  drawNo: number;
  thaiDrawDate: string;
  status: "requested" | "paid" | "rejected";
  ks: number;
  ticketsCount: number;
  requestedAt: string;
  decidedAt: string | null;
}
