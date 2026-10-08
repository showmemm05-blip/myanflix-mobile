import { useQuery } from "@tanstack/react-query";
import { categoriesService } from "@/services/categories.service";

/**
 * Every category (GET /categories) — the Browse page. Five minutes fresh: the
 * list only changes when an admin edits the taxonomy, and Browse is a page
 * people bounce in and out of. Its key cannot collide with useCategory's
 * (length 1 vs ["category", id]).
 */
export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesService.getCategories(),
    staleTime: 5 * 60_000,
  });
}

export function useCategory(id: string | undefined) {
  return useQuery({
    queryKey: ["category", id],
    queryFn: ({ signal }) => categoriesService.getCategoryById(id as string, { signal }),
    enabled: !!id,
  });
}
