import { apiClient } from "@/api/client";
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

/** All /books endpoints sit behind the global JwtAuthGuard — a 401 means session, not code. */
export const booksApi = {
  /**
   * The library read. Regular users only ever receive PUBLISHED books — that
   * filter lives in the backend service, so there is nothing to pass here.
   * `options.signal` is the catalog search's abort handle.
   */
  getBooks(query: BookQuery = {}, options: RequestSignalOptions = {}) {
    return apiClient.get<PaginatedResponse<Book>>("/books", { params: query, ...options });
  },

  getBookById(id: string) {
    return apiClient.get<BookDetail>(`/books/${id}`);
  },

  /**
   * The chapter list of ONE language. Chapters hang off an edition, not off
   * the book, so the language is part of the address rather than a filter.
   */
  getChapters(bookId: string, editionId: string, options: RequestSignalOptions = {}) {
    return apiClient.get<BookChapterSummary[]>(`/books/${bookId}/editions/${editionId}/chapters`, options);
  },

  /** The numbered Part → Chapter → Section tree of one language — what every table of contents renders from. */
  getContents(bookId: string, editionId: string, options: RequestSignalOptions = {}) {
    return apiClient.get<BookContents>(`/books/${bookId}/editions/${editionId}/contents`, options);
  },

  /** One chapter with its ProseMirror document — the written reader's per-chapter fetch. */
  getChapter(bookId: string, editionId: string, chapterId: string, options: RequestSignalOptions = {}) {
    return apiClient.get<BookChapter>(
      `/books/${bookId}/editions/${editionId}/chapters/${chapterId}`,
      options,
    );
  },

  /**
   * Every converted page of one PDF chapter, in reading order. Returned whole
   * rather than paginated: it is a few hundred bytes per page and the reader
   * needs the full manifest up front to size its scroll. The IMAGES lazy-load,
   * not this.
   */
  getPages(bookId: string, editionId: string, chapterId: string, options: RequestSignalOptions = {}) {
    return apiClient.get<BookPage[]>(
      `/books/${bookId}/editions/${editionId}/chapters/${chapterId}/pages`,
      options,
    );
  },

  /** Null when this reader has never opened this language. */
  getReadingProgress(bookId: string, editionId: string) {
    return apiClient.get<BookReadingProgress | null>(
      `/books/${bookId}/editions/${editionId}/reading-progress`,
    );
  },

  /** Fire-and-forget from the reader's point of view — see useReadingProgressSaver's throttle. */
  updateReadingProgress(
    bookId: string,
    editionId: string,
    position: { chapterId?: string; sectionId?: string; pageNumber?: number; progress: number },
  ) {
    return apiClient.patch<BookReadingProgress>(
      `/books/${bookId}/editions/${editionId}/reading-progress`,
      position,
    );
  },
};
