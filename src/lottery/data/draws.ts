/**
 * The API's draws, tickets and purchases in the shapes the screens were built
 * on (data/sample.ts DrawInfo / TicketItem / PurchaseItem), so TicketPile,
 * DrawGroup, PurchaseRow and the rest draw a real record exactly
 * as they drew a sample one. Pure functions; every instant is shown in
 * Myanmar time (data/format.ts).
 */
import { COMPONENT_COPY } from "@/lottery/components/copy";
import { clock12, dateShort, dateTimeLabel, dayLabel, myanmarParts, timeLabel } from "@/lottery/data/format";
import type { DrawInfo, DrawStatus, PurchaseItem, TicketItem } from "@/lottery/data/sample";
import type { LotteryDraw, LotteryPurchase, LotteryTicket } from "@/types/lottery";

/**
 * "1:00 PM", or "Fri 30 Oct, 1:00 PM" when sales close on another day than
 * the draw (an admin can set any close time).
 */
function closeLabel(salesCloseAt: string, drawDateIso: string): string {
  const parts = myanmarParts(salesCloseAt);
  if (!parts) return "";
  const time = clock12(parts.hours, parts.minutes);
  return parts.dateIso === drawDateIso ? time : COMPONENT_COPY.dayTime(shortDay(parts.dateIso), time);
}

/** "Sat 31 Oct" — a calendar date without its year. */
function shortDay(dateIso: string): string {
  return dateShort(dateIso).replace(/ \d{4}$/, "");
}

/**
 * "Sat 31 Oct, 5:00 PM" — when sales close, ALWAYS with the close instant's
 * own day (Myanmar time), for a line that names no draw date beside it
 * (My tickets' "Draw 26 is open for sale until …"). An admin can set any
 * close time, so the draw's own date is not the close's. "" when unknown.
 */
export function saleCloseLabel(draw: Pick<DrawInfo, "dateIso" | "closeTime" | "salesCloseAt">): string {
  const parts = draw.salesCloseAt ? myanmarParts(draw.salesCloseAt) : null;
  if (parts) return COMPONENT_COPY.dayTime(shortDay(parts.dateIso), clock12(parts.hours, parts.minutes));
  // No instant (a sample draw): `closeTime` names its own day when it differs from the draw's (after a "," or a Burmese "၊").
  if (!draw.closeTime) return "";
  return /[,၊]/.test(draw.closeTime) ? draw.closeTime : COMPONENT_COPY.dayTime(shortDay(draw.dateIso), draw.closeTime);
}

export function drawInfoOf(draw: LotteryDraw): DrawInfo {
  return {
    no: draw.drawNo,
    dateIso: draw.thaiDrawDate,
    drawTime: timeLabel(draw.drawAt),
    closeTime: closeLabel(draw.salesCloseAt, draw.thaiDrawDate),
    price: draw.ticketPrice,
    maxPerNumber: draw.maxPerNumber,
    status: draw.status,
    salesCloseAt: draw.salesCloseAt,
    pictureUrl: draw.pictureUrl,
    frameUrl: draw.frameUrl,
    publishedAt: draw.publishedAt ? timeLabel(draw.publishedAt) : undefined,
  };
}

/**
 * The status the screens act on: an OPEN or PAUSED draw whose close time has
 * passed is CLOSED here at once — the server refuses a purchase after it
 * whatever the cron has got round to, so the page must not offer one.
 */
export function saleStatus(draw: Pick<DrawInfo, "status" | "salesCloseAt">, nowMs: number): DrawStatus {
  if (draw.status !== "open" && draw.status !== "paused") return draw.status;
  const closeMs = draw.salesCloseAt ? Date.parse(draw.salesCloseAt) : NaN;
  return Number.isFinite(closeMs) && nowMs >= closeMs ? "closed" : draw.status;
}

/** Where a draw's tickets are shown: the Tickets tab (My tickets) or Lottery history. */
export type TicketPlace = "tickets" | "history";

/**
 * THE RULE (owner, 2026-10-27: "keep tickets until next draw show up"). A
 * draw's tickets stay on My tickets while the draw is the current one or
 * newer (`currentNo` = GET /lottery/draws/current), or while it is still
 * waiting for its results — a draw that is not published never leaves My
 * tickets, even after a newer draw shows up. Every other draw (published,
 * and older than the current one) is History's. So a published draw keeps
 * its results, Won chips and "Request payment" on My tickets until the
 * admin creates the next draw. No current draw at all (null): everything
 * stays on My tickets.
 */
export function ticketPlaceOf(drawNo: number, status: DrawStatus, currentNo: number | null): TicketPlace {
  if (currentNo === null || drawNo >= currentNo || status !== "published") return "tickets";
  return "history";
}

export function ticketItemOf(ticket: LotteryTicket): TicketItem {
  return {
    id: ticket.ticketNo,
    drawNo: ticket.drawNo,
    number: ticket.number,
    boughtAt: dateTimeLabel(ticket.boughtAt),
    boughtIso: ticket.boughtAt,
    purchaseRef: ticket.purchaseRef,
    status: ticket.status,
    prizeKs: ticket.prizeKs,
    wonGroups: ticket.wonGroups,
    claimStatus: ticket.claimStatus,
  };
}

export function purchaseItemOf(purchase: LotteryPurchase): PurchaseItem {
  const item: PurchaseItem = {
    ref: purchase.ref,
    drawNo: purchase.drawNo,
    lines: purchase.lines.map((line) => ({ number: line.number, quantity: line.quantity })),
    ticketIds: purchase.tickets.map((ticket) => ticket.ticketNo),
    at: dateTimeLabel(purchase.createdAt),
    atIso: purchase.createdAt,
    day: dayLabel(purchase.createdAt),
    time: timeLabel(purchase.createdAt),
    total: purchase.total,
    unitPrice: purchase.unitPrice,
    status: "paid",
  };
  if (purchase.balanceAfter !== undefined) item.balanceAfter = purchase.balanceAfter;
  return item;
}

