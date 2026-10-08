import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { videoService } from "@/services/video.service";
import { nextPageParam } from "@/hooks/pagination";
import type { PaginationParams } from "@/types/api";

export function useStreamInfo(movieId: string | undefined) {
  return useQuery({
    queryKey: ["stream", movieId],
    queryFn: ({ signal }) => videoService.getStreamInfo(movieId as string, { signal }),
    enabled: !!movieId,
    retry: false, // 403/forbidden and 404/not-ready are terminal, not transient — don't retry them
    // The playlist URL carries an expiring signed token. A background refetch
    // that returned a fresh token would change the URL and remount the video
    // player from 0:00 mid-sitting — so the URL is fetched once per movie and
    // only replaced on purpose (Player's error recovery). Each episode is its
    // own cache entry, so switching episodes inside the player is a different
    // query, not a refetch, and coming back to one already watched this sitting
    // is served from cache rather than re-signed.
    staleTime: Infinity,
  });
}

/**
 * Where to resume one title (seconds), or null to start at 0:00 — see
 * videoService.getResumePosition. Read FRESH on every open: no staleTime and
 * no cache kept once the player lets go of it (gcTime 0), because the
 * position a moment ago is exactly what the last sitting just changed.
 * Never retried and never refetched on focus: a lookup that fails simply
 * means "start from the top", and one that lands mid-playback is ignored by
 * the player anyway (it applies the answer once per title).
 */
export function useResumePosition(movieId: string | undefined) {
  return useQuery({
    queryKey: ["watch-position", movieId],
    queryFn: ({ signal }) => videoService.getResumePosition(movieId as string, { signal }),
    enabled: !!movieId,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * The Watch-history screen's endless scroll. Keyed under the
 * `["watch-history", …]` prefix on purpose: Player's on-unmount
 * `invalidateQueries({ queryKey: ["watch-history"] })` and the reporter's
 * mark-stale sweep the prefix, so the paged list picks up a new resume point. `pageParam` rides in on top of the
 * caller's `limit`; the key holds the caller's params only, so page 2 lands
 * in the same entry as page 1.
 *
 * `options.staleTime`: Home's Continue watching and "Because you watched"
 * rows pass five minutes (CatalogListOptions' reason: the app's foreground
 * refetch would otherwise re-ask on every return to the phone). Safe, because
 * the player invalidates the ["watch-history"] prefix when it closes, so a
 * new resume point still shows at once. Omitted, the app-wide default.
 *
 * `options.enabled`: false keeps the request from being made at all — the
 * Home screen asks for a guest's history nowhere (the endpoint is 401), so
 * it passes `isAuthenticated`. Omitted, the query runs.
 */
export function useWatchHistoryInfinite(
  pagination: PaginationParams = {},
  options: { staleTime?: number; enabled?: boolean } = {},
) {
  return useInfiniteQuery({
    queryKey: ["watch-history", "me", "infinite", pagination],
    queryFn: ({ pageParam, signal }) =>
      videoService.getMyWatchHistory({ ...pagination, page: pageParam }, { signal }),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
    // A refetch after the player closes keeps the rows on screen until the
    // fresh pages land, rather than dropping the grid back to skeletons.
    placeholderData: keepPreviousData,
    ...(options.staleTime !== undefined && { staleTime: options.staleTime }),
    ...(options.enabled !== undefined && { enabled: options.enabled }),
  });
}

export function useReportWatchProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ movieId, progress, lastPosition }: { movieId: string; progress: number; lastPosition: number }) =>
      videoService.updateWatchProgress(movieId, progress, lastPosition),
    // Mark stale WITHOUT refetching. This fires every 15s for the whole film,
    // and the Watch-history screen sits under the player in the same stack —
    // a fullScreenModal does not unmount it, so its observer stays ACTIVE and
    // a plain invalidate re-pulled a 50-row list four times a minute against
    // the video's own bandwidth. The player's unmount does the one refetch
    // that matters; anything else picks the fresh list up on its next mount.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watch-history"], refetchType: "none" });
    },
  });
}
