import { booksApi } from "@/api/books.api";
import { API_BASE_URL } from "@/api/client";
import { ApiError } from "@/utils/errors";
import type { PaginatedResponse, RequestSignalOptions } from "@/types/api";
import type {
  Book,
  BookChapter,
  BookChapterSummary,
  BookContents,
  BookDetail,
  BookPage,
  BookQuery,
  BookReadingProgress,
} from "@/types/book";

/**
 * Origin the API lives on, with its trailing `/api` stripped — the base a
 * server-relative asset path would hang off.
 */
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

/**
 * Page/cover URLs come back absolute already (and re-host per request, so
 * they survive a network hop) — this only covers the relative-path fallback
 * the web's bookService also guards against.
 */
function absolute(url: string): string {
  return url.startsWith("http") ? url : `${API_ORIGIN}${url}`;
}

export const booksService = {
  getBooks(query: BookQuery = {}, options: RequestSignalOptions = {}): Promise<PaginatedResponse<Book>> {
    return booksApi.getBooks(query, options);
  },

  /**
   * Null for a 404 (unpublished/removed — BookDetails renders its not-found
   * state); every other failure still throws so a network error never
   * masquerades as a missing book.
   */
  async getBookById(id: string, options: RequestSignalOptions = {}): Promise<BookDetail | null> {
    try {
      return await booksApi.getBookById(id, options);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  },

  getChapters(
    bookId: string,
    editionId: string,
    options: RequestSignalOptions = {},
  ): Promise<BookChapterSummary[]> {
    return booksApi.getChapters(bookId, editionId, options);
  },

  getContents(
    bookId: string,
    editionId: string,
    options: RequestSignalOptions = {},
  ): Promise<BookContents> {
    return booksApi.getContents(bookId, editionId, options);
  },

  getChapter(
    bookId: string,
    editionId: string,
    chapterId: string,
    options: RequestSignalOptions = {},
  ): Promise<BookChapter> {
    return booksApi.getChapter(bookId, editionId, chapterId, options);
  },

  async getPages(
    bookId: string,
    editionId: string,
    chapterId: string,
    options: RequestSignalOptions = {},
  ): Promise<BookPage[]> {
    const pages = await booksApi.getPages(bookId, editionId, chapterId, options);
    return pages.map((page) => ({ ...page, url: absolute(page.url) }));
  },

  getReadingProgress(
    bookId: string,
    editionId: string,
    options: RequestSignalOptions = {},
  ): Promise<BookReadingProgress | null> {
    return booksApi.getReadingProgress(bookId, editionId, options);
  },

  updateReadingProgress(
    bookId: string,
    editionId: string,
    position: { chapterId?: string; sectionId?: string; pageNumber?: number; progress: number },
  ): Promise<BookReadingProgress> {
    return booksApi.updateReadingProgress(bookId, editionId, position);
  },
};
