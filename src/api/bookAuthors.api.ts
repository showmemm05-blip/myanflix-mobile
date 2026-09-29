import { apiClient } from "@/api/client";
import type { PaginatedResponse, RequestSignalOptions } from "@/types/api";

/** One row of GET /book-authors — the shape BookAuthorResponseDto sends. */
export interface BookAuthorListItem {
  id: string;
  name: string;
  imageUrl: string | null;
  /**
   * The author's blurb. Actors have no equivalent field, so this is the ONE
   * place the two features differ — the author page renders it when present.
   */
  bio: string | null;
  /** Counted from the join server-side, never cached. */
  bookCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BookAuthorQuery {
  /** Name contains, case-insensitive. */
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * The authors twin of actors.api.ts. ONE honest difference: /book-authors
 * requires a signed-in caller (a guest gets 401), exactly like /books itself —
 * which is why nothing reaches these screens signed out: the Books tab renders
 * its `booksSignedOutTitle` state instead of the results header that carries
 * the Authors button.
 */
export const bookAuthorsApi = {
  /** The author picker endpoint — alphabetical, `{items,total,page,limit}`. */
  searchAuthors(query: BookAuthorQuery = {}, options: RequestSignalOptions = {}) {
    return apiClient.get<PaginatedResponse<BookAuthorListItem>>("/book-authors", {
      params: query,
      ...options,
    });
  },
  /**
   * GET /book-authors/:id — the same row shape as one item of the list above.
   * The author page's bibliography comes from the catalogue query
   * (`GET /books?authorId=…`), not from this row's `bookCount`, which counts
   * every book including the ones this viewer may not see.
   */
  getAuthor(id: string, options: RequestSignalOptions = {}) {
    return apiClient.get<BookAuthorListItem>(`/book-authors/${id}`, options);
  },
};
