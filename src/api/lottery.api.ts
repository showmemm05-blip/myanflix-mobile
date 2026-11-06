import { apiClient, csvParams } from "@/api/client";
import type { RequestSignalOptions } from "@/types/api";
import type {
  DreamBook,
  LotteryAvailabilityResponse,
  LotteryClaimRequestInput,
  LotteryCurrentDraw,
  LotteryDraw,
  LotteryDrawClaim,
  LotteryDrawResult,
  LotteryDream,
  LotteryDreamsQuery,
  LotteryDreamsResponse,
  LotteryMyClaim,
  LotteryPage,
  LotteryPageQuery,
  LotteryPurchase,
  LotteryPurchaseInput,
  LotteryTicket,
  LotteryTicketsQuery,
  LotteryWinnersResponse,
} from "@/types/lottery";

export const lotteryApi = {
  /** Guest OK (like the catalogue reads). Only active, named dreams come back, in number order. */
  getDreams(query: LotteryDreamsQuery, options: RequestSignalOptions = {}) {
    return apiClient.get<LotteryDreamsResponse>("/lottery/dreams", { params: csvParams(query), ...options });
  },

  /** Guest OK. 404 when the row is missing, inactive or has no name yet. */
  getDream(book: DreamBook, number: string, options: RequestSignalOptions = {}) {
    return apiClient.get<LotteryDream>(`/lottery/dreams/${book}/${encodeURIComponent(number)}`, options);
  },

  /* ---------- draws (guest OK) ---------- */

  /** The OPEN or PAUSED draw nearest its draw time; else the next SCHEDULED; else the latest finished; else null. */
  getCurrentDraw(options: RequestSignalOptions = {}) {
    return apiClient.get<LotteryCurrentDraw>("/lottery/draws/current", options);
  },

  /** Newest draw number first. */
  getDraws(query: LotteryPageQuery = {}, options: RequestSignalOptions = {}) {
    return apiClient.get<LotteryPage<LotteryDraw>>("/lottery/draws", { params: csvParams(query), ...options });
  },

  /** 404 LOTTERY_DRAW_NOT_FOUND. */
  getDraw(drawNo: number, options: RequestSignalOptions = {}) {
    return apiClient.get<LotteryDraw>(`/lottery/draws/${drawNo}`, options);
  },

  /** Up to 50 numbers; a guest's `held` is always 0. */
  getAvailability(drawNo: number, numbers: readonly string[], options: RequestSignalOptions = {}) {
    return apiClient.post<LotteryAvailabilityResponse>(
      `/lottery/draws/${drawNo}/availability`,
      { numbers: [...numbers] },
      options,
    );
  },

  /* ---------- purchases and tickets (signed in) ---------- */

  /** One wallet debit for the whole purchase; refused with a `code` when it cannot go through (hooks/useBuyTickets). */
  createPurchase(input: LotteryPurchaseInput) {
    return apiClient.post<LotteryPurchase>("/lottery/purchases", input);
  },

  /** The customer's own purchases, newest first (no `balanceAfter`). */
  getPurchases(query: LotteryPageQuery = {}, options: RequestSignalOptions = {}) {
    return apiClient.get<LotteryPage<LotteryPurchase>>("/lottery/purchases", {
      params: csvParams(query),
      ...options,
    });
  },

  /** Own only — anyone else's ref is a 404. */
  getPurchase(ref: string, options: RequestSignalOptions = {}) {
    return apiClient.get<LotteryPurchase>(`/lottery/purchases/${encodeURIComponent(ref)}`, options);
  },

  /** The customer's own tickets, newest first; `pageSize` up to 200. */
  getTickets(query: LotteryTicketsQuery = {}, options: RequestSignalOptions = {}) {
    return apiClient.get<LotteryPage<LotteryTicket>>("/lottery/tickets", { params: csvParams(query), ...options });
  },

  /** Own only — anyone else's ticket is a 404. */
  getTicket(ticketNo: string, options: RequestSignalOptions = {}) {
    return apiClient.get<LotteryTicket>(`/lottery/tickets/${encodeURIComponent(ticketNo)}`, options);
  },

  /* ---------- presence (signed in only) ---------- */

  /**
   * "I am in the Lottery" — feeds the admin's active-users series. Empty body,
   * answers 204 (the client returns undefined). The platform header rides on
   * the instance; the server throttles to one write per user per minute.
   */
  pingActivity() {
    return apiClient.post<void>("/lottery/activity", {});
  },

  /* ---------- results, prizes and winners (guest OK) ---------- */

  /** Published draws newest first, each with its whole prize sheet. */
  getResults(query: LotteryPageQuery = {}, options: RequestSignalOptions = {}) {
    return apiClient.get<LotteryPage<LotteryDrawResult>>("/lottery/results", {
      params: csvParams(query),
      ...options,
    });
  },

  /** One published draw's sheet; 404 LOTTERY_RESULTS_NOT_PUBLISHED until it is published. */
  getDrawResults(drawNo: number, options: RequestSignalOptions = {}) {
    return apiClient.get<LotteryDrawResult>(`/lottery/draws/${drawNo}/results`, options);
  },

  /** The draw's winning tickets by number only (no user fields), biggest prize first; `limit` up to 50. */
  getDrawWinners(drawNo: number, limit: number, options: RequestSignalOptions = {}) {
    return apiClient.get<LotteryWinnersResponse>(`/lottery/draws/${drawNo}/winners`, {
      params: { limit },
      ...options,
    });
  },

  /* ---------- prize claims: payment by request (signed in only; 2026-10-24) ---------- */

  /** My prize in one draw and where its payment stands; 404 LOTTERY_DRAW_NOT_FOUND. */
  getDrawClaim(drawNo: number, options: RequestSignalOptions = {}) {
    return apiClient.get<LotteryDrawClaim>(`/lottery/claims/draws/${drawNo}`, options);
  },

  /**
   * Request the payment of every winning ticket I hold in the draw — ONE
   * claim per customer per draw. 201 with the draw's claim view; refused
   * with a 409 code when it cannot go through (hooks/useClaims claimRefusalOf).
   */
  requestClaim(input: LotteryClaimRequestInput) {
    return apiClient.post<LotteryDrawClaim>("/lottery/claims", input);
  },

  /** My claims, newest first. */
  getMyClaims(query: LotteryPageQuery = {}, options: RequestSignalOptions = {}) {
    return apiClient.get<LotteryPage<LotteryMyClaim>>("/lottery/claims", { params: csvParams(query), ...options });
  },
};
