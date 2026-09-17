import { apiClient } from "@/api/client";
import type { RequestSignalOptions } from "@/types/api";
import type { Category } from "@/types/category";

export const categoriesApi = {
  getCategories() {
    return apiClient.get<Category[]>("/categories");
  },

  getCategoryById(id: string, options: RequestSignalOptions = {}) {
    return apiClient.get<Category>(`/categories/${id}`, options);
  },
};
