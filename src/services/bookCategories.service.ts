import { bookCategoriesApi, type BookCategory } from "@/api/bookCategories.api";
import type { RequestSignalOptions } from "@/types/api";

/**
 * Identity mapping today (the response shape is already what the app wants),
 * kept for the same reason bookAuthors.service.ts keeps its own: screens and
 * hooks import services, never api modules, so a field rename has one seam.
 */
export const bookCategoriesService = {
  getBookCategories(options: RequestSignalOptions = {}): Promise<BookCategory[]> {
    return bookCategoriesApi.getBookCategories(options);
  },
};
