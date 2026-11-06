import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguageStore } from "@/store/languageStore";
import { useFocusEffect } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { drawInfoOf } from "@/lottery/data/draws";
import type { DrawInfo } from "@/lottery/data/sample";
import { lotteryKeys } from "@/lottery/hooks/lotteryKeys";
import { lotteryService } from "@/services/lottery.service";
import type { LotteryDraw } from "@/types/lottery";

/** A draw changes on a schedule, not under the thumb: half a minute is fresh enough between screens. */
export const CURRENT_DRAW_STALE_MS = 30_000;

/** What the cache holds: the server's answer, nothing worded (so a language switch never shows stale words). */
export interface CurrentDrawCache {
  draw: LotteryDraw | null;
  /** The server's clock minus the phone's, in ms, measured when the answer landed. */
  serverOffsetMs: number;
}

export interface CurrentDrawData extends CurrentDrawCache {
  /** The same draw in the shape the cards and tickets read (its times worded in the Lottery's language); null when there is no draw yet. */
  info: DrawInfo | null;
}

async function fetchCurrentDraw(signal: AbortSignal | undefined): Promise<CurrentDrawCache> {
  const data = await lotteryService.getCurrentDraw({ signal });
  const serverMs = Date.parse(data.serverNow);
  return {
    draw: data.draw,
    serverOffsetMs: Number.isFinite(serverMs) ? serverMs - Date.now() : 0,
  };
}

/**
 * GET /api/lottery/draws/current — the draw on sale (OPEN or PAUSED, nearest
 * its draw time), else the next SCHEDULED one, else the latest finished one,
 * else null ("No draw yet"). Every Lottery page reads it: the Draw card, the
 * countdown, the price and the per-number limit, Home's promotions, the hub.
 *
 * It is refetched when a screen comes back into view (the sale may have
 * closed meanwhile) — the first focus is the mount's own fetch, so it is
 * left alone. A component outside the navigator (none today) must pass
 * `onFocus: false`, since useFocusEffect needs a screen.
 */
export function useCurrentDraw(options: { onFocus?: boolean } = {}) {
  // `info` carries worded times ("7:02 PM" / "ည 7:02"), so it is derived per
  // language from the raw answer rather than cached with it.
  const language = useLanguageStore((s) => s.language);
  const select = useCallback(
    (data: CurrentDrawCache): CurrentDrawData => ({
      ...data,
      info: data.draw ? drawInfoOf(data.draw) : null,
    }),
    // The language is read inside drawInfoOf's formatters; it is the dependency.
    [language],
  );
  const query = useQuery({
    queryKey: lotteryKeys.currentDraw,
    queryFn: ({ signal }) => fetchCurrentDraw(signal),
    staleTime: CURRENT_DRAW_STALE_MS,
    select,
  });
  const { refetch } = query;
  const onFocus = options.onFocus ?? true;
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      if (onFocus) refetch();
    }, [onFocus, refetch]),
  );
  return query;
}

/**
 * The server's "now" on this phone, in ms, ticking every `tickMs` (a
 * countdown is updated each minute; the Draw page checks the close time more
 * often, so a sale that just closed is not still offered). The offset comes
 * from the current-draw answer in the cache; before one lands the phone's
 * clock stands in.
 */
export function useLotteryNow(tickMs = 30_000): number {
  const queryClient = useQueryClient();
  const offset = queryClient.getQueryData<CurrentDrawCache>(lotteryKeys.currentDraw)?.serverOffsetMs ?? 0;
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    setNow(Date.now() + offset);
    const timer = setInterval(() => setNow(Date.now() + offset), tickMs);
    return () => clearInterval(timer);
  }, [offset, tickMs]);
  return now;
}
