import {
  bookAuthorsApi,
  type BookAuthorListItem,
  type BookAuthorQuery,
} from "@/api/bookAuthors.api";
import type { PaginatedResponse, RequestSignalOptions } from "@/types/api";

/**
 * Identity mapping today (the response shape is already what the app wants),
 * kept for the same reason actors.service.ts keeps its own: screens import
 * services, never api modules, so a future field rename has one seam.
 */
export const bookAuthorsService = {
  async searchAuthors(
    query: BookAuthorQuery = {},
    options: RequestSignalOptions = {},
  ): Promise<PaginatedResponse<BookAuthorListItem>> {
    return bookAuthorsApi.searchAuthors(query, options);
  },
  async getAuthor(id: string, options: RequestSignalOptions = {}): Promise<BookAuthorListItem> {
    return bookAuthorsApi.getAuthor(id, options);
  },
};
