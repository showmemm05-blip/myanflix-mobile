import type { AccessType, Movie } from "@/types/movie";

export function hasAccess(accessType: AccessType, isSubscribed: boolean): boolean {
  return accessType === "FREE" || isSubscribed;
}

/** A standalone movie is free, even if this device still has older catalog data. */
export function movieAccessType(movie: Pick<Movie, "seriesId" | "accessType">): AccessType {
  return movie.seriesId ? movie.accessType : "FREE";
}
