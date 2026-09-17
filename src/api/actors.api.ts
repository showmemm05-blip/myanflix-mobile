import { apiClient } from "@/api/client";
import type { PaginatedResponse, RequestSignalOptions } from "@/types/api";

/** One row of GET /actors — the shape ActorResponseDto sends. */
export interface ActorListItem {
  id: string;
  name: string;
  imageUrl: string | null;
  /** Counted from the join server-side, never cached. */
  movieCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActorQuery {
  /** Name contains, case-insensitive. */
  search?: string;
  page?: number;
  limit?: number;
}

export const actorsApi = {
  /** The actor picker endpoint — alphabetical, `{items,total,page,limit}`. */
  searchActors(query: ActorQuery = {}, options: RequestSignalOptions = {}) {
    return apiClient.get<PaginatedResponse<ActorListItem>>("/actors", { params: query, ...options });
  },
  // No `getActorById`: there is no actor detail screen, and the only actor UI
  // in the app is the filter sheet's cast picker, which needs search alone.
  // Restore it (and the service wrapper) when a detail screen lands.
};
