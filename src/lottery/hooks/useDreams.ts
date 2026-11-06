import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { lotteryService } from "@/services/lottery.service";
import type { DreamBook, LotteryDream } from "@/types/lottery";
import { ApiError } from "@/utils/errors";

/**
 * The dream books were the Lottery's FIRST real data (phase 1, 2026-10-19);
 * the draws, purchases and tickets followed the same day (hooks/useCurrentDraw
 * and friends). The books change only when the admin edits them, so a loaded
 * book is kept five minutes and a visit to the generator or back to the book
 * does not ask again.
 */
export const DREAMS_STALE_MS = 5 * 60_000;

/** THE dream list key — spelled here and nowhere else. `q` "" = the whole book. */
export const dreamsKey = (book: DreamBook, q = "") => ["lottery", "dreams", book, q] as const;
/** THE one-dream key; distinct from the list key at index 1. */
export const dreamKey = (book: DreamBook, number: string) => ["lottery", "dream", book, number] as const;

export interface DreamsOptions {
  /** False while the list is not on screen (the dream picker before it opens). */
  enabled?: boolean;
}

/** A 404 from GET /lottery/dreams/:book/:number — the row is missing, switched off or unnamed. */
export function isDreamNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

/**
 * GET /api/lottery/dreams?book&q — one book's active, named dreams in number
 * order. The dream pages fetch the WHOLE book once (`q` omitted) and search
 * it on the phone: the live filter then costs nothing per keystroke, reads
 * Burmese digits and matches a number anywhere in it (dreamBook.searchBook),
 * which the server's prefix match does not. `q` is still passed through for
 * a caller that wants the server's own search.
 */
export function useDreams(book: DreamBook, q = "", options: DreamsOptions = {}) {
  const term = q.trim();
  return useQuery({
    queryKey: dreamsKey(book, term),
    queryFn: ({ signal }) => lotteryService.getDreams(term ? { book, q: term } : { book }, { signal }),
    enabled: options.enabled ?? true,
    staleTime: DREAMS_STALE_MS,
    // A server-side search keeps the last rows while the next term loads.
    placeholderData: term ? keepPreviousData : undefined,
  });
}

/**
 * GET /api/lottery/dreams/:book/:number — the one dream a generator page is
 * for. Retries follow the app's own policy (App.tsx): never on a 4xx — a 404
 * is an answer ("not in the book"), a 429 or a 400 will not change — and at
 * most twice otherwise. Spelled out here only because `retry` is set per
 * query and would otherwise fall back to React Query's own three.
 *
 * Opened from the book page (or the dream picker), the dream is already in
 * the book's cached list, so it is taken from there as initial data — as old
 * as that list — and no second request is made while the list is fresh.
 */
export function useDream(book: DreamBook, number: string | undefined) {
  const queryClient = useQueryClient();
  const listKey = dreamsKey(book);
  return useQuery({
    queryKey: dreamKey(book, number ?? ""),
    queryFn: ({ signal }) => lotteryService.getDream(book, number as string, { signal }),
    enabled: !!number,
    staleTime: DREAMS_STALE_MS,
    initialData: () => queryClient.getQueryData<LotteryDream[]>(listKey)?.find((d) => d.number === number),
    initialDataUpdatedAt: () => queryClient.getQueryState(listKey)?.dataUpdatedAt,
    retry: (count, err) => count < 2 && !(err instanceof ApiError && err.status >= 400 && err.status < 500),
  });
}
