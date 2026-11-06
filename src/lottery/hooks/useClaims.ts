import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lotteryKeys } from "@/lottery/hooks/lotteryKeys";
import { lotteryService } from "@/services/lottery.service";
import type { LotteryDrawClaim } from "@/types/lottery";
import { ApiError } from "@/utils/errors";

/**
 * A claim view changes by the customer's own request (which writes the cache
 * itself) or by the admin's hand (confirm / reject, which the balance push
 * and the focus refresh pick up): half a minute is fresh.
 */
const CLAIM_STALE_MS = 30_000;
/** My claims list pages by this many. */
export const CLAIMS_PAGE_SIZE = 25;

/** A 4xx is an answer (404 = no such draw), never retried; anything else at most twice. */
function retryUnlessClient(count: number, err: unknown): boolean {
  return count < 2 && !(err instanceof ApiError && err.status >= 400 && err.status < 500);
}

/**
 * GET /api/lottery/claims/draws/:drawNo — my prize in one draw and where its
 * payment stands (Check my tickets' gold summary, Ticket view's prize card).
 * `enabled` lets a screen wait until it knows the customer won something in
 * the draw (nothing is asked for a draw with no winning ticket).
 */
export function useDrawClaim(drawNo: number | undefined, enabled = true) {
  return useQuery({
    queryKey: lotteryKeys.claim(drawNo ?? 0),
    queryFn: ({ signal }) => lotteryService.getDrawClaim(drawNo as number, { signal }),
    enabled: drawNo !== undefined && enabled,
    staleTime: CLAIM_STALE_MS,
    retry: retryUnlessClient,
  });
}

/** GET /api/lottery/claims?page=1 — my claims, newest first (not on a screen yet; the service and key are the contract's). */
export function useMyClaims(page = 1) {
  return useQuery({
    queryKey: lotteryKeys.claimList(page, CLAIMS_PAGE_SIZE),
    queryFn: ({ signal }) => lotteryService.listMyClaims({ page, pageSize: CLAIMS_PAGE_SIZE }, { signal }),
    staleTime: CLAIM_STALE_MS,
    retry: retryUnlessClient,
  });
}

/**
 * POST /api/lottery/claims { drawNo }: ONE request for every winning ticket I
 * hold in the draw. On success the answer (the view, now "requested") goes
 * straight into the cache, and everything that shows the claim is
 * invalidated: the claim views and my list, and the tickets (their
 * `claimStatus` chips). On a refusal the server's truth replaces the stale
 * block the same way (`claimRefusalOf` says which words to show).
 *
 * Nothing is done to the wallet here: money moves only when the admin
 * confirms, and then the balance push (hooks/useRealtimeWallet) refreshes
 * the wallet, the tickets and the claims by itself.
 */
export function useRequestClaim(drawNo: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => lotteryService.requestClaim(drawNo),
    onSuccess: (view: LotteryDrawClaim) => {
      queryClient.setQueryData(lotteryKeys.claim(drawNo), view);
      queryClient.invalidateQueries({ queryKey: lotteryKeys.claims });
      queryClient.invalidateQueries({ queryKey: lotteryKeys.tickets });
    },
    onError: (err: unknown) => {
      const why = claimRefusalOf(err);
      // The server knows better than the block on screen (already requested, rejected, expired, nothing left):
      // re-read so the words and the chips follow it. A lost answer, or a publish still settling, changes
      // nothing worth re-reading.
      if (why && why.kind !== "other" && why.kind !== "notPublished") {
        queryClient.invalidateQueries({ queryKey: lotteryKeys.claims });
        queryClient.invalidateQueries({ queryKey: lotteryKeys.tickets });
      }
    },
  });
}

/**
 * Why the server refused a payment request (the contract's 409 codes), as
 * the sheet acts on it. null = not a refusal — the answer was lost or the
 * server failed — so the same request can simply be sent again.
 */
export type ClaimRefusal =
  /** LOTTERY_CLAIM_ALREADY_REQUESTED: a claim for this draw is REQUESTED or PAID already (a repeat tap, or another device). */
  | { kind: "alreadyRequested" }
  /** LOTTERY_CLAIM_REJECTED: the admin rejected the claim; support can have it reviewed again. */
  | { kind: "rejected" }
  /** LOTTERY_CLAIM_EXPIRED: the draw's claim deadline has passed. */
  | { kind: "expired" }
  /** LOTTERY_CLAIM_NOTHING_TO_CLAIM: no unclaimed prize of mine in this draw. */
  | { kind: "nothing" }
  /**
   * LOTTERY_DRAW_STATE: the draw is not published, or (`settling`) it is
   * published but its last chunks are still awarding prizes — a passing
   * moment, so the same request may simply be sent again.
   */
  | { kind: "notPublished"; settling: boolean }
  /** LOTTERY_DRAW_NOT_FOUND / LOTTERY_CLAIM_NOT_FOUND. */
  | { kind: "notFound" }
  | { kind: "other"; message: string };

export function claimRefusalOf(err: unknown): ClaimRefusal | null {
  if (!(err instanceof ApiError)) return null;
  // No answer (status 0) or the server's own failure: not a refusal; the request may be tried again as it is.
  if (err.status === 0 || err.status >= 500) return null;
  switch (err.code) {
    case "LOTTERY_CLAIM_ALREADY_REQUESTED":
      return { kind: "alreadyRequested" };
    case "LOTTERY_CLAIM_REJECTED":
      return { kind: "rejected" };
    case "LOTTERY_CLAIM_EXPIRED":
      return { kind: "expired" };
    case "LOTTERY_CLAIM_NOTHING_TO_CLAIM":
      return { kind: "nothing" };
    case "LOTTERY_DRAW_STATE":
      // The server names the draw's status beside the code: "published" means the publish is still settling.
      return { kind: "notPublished", settling: err.extra?.status === "published" };
    case "LOTTERY_DRAW_NOT_FOUND":
    case "LOTTERY_CLAIM_NOT_FOUND":
      return { kind: "notFound" };
    default:
      return { kind: "other", message: err.message };
  }
}
