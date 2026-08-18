import { useQuery } from "@tanstack/react-query";
import { categoriesService } from "@/services/categories.service";

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesService.getCategories(),
  });
}

export function useCategory(id: string | undefined) {
  return useQuery({
    queryKey: ["category", id],
    queryFn: () => categoriesService.getCategoryById(id as string),
    enabled: !!id,
  });
}
