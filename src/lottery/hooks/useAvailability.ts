import { useCallback, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { lotteryKeys } from "@/lottery/hooks/lotteryKeys";
import { lotteryService } from "@/services/lottery.service";
import type { LotteryAvailability } from "@/types/lottery";

/** The API answers at most this many numbers in one ask. */
export const AVAILABILITY_MAX = 50;
/** Typing settles for this long before the numbers are asked (one request per number, not per key). */
const DEBOUNCE_MS = 250;
/** What is held changes only when this customer buys, and a purchase invalidates it; between, a quarter minute is fresh. */
const STALE_MS = 15_000;

export type Availability = Pick<LotteryAvailability, "offSale" | "held" | "left">;

/** The asked set as one string: distinct six-digit numbers, sorted, at most AVAILABILITY_MAX — the query's key. */
function askedKey(numbers: readonly string[]): string {
  const set = new Set<string>();
  for (const n of numbers) if (/^\d{6}$/.test(n)) set.add(n);
  return [...set].sort().slice(0, AVAILABILITY_MAX).join(",");
}

/**
 * POST /api/lottery/draws/:drawNo/availability for a set of numbers (the
 * typed number and every row of "Your numbers" on Draw; the picked and shown
 * tickets on a dream's generator): whether each is off sale, how many of it
 * this customer holds and how many more may be bought. Debounced, so a number
 * being typed is asked once it is whole and still; cached per asked set, and
 * the last answer is kept while the next loads, so rows never blink.
 *
 * `of(number)` is undefined while a number has not been answered yet (just
 * typed, or the first ask in flight): the caller shows "Checking…" rather
 * than guessing.
 */
export function useAvailability(drawNo: number | null, numbers: readonly string[]) {
  const wanted = askedKey(numbers);
  const [asked, setAsked] = useState(wanted);
  useEffect(() => {
    if (wanted === asked) return;
    // A set that only lost numbers needs no new ask; the old answer still covers what is left.
    const timer = setTimeout(() => setAsked(wanted), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [wanted, asked]);

  const enabled = drawNo !== null && asked.length > 0;
  const query = useQuery({
    queryKey: lotteryKeys.availability(drawNo ?? 0, asked),
    queryFn: ({ signal }) => lotteryService.getAvailability(drawNo as number, asked.split(","), { signal }),
    enabled,
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
  });

  const byNumber = useMemo(() => {
    const map = new Map<string, Availability>();
    for (const row of query.data ?? []) map.set(row.number, { offSale: row.offSale, held: row.held, left: row.left });
    return map;
  }, [query.data]);

  const of = useCallback((number: string): Availability | undefined => byNumber.get(number), [byNumber]);

  return { of, isFetching: query.isFetching, isError: query.isError, error: query.error, refetch: query.refetch };
}
