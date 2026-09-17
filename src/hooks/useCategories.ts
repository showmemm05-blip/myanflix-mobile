import { useQuery } from "@tanstack/react-query";
import { categoriesService } from "@/services/categories.service";


export function useCategory(id: string | undefined) {
  return useQuery({
    queryKey: ["category", id],
    queryFn: ({ signal }) => categoriesService.getCategoryById(id as string, { signal }),
    enabled: !!id,
  });
}
