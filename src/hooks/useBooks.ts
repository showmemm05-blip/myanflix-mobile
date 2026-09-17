import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { booksService } from "@/services/books.service";
import { SEARCH_MIN_LENGTH, SEARCH_STALE_TIME_MS, SUGGEST_LIMIT } from "@/hooks/useSearchTerm";
import type { BookQuery, BookReadingProgress } from "@/types/book";

/**
 * THE book query keys — spelled here and nowhere else. Screens invalidate or
 * read the cache only through these helpers, so a key typo cannot split the
 * cache in two.
 */
export const booksKey = (query: BookQuery) => ["books", query] as const;
export const booksInfiniteKey = (query: BookQuery) => ["books", "infinite", query] as const;
/**
 * The books tab's suggestion-panel key. Distinct from every key above:
 * `["books", query]` is length 2 and `["books", "infinite", query]` differs at
 * index 1, so the panel and the grid never share a cache entry — while a
 * prefix invalidation on `["books"]` still sweeps both, which is correct.
 */
export const booksSuggestKey = (term: string) => ["books", "suggest", term] as const;
export const bookKey = (id: string | undefined) => ["book", id] as const;
export const chaptersKey = (bookId: string, editionId: string | undefined) =>
  ["book", bookId, "chapters", editionId] as const;
export const contentsKey = (bookId: string, editionId: string | undefined) =>
  ["book", bookId, "contents", editionId] as const;
export const chapterKey = (bookId: string, editionId: string | undefined, chapterId: string | undefined) =>
  ["book", bookId, "chapter", editionId, chapterId] as const;
export const pagesKey = (bookId: string, editionId: string | undefined, chapterId: string | undefined) =>
  ["book", bookId, "pages", editionId, chapterId] as const;
export const readingProgressKey = (bookId: string, editionId: string | undefined) =>
  ["book", bookId, "reading-progress", editionId] as const;

const MINUTE_MS = 60_000;

/**
 * ONE page of the library — what a shelf (rather than a grid) asks for.
 *
 * Deliberately no `sort`: BookQuery carries none, because /books already
 * answers newest-first (createdAt desc), which is exactly what the "New on the
 * shelf" rail wants. `options.enabled` is how a caller states that the viewer
 * may ask at all — /books is members-only, so the Search screen passes its
 * auth flag here and a guest never fires a request that would 401.
 */
export function useBooksList(query: BookQuery = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: booksKey(query),
    queryFn: ({ signal }) => booksService.getBooks(query, { signal }),
    enabled: options.enabled ?? true,
    staleTime: MINUTE_MS,
  });
}

/**
 * The catalog grid's endless scroll.
 *
 * `options.enabled` means the same thing it does on `useBooksList` above, and
 * exists for the same reason: /books is members-only, so a screen that can be
 * reached signed out (the Search screen's Books segment) states the session
 * here rather than firing a request that 401s and reads as a network failure.
 */
export function useBooksInfinite(query: BookQuery = {}, options: { enabled?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: booksInfiniteKey(query),
    queryFn: ({ pageParam, signal }) => booksService.getBooks({ ...query, page: pageParam }, { signal }),
    enabled: options.enabled ?? true,
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((count, page) => count + page.items.length, 0);
      return loaded < lastPage.total ? lastPage.page + 1 : undefined;
    },
    placeholderData: keepPreviousData,
    staleTime: MINUTE_MS,
  });
}

/**
 * The books tab's suggestion rows — the books twin of useMovieSuggestions.
 *
 * Same eight rows, same `enabled`, same keepPreviousData, and deliberately the
 * shared SEARCH_STALE_TIME_MS rather than this file's own MINUTE_MS: the three
 * panels are one feature and must feel identically live.
 *
 * ONE HONEST DIFFERENCE. BookQuery carries no `sort` — /books has no relevance
 * ordering to ask for — so this sends search + limit and nothing else, and the
 * backend answers newest-first. These eight rows are therefore the eight most
 * recently added matches, not the eight best; BookSuggestions re-ranks title
 * matches to the top of what comes back, but nothing on the client can widen
 * that window. Fixing it properly means a `sort` on the /books endpoint.
 */
export function useBookSuggestions(term: string, enabled: boolean) {
  return useQuery({
    queryKey: booksSuggestKey(term),
    queryFn: ({ signal }) => booksService.getBooks({ search: term, limit: SUGGEST_LIMIT }, { signal }),
    enabled: enabled && term.length >= SEARCH_MIN_LENGTH,
    placeholderData: keepPreviousData,
    staleTime: SEARCH_STALE_TIME_MS,
  });
}

/** Resolves to null on a 404 — BookDetails' not-found state, distinct from isError. */
export function useBook(id: string | undefined) {
  return useQuery({
    queryKey: bookKey(id),
    queryFn: ({ signal }) => booksService.getBookById(id as string, { signal }),
    enabled: !!id,
  });
}

export function useChapters(bookId: string, editionId: string | undefined) {
  return useQuery({
    queryKey: chaptersKey(bookId, editionId),
    queryFn: ({ signal }) => booksService.getChapters(bookId, editionId as string, { signal }),
    enabled: !!editionId,
    staleTime: 5 * MINUTE_MS,
  });
}

/** The numbered contents tree (parts → chapters → sections) of one language. */
export function useContents(bookId: string, editionId: string | undefined) {
  return useQuery({
    queryKey: contentsKey(bookId, editionId),
    queryFn: ({ signal }) => booksService.getContents(bookId, editionId as string, { signal }),
    enabled: !!editionId,
    staleTime: 5 * MINUTE_MS,
  });
}

export function useChapter(bookId: string, editionId: string | undefined, chapterId: string | undefined) {
  return useQuery({
    queryKey: chapterKey(bookId, editionId, chapterId),
    queryFn: ({ signal }) =>
      booksService.getChapter(bookId, editionId as string, chapterId as string, { signal }),
    enabled: !!editionId && !!chapterId,
    staleTime: 5 * MINUTE_MS,
  });
}

export function useChapterPages(
  bookId: string,
  editionId: string | undefined,
  chapterId: string | undefined,
) {
  return useQuery({
    queryKey: pagesKey(bookId, editionId, chapterId),
    queryFn: ({ signal }) =>
      booksService.getPages(bookId, editionId as string, chapterId as string, { signal }),
    enabled: !!editionId && !!chapterId,
    staleTime: 30 * MINUTE_MS,
  });
}

/**
 * The bookmark for one edition. staleTime Infinity is the cache CONTRACT:
 * after the first fetch, the only writer is useSaveReadingProgress's
 * setQueryData below — NEVER invalidate or refetch this key mid-read, or the
 * server's stale copy would yank the reader backwards.
 */
export function useReadingProgress(bookId: string, editionId: string | undefined) {
  return useQuery({
    queryKey: readingProgressKey(bookId, editionId),
    queryFn: ({ signal }) => booksService.getReadingProgress(bookId, editionId as string, { signal }),
    enabled: !!editionId,
    staleTime: Infinity,
  });
}

/**
 * The PATCH. Every success is written straight into the cache — no
 * invalidation, no refetch (see useReadingProgress). Throttling lives in
 * useReadingProgressSaver, not here.
 */
export function useSaveReadingProgress(bookId: string, editionId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (position: { chapterId?: string; sectionId?: string; pageNumber?: number; progress: number }) =>
      booksService.updateReadingProgress(bookId, editionId as string, position),
    onSuccess: (progress: BookReadingProgress) => {
      queryClient.setQueryData(readingProgressKey(bookId, editionId), progress);
    },
  });
}
