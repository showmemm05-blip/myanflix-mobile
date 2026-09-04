import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { booksService } from "@/services/books.service";
import type { BookQuery, BookReadingProgress } from "@/types/book";

/**
 * THE book query keys — spelled here and nowhere else. Screens invalidate or
 * read the cache only through these helpers, so a key typo cannot split the
 * cache in two.
 */
export const booksKey = (query: BookQuery) => ["books", query] as const;
export const booksInfiniteKey = (query: BookQuery) => ["books", "infinite", query] as const;
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

/** The catalog list — the search field drives this; the signal aborts a superseded term. */
export function useBooks(query: BookQuery = {}) {
  return useQuery({
    queryKey: booksKey(query),
    queryFn: ({ signal }) => booksService.getBooks(query, { signal }),
    placeholderData: keepPreviousData,
    staleTime: MINUTE_MS,
  });
}

/** The catalog grid's endless scroll. */
export function useBooksInfinite(query: BookQuery = {}) {
  return useInfiniteQuery({
    queryKey: booksInfiniteKey(query),
    queryFn: ({ pageParam, signal }) => booksService.getBooks({ ...query, page: pageParam }, { signal }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((count, page) => count + page.items.length, 0);
      return loaded < lastPage.total ? lastPage.page + 1 : undefined;
    },
    placeholderData: keepPreviousData,
    staleTime: MINUTE_MS,
  });
}

/** Resolves to null on a 404 — BookDetails' not-found state, distinct from isError. */
export function useBook(id: string | undefined) {
  return useQuery({
    queryKey: bookKey(id),
    queryFn: () => booksService.getBookById(id as string),
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
    queryFn: () => booksService.getReadingProgress(bookId, editionId as string),
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
