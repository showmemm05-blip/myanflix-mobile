import { categoriesApi } from "@/api/categories.api";
import type { Category } from "@/types/category";

export const categoriesService = {
  getCategories(): Promise<Category[]> {
    return categoriesApi.getCategories();
  },

  getCategoryById(id: string): Promise<Category> {
    return categoriesApi.getCategoryById(id);
  },
};
