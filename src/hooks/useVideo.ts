import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { videoService } from "@/services/video.service";
import type { PaginationParams } from "@/types/api";

export function useStreamInfo(movieId: string | undefined) {
  return useQuery({
    queryKey: ["stream", movieId],
    queryFn: () => videoService.getStreamInfo(movieId as string),
    enabled: !!movieId,
    retry: false, // 403/forbidden and 404/not-ready are terminal, not transient — don't retry them
  });
}

export function useWatchHistory(pagination: PaginationParams = {}) {
  return useQuery({
    queryKey: ["watch-history", "me", pagination],
    queryFn: () => videoService.getMyWatchHistory(pagination),
  });
}

export function useReportWatchProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ movieId, progress, lastPosition }: { movieId: string; progress: number; lastPosition: number }) =>
      videoService.updateWatchProgress(movieId, progress, lastPosition),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watch-history"] });
    },
  });
}
