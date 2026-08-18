import { apiClient } from "@/api/client";
import type { Category } from "@/types/category";

export const categoriesApi = {
  getCategories() {
    return apiClient.get<Category[]>("/categories");
  },

  getCategoryById(id: string) {
    return apiClient.get<Category>(`/categories/${id}`);
  },
};
