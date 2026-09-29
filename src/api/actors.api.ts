import { apiClient } from "@/api/client";
import type { PaginatedResponse, RequestSignalOptions } from "@/types/api";

/** One row of GET /actors — the shape ActorResponseDto sends. */
export interface ActorListItem {
  id: string;
  name: string;
  imageUrl: string | null;
  /**
   * STANDALONE movies only (rows with no series), counted server-side — the
   * same set GET /movies?actorIds= lists, so the caption and the grid agree.
   * Episode credits used to inflate this; they count under `seriesCount` now.
   */
  movieCount: number;
  /**
   * Distinct series the person appears in, on the show's own cast or on any
   * episode's — what GET /series?actorIds= lists.
   */
  seriesCount: number;
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
  /**
   * GET /actors/:id — the same row shape as one item of the list above. Public
   * (OptionalAuth), like the list; the actor page's filmography comes from the
   * public catalogue query (`actorIds`), NOT from GET /actors/:id/movies, which
   * requires login and has no paging.
   */
  getActor(id: string, options: RequestSignalOptions = {}) {
    return apiClient.get<ActorListItem>(`/actors/${id}`, options);
  },
};
