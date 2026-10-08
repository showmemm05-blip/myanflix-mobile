import { useQuery } from "@tanstack/react-query";
import { bookCategoriesService } from "@/services/bookCategories.service";

/**
 * THE book-categories key — spelled here and nowhere else. Distinct from the
 * movie taxonomy's `["categories"]` (GET /categories), so the two lists can
 * never share a cache entry.
 */
export const bookCategoriesKey = ["book-categories"] as const;

/**
 * Every book category (GET /book-categories), by name, with its bookCount.
 * Five minutes fresh, like useCategories: the list only changes when an admin
 * edits the shelves.
 *
 * `options.enabled` states that the viewer may ask at all — the endpoint is
 * members-only, exactly like /books.
 */
export function useBookCategories(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: bookCategoriesKey,
    queryFn: ({ signal }) => bookCategoriesService.getBookCategories({ signal }),
    enabled: options.enabled ?? true,
    staleTime: 5 * 60_000,
  });
}
