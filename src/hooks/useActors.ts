import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { actorsService } from "@/services/actors.service";
import { LIST_PAGE_SIZE, nextPageParam } from "@/hooks/pagination";

/**
 * Actors whose name contains the term — the Search screen's People rail.
 * Enabled from the FIRST character (names are short; a one-letter prefix is
 * already useful), unlike the catalog search's two-character minimum; the
 * caller decides which minimum applies by what it passes. keepPreviousData
 * holds the previous result list on screen between terms so the rail doesn't
 * flash away.
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

/** One actor by id (GET /actors/:id, public) — the ActorDetails page's header. */
export function useActor(id: string | undefined) {
  return useQuery({
    queryKey: ["actor", id],
    queryFn: ({ signal }) => actorsService.getActor(id as string, { signal }),
    enabled: !!id,
    staleTime: 60_000,
  });
}

/**
 * THE infinite actors key — spelled here and nowhere else (see moviesInfiniteKey).
 * The term is part of it, so a slow "chan" response can only ever resolve into
 * the "chan" cache entry, never over the list the user is now looking at.
 */
export const actorsInfiniteKey = (search: string) => ["actors", "infinite", search] as const;

/**
 * The ActorsList screen's endless list — every actor in the catalogue,
 * alphabetical (GET /actors is ALWAYS ordered by name, there is no sort to
 * pass), filtered by that screen's debounced term when there is one. Cloned
 * from useMoviesInfinite, with the shared pagination helpers: `nextPageParam`
 * counts what is actually loaded against the backend total, so a short last
 * page stops the list instead of asking for an empty page forever.
 *
 * Deliberately NOT gated on a minimum length, unlike useActorSearch above: an
 * empty term is the screen's resting state — the whole point of it is that it
 * lists everyone when nothing is typed.
 */
export function useActorsInfinite(term: string) {
  const search = term.trim();
  return useInfiniteQuery({
    queryKey: actorsInfiniteKey(search),
    queryFn: ({ pageParam, signal }) =>
      actorsService.searchActors({ search: search || undefined, page: pageParam, limit: LIST_PAGE_SIZE }, { signal }),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
    // Holds the previous term's faces on screen while the next term loads, so
    // the grid keeps its rows instead of flashing empty between terms.
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
