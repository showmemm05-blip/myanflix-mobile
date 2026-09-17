import { categoriesApi } from "@/api/categories.api";
import type { RequestSignalOptions } from "@/types/api";
import type { Category } from "@/types/category";

export const categoriesService = {
  getCategories(): Promise<Category[]> {
    return categoriesApi.getCategories();
  },

  getCategoryById(id: string, options: RequestSignalOptions = {}): Promise<Category> {
    return categoriesApi.getCategoryById(id, options);
  },
};
