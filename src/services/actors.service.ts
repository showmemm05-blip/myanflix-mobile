import { actorsApi, type ActorListItem, type ActorQuery } from "@/api/actors.api";
import type { PaginatedResponse, RequestSignalOptions } from "@/types/api";

/**
 * Identity mapping today (the response shape is already what the app wants),
 * kept for the same reason movies.service.ts keeps `mapMovie`: screens import
 * services, never api modules, so a future field rename has one seam.
 */
export const actorsService = {
  async searchActors(
    query: ActorQuery = {},
    options: RequestSignalOptions = {},
  ): Promise<PaginatedResponse<ActorListItem>> {
    return actorsApi.searchActors(query, options);
  },

  async getActorById(id: string): Promise<ActorListItem> {
    return actorsApi.getActorById(id);
  },
};
