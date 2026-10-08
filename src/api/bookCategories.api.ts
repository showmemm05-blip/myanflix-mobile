import { apiClient } from "@/api/client";
import type { RequestSignalOptions } from "@/types/api";

/**
 * One row of GET /book-categories — the books' OWN shelves (the backend's
 * BookCategory table, BookCategoriesService.findAll), not the movie
 * categories GET /categories returns.
 */
export interface BookCategory {
  id: string;
  name: string;
  description: string | null;
  /**
   * Counted from the join server-side and NOT filtered by publish state: it
   * includes books this viewer cannot see. Good for ranking shelves; for a
   * count shown to the reader, trust GET /books?categoryId=…'s own `total`.
   */
  bookCount: number;
}

/**
 * The book-categories read. Behind the global JwtAuthGuard like /books
 * itself (a guest gets 401), always ordered by name, never paginated — the
 * whole list in one array.
 */
export const bookCategoriesApi = {
  getBookCategories(options: RequestSignalOptions = {}) {
    return apiClient.get<BookCategory[]>("/book-categories", options);
  },
};
