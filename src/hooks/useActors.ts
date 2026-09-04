import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { actorsService } from "@/services/actors.service";

/**
 * The filter sheet's cast picker. Enabled from the FIRST character (names are
 * short; a one-letter prefix is already useful), unlike the catalog search's
 * two-character minimum. keepPreviousData holds the previous result list on
 * screen between keystrokes so the chips don't flash away.
 */
export function useActorSearch(term: string) {
  const search = term.trim();
  return useQuery({
    queryKey: ["actors", "search", search],
    queryFn: ({ signal }) => actorsService.searchActors({ search, limit: 20 }, { signal }),
    enabled: search.length >= 1,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
