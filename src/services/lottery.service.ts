import { lotteryApi } from "@/api/lottery.api";
import type { RequestSignalOptions } from "@/types/api";
import type {
  DreamBook,
  LotteryAvailability,
  LotteryClaimRejectReason,
  LotteryCurrentDraw,
  LotteryDraw,
  LotteryDrawClaim,
  LotteryDrawClaimStatus,
  LotteryDrawClaimTicket,
  LotteryDrawResult,
  LotteryDrawStatus,
  LotteryDream,
  LotteryDreamsQuery,
  LotteryMyClaim,
  LotteryPage,
  LotteryPageQuery,
  LotteryPurchase,
  LotteryPrizeGroupKey,
  LotteryPurchaseInput,
  LotteryResultGroup,
  LotteryTicket,
  LotteryTicketClaimStatus,
  LotteryTicketWonGroup,
  LotteryTicketsQuery,
  LotteryWinner,
} from "@/types/lottery";

/** A name as the screens want it: trimmed, and null when the server sent nothing usable. */
function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** A usable URL, or null. */
function cleanUrl(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

/**
 * Money and counts as numbers. A Prisma Decimal can arrive as a string
 * ("1000.00"), and `+` on a string concatenates — the wallet filters learnt
 * the same lesson (utils/walletFilters.ts sumAmounts).
 */
function num(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isoOrNull(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

/**
 * One dream as the screens read it: every field present, names trimmed, the
 * picture null unless it is a usable URL — so no card has to guard a field
 * an older server left out.
 */
function mapDream(raw: LotteryDream): LotteryDream {
  return {
    id: raw.id,
    book: raw.book,
    number: raw.number,
    nameEn: cleanName(raw.nameEn),
    nameMy: cleanName(raw.nameMy),
    pictureUrl: cleanUrl(raw.pictureUrl),
  };
}

/** One draw with its money and limit as numbers and every optional instant null rather than missing. */
function mapDraw(raw: LotteryDraw): LotteryDraw {
  return {
    id: raw.id,
    drawNo: num(raw.drawNo),
    thaiDrawDate: raw.thaiDrawDate,
    drawAt: raw.drawAt,
    salesCloseAt: raw.salesCloseAt,
    status: raw.status,
    ticketPrice: num(raw.ticketPrice),
    maxPerNumber: Math.max(1, num(raw.maxPerNumber, 1)),
    pictureUrl: cleanUrl(raw.pictureUrl),
    frameUrl: cleanUrl(raw.frameUrl),
    openedAt: isoOrNull(raw.openedAt),
    closedAt: isoOrNull(raw.closedAt),
    publishedAt: isoOrNull(raw.publishedAt),
    winnersCount: raw.winnersCount === null || raw.winnersCount === undefined ? null : num(raw.winnersCount),
    prizesPaidKs: raw.prizesPaidKs === null || raw.prizesPaidKs === undefined ? null : num(raw.prizesPaidKs),
  };
}

function mapPurchase(raw: LotteryPurchase): LotteryPurchase {
  const purchase: LotteryPurchase = {
    ref: raw.ref,
    drawNo: num(raw.drawNo),
    lines: Array.isArray(raw.lines)
      ? raw.lines.map((line) => ({ number: line.number, quantity: num(line.quantity) }))
      : [],
    tickets: Array.isArray(raw.tickets) ? raw.tickets.map((t) => ({ ticketNo: t.ticketNo, number: t.number })) : [],
    total: num(raw.total),
    unitPrice: num(raw.unitPrice),
    status: "paid",
    createdAt: raw.createdAt,
  };
  // Only the POST answer carries it; a list row must not pretend to.
  if (raw.balanceAfter !== undefined && raw.balanceAfter !== null) purchase.balanceAfter = num(raw.balanceAfter);
  return purchase;
}

/** The nine group keys the apps know; anything else from the wire is dropped rather than drawn wrong. */
const GROUP_KEYS: readonly LotteryPrizeGroupKey[] = [
  "first",
  "nearFirst",
  "second",
  "third",
  "fourth",
  "fifth",
  "front3",
  "back3",
  "back2",
];

function isGroupKey(value: unknown): value is LotteryPrizeGroupKey {
  return typeof value === "string" && (GROUP_KEYS as readonly string[]).includes(value);
}

/** A prize number as a zero-padded string, whatever the wire sent (a number would lose its leading zeros). */
function numberString(value: unknown, digits: number): string | null {
  if (typeof value === "string") return /^\d+$/.test(value) ? value.padStart(digits, "0") : null;
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return String(value).padStart(digits, "0");
  return null;
}

/** A ticket's won groups: an array once published (empty for not won), null before; unknown keys are left out. */
function mapWonGroups(value: unknown): LotteryTicketWonGroup[] | null {
  if (!Array.isArray(value)) return null;
  const out: LotteryTicketWonGroup[] = [];
  for (const g of value as Partial<LotteryTicketWonGroup>[]) {
    if (!g || !isGroupKey(g.key)) continue;
    out.push({ key: g.key, name: cleanName(g.name) ?? g.key, ks: num(g.ks) });
  }
  return out;
}

/** The five claim states a WON ticket can be in; anything else (an older server, a typo) is "unknown" = null. */
const TICKET_CLAIM_STATUSES: readonly LotteryTicketClaimStatus[] = [
  "not_requested",
  "requested",
  "paid",
  "rejected",
  "expired",
];

function ticketClaimStatusOf(value: unknown): LotteryTicketClaimStatus | null {
  return typeof value === "string" && (TICKET_CLAIM_STATUSES as readonly string[]).includes(value)
    ? (value as LotteryTicketClaimStatus)
    : null;
}

function mapTicket(raw: LotteryTicket): LotteryTicket {
  const status = raw.status === "won" || raw.status === "notwon" ? raw.status : "waiting";
  return {
    ticketNo: raw.ticketNo,
    drawNo: num(raw.drawNo),
    number: raw.number,
    status,
    prizeKs: raw.prizeKs === null || raw.prizeKs === undefined ? null : num(raw.prizeKs),
    wonGroups: mapWonGroups(raw.wonGroups),
    // Only a won ticket carries a claim; a server that left the field out gets null (no chip, nothing to request here).
    claimStatus: status === "won" ? ticketClaimStatusOf(raw.claimStatus) : null,
    purchaseRef: raw.purchaseRef,
    boughtAt: raw.boughtAt,
  };
}

/** A sheet group with its money as numbers and its numbers as zero-padded strings; null for an unknown key. */
function mapResultGroup(raw: Partial<LotteryResultGroup> | null | undefined): LotteryResultGroup | null {
  if (!raw || !isGroupKey(raw.key)) return null;
  const digits: 6 | 3 | 2 = raw.digits === 3 || raw.digits === 2 ? raw.digits : 6;
  const numbers = Array.isArray(raw.numbers)
    ? raw.numbers.map((n) => numberString(n, digits)).filter((n): n is string => n !== null)
    : [];
  return {
    key: raw.key,
    name: cleanName(raw.name) ?? raw.key,
    baht: num(raw.baht),
    ks: num(raw.ks),
    count: Math.max(0, num(raw.count, numbers.length)),
    digits,
    numbers,
  };
}

/** A published draw's sheet: the groups in the wire's order, unknown ones dropped, money as numbers. */
function mapDrawResult(raw: LotteryDrawResult): LotteryDrawResult {
  const groups = Array.isArray(raw.groups)
    ? raw.groups.map(mapResultGroup).filter((g): g is LotteryResultGroup => g !== null)
    : [];
  return {
    drawNo: num(raw.drawNo),
    thaiDrawDate: typeof raw.thaiDrawDate === "string" ? raw.thaiDrawDate.slice(0, 10) : "",
    publishedAt: typeof raw.publishedAt === "string" ? raw.publishedAt : "",
    rate: num(raw.rate),
    groups,
  };
}

/** One winning ticket by number only; null when the row has no usable number or group. */
function mapWinner(raw: Partial<LotteryWinner> | null | undefined): LotteryWinner | null {
  if (!raw || !isGroupKey(raw.groupKey)) return null;
  const number = numberString(raw.number, 6);
  if (!number) return null;
  return { number, groupKey: raw.groupKey, groupName: cleanName(raw.groupName) ?? raw.groupKey, ks: num(raw.ks) };
}

/* ---------- prize claims (2026-10-24) ---------- */

const DRAW_STATUSES: readonly LotteryDrawStatus[] = ["scheduled", "open", "paused", "closed", "published"];
const REJECT_REASONS: readonly LotteryClaimRejectReason[] = [
  "suspicious_account",
  "duplicate_request",
  "ticket_under_review",
  "other",
];

/**
 * The draw claim's status, validated. An unknown word is treated as "none":
 * the screens then show no claim block at all, which is safer than offering
 * a "Request payment" the server would refuse.
 */
function drawClaimStatusOf(value: unknown): LotteryDrawClaimStatus {
  if (value === "none") return "none";
  return ticketClaimStatusOf(value) ?? "none";
}

function rejectReasonOf(value: unknown): LotteryClaimRejectReason | null {
  return typeof value === "string" && (REJECT_REASONS as readonly string[]).includes(value)
    ? (value as LotteryClaimRejectReason)
    : null;
}

function mapClaimTicket(raw: Partial<LotteryDrawClaimTicket> | null | undefined): LotteryDrawClaimTicket | null {
  if (!raw || typeof raw.ticketNo !== "string") return null;
  const number = numberString(raw.number, 6);
  if (!number) return null;
  return { ticketNo: raw.ticketNo, number, ks: num(raw.ks), wonGroups: mapWonGroups(raw.wonGroups) ?? [] };
}

/** The draw's claim view with every number a number, every absent value null, and only known statuses. */
function mapDrawClaim(raw: LotteryDrawClaim): LotteryDrawClaim {
  const tickets = Array.isArray(raw.tickets)
    ? raw.tickets.map(mapClaimTicket).filter((t): t is LotteryDrawClaimTicket => t !== null)
    : [];
  return {
    drawNo: num(raw.drawNo),
    thaiDrawDate: typeof raw.thaiDrawDate === "string" ? raw.thaiDrawDate.slice(0, 10) : "",
    drawStatus: (DRAW_STATUSES as readonly string[]).includes(raw.drawStatus) ? raw.drawStatus : "published",
    wonTickets: Math.max(0, num(raw.wonTickets, tickets.length)),
    prizeKs: Math.max(0, num(raw.prizeKs)),
    status: drawClaimStatusOf(raw.status),
    claimId: typeof raw.claimId === "string" && raw.claimId ? raw.claimId : null,
    requestedAt: isoOrNull(raw.requestedAt),
    decidedAt: isoOrNull(raw.decidedAt),
    paidKs: raw.paidKs === null || raw.paidKs === undefined ? null : num(raw.paidKs),
    rejectReason: rejectReasonOf(raw.rejectReason),
    rejectNote: cleanName(raw.rejectNote),
    claimDeadlineAt: isoOrNull(raw.claimDeadlineAt),
    tickets,
  };
}

function mapMyClaim(raw: LotteryMyClaim): LotteryMyClaim {
  return {
    claimId: raw.claimId,
    drawNo: num(raw.drawNo),
    thaiDrawDate: typeof raw.thaiDrawDate === "string" ? raw.thaiDrawDate.slice(0, 10) : "",
    status: raw.status === "paid" || raw.status === "rejected" ? raw.status : "requested",
    ks: num(raw.ks),
    ticketsCount: Math.max(0, num(raw.ticketsCount)),
    requestedAt: typeof raw.requestedAt === "string" ? raw.requestedAt : "",
    decidedAt: isoOrNull(raw.decidedAt),
  };
}

function mapPage<T, U>(raw: LotteryPage<T> | undefined, map: (item: T) => U, query: LotteryPageQuery): LotteryPage<U> {
  const items = Array.isArray(raw?.items) ? raw.items.map(map) : [];
  return {
    items,
    total: num(raw?.total, items.length),
    page: num(raw?.page, query.page ?? 1),
    pageSize: num(raw?.pageSize, query.pageSize ?? items.length),
  };
}

export const lotteryService = {
  /** One book's dreams (or the ones matching `q`), always an array, in number order. */
  async getDreams(query: LotteryDreamsQuery, options: RequestSignalOptions = {}): Promise<LotteryDream[]> {
    const data = await lotteryApi.getDreams(query, options);
    return Array.isArray(data?.items) ? data.items.map(mapDream) : [];
  },

  async getDream(book: DreamBook, number: string, options: RequestSignalOptions = {}): Promise<LotteryDream> {
    return mapDream(await lotteryApi.getDream(book, number, options));
  },

  /* ---------- draws ---------- */

  async getCurrentDraw(options: RequestSignalOptions = {}): Promise<LotteryCurrentDraw> {
    const data = await lotteryApi.getCurrentDraw(options);
    return {
      draw: data?.draw ? mapDraw(data.draw) : null,
      // A server that left the clock out gets the phone's: the countdown then trusts the phone, nothing worse.
      serverNow: typeof data?.serverNow === "string" ? data.serverNow : new Date().toISOString(),
    };
  },

  async getDraws(query: LotteryPageQuery = {}, options: RequestSignalOptions = {}): Promise<LotteryPage<LotteryDraw>> {
    return mapPage(await lotteryApi.getDraws(query, options), mapDraw, query);
  },

  async getDraw(drawNo: number, options: RequestSignalOptions = {}): Promise<LotteryDraw> {
    return mapDraw(await lotteryApi.getDraw(drawNo, options));
  },

  /** The rows in the order asked; a number the server left out is treated as on sale with nothing held. */
  async getAvailability(
    drawNo: number,
    numbers: readonly string[],
    options: RequestSignalOptions = {},
  ): Promise<LotteryAvailability[]> {
    const data = await lotteryApi.getAvailability(drawNo, numbers, options);
    const rows = Array.isArray(data?.items) ? data.items : [];
    return rows.map((row) => ({
      number: row.number,
      offSale: !!row.offSale,
      held: Math.max(0, num(row.held)),
      left: Math.max(0, num(row.left)),
    }));
  },

  /* ---------- purchases and tickets ---------- */

  async createPurchase(input: LotteryPurchaseInput): Promise<LotteryPurchase> {
    return mapPurchase(await lotteryApi.createPurchase(input));
  },

  async getPurchases(
    query: LotteryPageQuery = {},
    options: RequestSignalOptions = {},
  ): Promise<LotteryPage<LotteryPurchase>> {
    return mapPage(await lotteryApi.getPurchases(query, options), mapPurchase, query);
  },

  async getPurchase(ref: string, options: RequestSignalOptions = {}): Promise<LotteryPurchase> {
    return mapPurchase(await lotteryApi.getPurchase(ref, options));
  },

  async getTickets(
    query: LotteryTicketsQuery = {},
    options: RequestSignalOptions = {},
  ): Promise<LotteryPage<LotteryTicket>> {
    return mapPage(await lotteryApi.getTickets(query, options), mapTicket, query);
  },

  async getTicket(ticketNo: string, options: RequestSignalOptions = {}): Promise<LotteryTicket> {
    return mapTicket(await lotteryApi.getTicket(ticketNo, options));
  },

  /* ---------- presence ---------- */

  /** Fire-and-forget; the caller (hooks/useLotteryPresence) swallows any error. */
  async pingActivity(): Promise<void> {
    await lotteryApi.pingActivity();
  },

  /* ---------- results, prizes and winners ---------- */

  async getResults(
    query: LotteryPageQuery = {},
    options: RequestSignalOptions = {},
  ): Promise<LotteryPage<LotteryDrawResult>> {
    return mapPage(await lotteryApi.getResults(query, options), mapDrawResult, query);
  },

  async getDrawResults(drawNo: number, options: RequestSignalOptions = {}): Promise<LotteryDrawResult> {
    return mapDrawResult(await lotteryApi.getDrawResults(drawNo, options));
  },

  /** The draw's winners as sent (biggest prize first); rows without a usable number are left out. */
  async getDrawWinners(drawNo: number, limit: number, options: RequestSignalOptions = {}): Promise<LotteryWinner[]> {
    const data = await lotteryApi.getDrawWinners(drawNo, limit, options);
    const rows = Array.isArray(data?.items) ? data.items : [];
    return rows.map(mapWinner).filter((w): w is LotteryWinner => w !== null);
  },

  /* ---------- prize claims: payment by request (2026-10-24) ---------- */

  /** My prize in one draw and where its payment stands (404 for an unknown draw). */
  async getDrawClaim(drawNo: number, options: RequestSignalOptions = {}): Promise<LotteryDrawClaim> {
    return mapDrawClaim(await lotteryApi.getDrawClaim(drawNo, options));
  },

  /** One request for every winning ticket I hold in the draw; the answer is the draw's claim view, now "requested". */
  async requestClaim(drawNo: number): Promise<LotteryDrawClaim> {
    return mapDrawClaim(await lotteryApi.requestClaim({ drawNo }));
  },

  async listMyClaims(
    query: LotteryPageQuery = {},
    options: RequestSignalOptions = {},
  ): Promise<LotteryPage<LotteryMyClaim>> {
    return mapPage(await lotteryApi.getMyClaims(query, options), mapMyClaim, query);
  },
};
