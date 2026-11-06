import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { purchaseItemOf } from "@/lottery/data/draws";
import type { PurchaseItem } from "@/lottery/data/sample";
import { invalidateAfterPurchase, lotteryKeys } from "@/lottery/hooks/lotteryKeys";
import { lotteryService } from "@/services/lottery.service";
import type { LotteryDrawStatus, LotteryLimitDetail, LotteryPurchase, LotteryPurchaseInput } from "@/types/lottery";
import type { Wallet } from "@/types/wallet";
import { ApiError } from "@/utils/errors";

interface RecentBuysState {
  /** The purchases made in this session, newest first (My tickets' and History's "just bought" notes). */
  purchases: PurchaseItem[];
  /** Their ticket numbers: the rows that carry the New chip. */
  newTicketIds: ReadonlySet<string>;
  add: (purchase: PurchaseItem) => void;
}

/**
 * What this session bought — in memory only, gone on reload, exactly like the
 * boards' afterPurchase lever: the "N tickets bought for Draw 24" note, the
 * link to the new rows and their New chips.
 */
export const useRecentBuys = create<RecentBuysState>((set) => ({
  purchases: [],
  newTicketIds: new Set(),
  add: (purchase) =>
    set((state) => ({
      purchases: [purchase, ...state.purchases.filter((p) => p.ref !== purchase.ref)],
      newTicketIds: new Set([...state.newTicketIds, ...purchase.ticketIds]),
    })),
}));

/**
 * POST /api/lottery/purchases: several numbers, each with a quantity, one
 * wallet debit. On success the purchase goes into the cache under its ref
 * (Printed opens on it at once), the wallet balance is set from
 * `balanceAfter` without waiting for a refetch, this session's record is
 * kept, and everything a purchase changes is invalidated (the wallet, the
 * draw, what is held, the tickets, the purchases).
 *
 * The `idempotencyKey` is the caller's (ConfirmSheet keeps one until the
 * purchase succeeds): a retry after a lost answer returns the stored purchase
 * and never charges twice.
 */
export function useBuyTickets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LotteryPurchaseInput) => lotteryService.createPurchase(input),
    onSuccess: (purchase: LotteryPurchase) => settlePurchase(queryClient, purchase),
  });
}

/**
 * What a finished purchase does to the app, whether it came back from the
 * POST or was found afterwards by its ref (a key that had already paid): the
 * cache, the wallet, this session's record, and the invalidations.
 */
export function settlePurchase(queryClient: QueryClient, purchase: LotteryPurchase): void {
  queryClient.setQueryData(lotteryKeys.purchase(purchase.ref), purchase);
  if (purchase.balanceAfter !== undefined) {
    const balance = purchase.balanceAfter;
    queryClient.setQueryData<Wallet | undefined>(["wallet"], (prev) => (prev ? { ...prev, balance } : prev));
  }
  useRecentBuys.getState().add(purchaseItemOf(purchase));
  queryClient.invalidateQueries({ queryKey: ["wallet"] });
  invalidateAfterPurchase(queryClient);
}

/**
 * Why the server refused a purchase (the contract's codes), as the sheet
 * acts on it. null = not a refusal — the answer was lost or the server
 * failed — so the same key can simply be tried again.
 */
export type BuyRefusal =
  /** Not selling now: `status` says whether it is closed, paused, or not open yet (the server's `status` extra). */
  | { kind: "closed"; status: LotteryDrawStatus | null }
  | { kind: "notFound" }
  /** This key already paid for a purchase (`ref`) and the basket has changed since: that purchase stands. */
  | { kind: "alreadyBought"; ref: string | null }
  | { kind: "offSale"; numbers: string[] }
  | { kind: "limit"; items: LotteryLimitDetail[] }
  | { kind: "short"; total: number | null; balance: number | null }
  | { kind: "badNumber" }
  | { kind: "other"; message: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function numberOrNull(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function buyRefusalOf(err: unknown): BuyRefusal | null {
  if (!(err instanceof ApiError)) return null;
  // No answer (status 0) or the server's own failure: not a refusal, the purchase may be tried again as it is.
  if (err.status === 0 || err.status >= 500) return null;
  const details = err.details;
  const extra = err.extra ?? {};
  switch (err.code) {
    case "LOTTERY_SALES_CLOSED":
    case "LOTTERY_DRAW_STATE": {
      const status = extra.status;
      return {
        kind: "closed",
        status:
          status === "open" || status === "paused" || status === "closed" || status === "scheduled" || status === "published"
            ? status
            : null,
      };
    }
    case "LOTTERY_DRAW_NOT_FOUND":
      return { kind: "notFound" };
    case "LOTTERY_IDEMPOTENCY_MISMATCH":
      return { kind: "alreadyBought", ref: typeof extra.ref === "string" ? extra.ref : null };
    case "LOTTERY_NUMBER_OFF_SALE": {
      const raw = asRecord(details)?.numbers;
      const numbers = Array.isArray(raw) ? raw.filter((n): n is string => typeof n === "string") : [];
      return { kind: "offSale", numbers };
    }
    case "LOTTERY_LIMIT_EXCEEDED": {
      const raw = Array.isArray(details) ? details : (asRecord(details)?.items ?? []);
      const items: LotteryLimitDetail[] = [];
      if (Array.isArray(raw)) {
        for (const entry of raw) {
          const row = asRecord(entry);
          if (!row || typeof row.number !== "string") continue;
          items.push({ number: row.number, held: numberOrNull(row.held) ?? 0, left: numberOrNull(row.left) ?? 0 });
        }
      }
      return { kind: "limit", items };
    }
    case "LOTTERY_INSUFFICIENT_BALANCE": {
      const row = asRecord(details);
      return { kind: "short", total: numberOrNull(row?.total), balance: numberOrNull(row?.balance) };
    }
    case "LOTTERY_BAD_NUMBER":
      return { kind: "badNumber" };
    default:
      return { kind: "other", message: err.message };
  }
}
