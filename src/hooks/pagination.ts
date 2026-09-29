import type { PaginatedResponse } from "@/types/api";

/**
 * THE page size of every server-paged list on mobile — the same 30 the Media
 * screen pages the catalogue with (the backend caps `limit` at 100). One
 * number so the watch-history, notifications, wallet and category lists all
 * page at the same rhythm, and so a screen that wants a different size has
 * to say why next to the override.
 */
export const LIST_PAGE_SIZE = 30;

/**
 * `getNextPageParam` for every `useInfiniteQuery` over a `{items,total,page,
 * limit}` response. Counts what is actually LOADED against the backend's
 * total rather than trusting `page * limit`, so a short last page (or a row
 * deleted between two fetches) stops the list instead of asking for an empty
 * page 4 forever. Returns `undefined` — React Query's "no more" — once
 * loaded >= total.
 */
export function nextPageParam<T>(lastPage: PaginatedResponse<T>, allPages: PaginatedResponse<T>[]) {
  const loaded = allPages.reduce((count, page) => count + page.items.length, 0);
  return loaded < lastPage.total ? lastPage.page + 1 : undefined;
}

/** Every page's rows in order — what a screen hands to its FlatList. */
export function flattenPages<T>(pages: PaginatedResponse<T>[] | undefined): T[] {
  return pages?.flatMap((page) => page.items) ?? [];
}
