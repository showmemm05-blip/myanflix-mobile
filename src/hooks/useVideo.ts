import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { videoService } from "@/services/video.service";
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

export function useWatchHistory(pagination: PaginationParams = {}) {
  return useQuery({
    queryKey: ["watch-history", "me", pagination],
    queryFn: ({ signal }) => videoService.getMyWatchHistory(pagination, { signal }),
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
