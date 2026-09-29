import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { bookAuthorsService } from "@/services/bookAuthors.service";
import { LIST_PAGE_SIZE, nextPageParam } from "@/hooks/pagination";

/**
 * THE infinite book-authors key — spelled here and nowhere else (see
 * actorsInfiniteKey). The term is part of it, so a slow "chan" response can
 * only ever resolve into the "chan" cache entry, never over the list the user
 * is now looking at.
 */
export const bookAuthorsInfiniteKey = (search: string) => ["book-authors", "infinite", search] as const;

/**
 * The AuthorsList screen's endless list — every author in the catalogue,
 * alphabetical (GET /book-authors is ALWAYS ordered by name, there is no sort
 * to pass), filtered by that screen's debounced term when there is one. The
 * twin of useActorsInfinite, down to the shared pagination helpers:
 * `nextPageParam` counts what is actually loaded against the backend total, so
 * a short last page stops the list instead of asking for an empty page
 * forever.
 *
 * Deliberately NOT gated on a minimum length: an empty term is the screen's
 * resting state — the whole point of it is that it lists everyone when nothing
 * is typed.
 */
export function useBookAuthorsInfinite(term: string) {
  const search = term.trim();
  return useInfiniteQuery({
    queryKey: bookAuthorsInfiniteKey(search),
    queryFn: ({ pageParam, signal }) =>
      bookAuthorsService.searchAuthors(
        { search: search || undefined, page: pageParam, limit: LIST_PAGE_SIZE },
        { signal },
      ),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
    // Holds the previous term's authors on screen while the next term loads, so
    // the grid keeps its rows instead of flashing empty between terms.
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

/** One author by id (GET /book-authors/:id) — the AuthorDetails page's header. */
export function useBookAuthor(id: string | undefined) {
  return useQuery({
    queryKey: ["book-author", id],
    queryFn: ({ signal }) => bookAuthorsService.getAuthor(id as string, { signal }),
    enabled: !!id,
    staleTime: 60_000,
  });
}
