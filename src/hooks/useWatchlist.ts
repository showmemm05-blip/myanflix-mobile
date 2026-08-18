import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { watchlistService } from "@/services/watchlist.service";

const WATCHLIST_KEY = ["watchlist"];

export function useWatchlist() {
  return useQuery({
    queryKey: WATCHLIST_KEY,
    queryFn: () => watchlistService.getIds(),
  });
}

export function useIsInWatchlist(movieId: string | undefined): boolean {
  const { data } = useWatchlist();
  return !!movieId && !!data?.includes(movieId);
}

export function useToggleWatchlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (movieId: string) => {
      const current = queryClient.getQueryData<string[]>(WATCHLIST_KEY) ?? (await watchlistService.getIds());
      return current.includes(movieId) ? watchlistService.remove(movieId) : watchlistService.add(movieId);
    },
    onSuccess: (ids) => {
      queryClient.setQueryData(WATCHLIST_KEY, ids);
    },
  });
}
