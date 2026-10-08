import { useQuery } from "@tanstack/react-query";
import { homeService } from "@/services/home.service";

/** Home's editorial data is kept five minutes (the server itself caches 60 s). */
export const HOME_SHOWCASE_STALE_MS = 5 * 60_000;

/**
 * GET /api/home/showcase — ONE request for the whole showcase (hero promos,
 * spotlight, coming soon, settings). The answer differs for a guest (no
 * BOOK links), so the key carries who is asking; signing out clears the
 * cache anyway.
 */
export function homeShowcaseKey(signedIn: boolean) {
  return ["home-showcase", signedIn ? "member" : "guest"] as const;
}

export function useHomeShowcase(signedIn: boolean) {
  return useQuery({
    queryKey: homeShowcaseKey(signedIn),
    queryFn: ({ signal }) => homeService.getShowcase({ signal }),
    staleTime: HOME_SHOWCASE_STALE_MS,
  });
}
