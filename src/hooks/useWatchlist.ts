import { useCallback } from "react";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { watchlistService } from "@/services/watchlist.service";

const WATCHLIST_KEY = ["watchlist"];

/**
 * The one definition of the watchlist query, shared by the two hooks below so
 * they cannot drift apart (same key, same reader, same default freshness).
 */
const watchlistQuery = queryOptions({
  queryKey: WATCHLIST_KEY,
  queryFn: () => watchlistService.getIds(),
});

export function useWatchlist() {
  return useQuery(watchlistQuery);
}

/**
 * Whether ONE title is saved. `select` narrows the shared list to this cell's
 * yes/no, and React Query only re-renders a component when what it selected
 * changes — so toggling one bookmark re-renders the one cell whose answer
 * changed, not every poster cell on every mounted grid. Same key and same
 * freshness as useWatchlist: this is a narrower read of the same cache entry.
 */
export function useIsInWatchlist(movieId: string | undefined): boolean {
  const select = useCallback((ids: string[]) => !!movieId && ids.includes(movieId), [movieId]);
  const { data } = useQuery({ ...watchlistQuery, select });
  return data ?? false;
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
