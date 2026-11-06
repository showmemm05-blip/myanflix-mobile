import { useQuery } from "@tanstack/react-query";
import { adsApi } from "@/api/ads.api";
import type { BreakPlan, CornerAd, VideoAd } from "@/types/ads";

export interface AdSessionState {
  /** The ad to play before the title, or null once it is known there is none. */
  preroll: VideoAd | null;
  /** The ad-break plan for this viewing; null = no breaks. */
  breaks: BreakPlan | null;
  /** The corner picture for this viewing; null = none. */
  corner: CornerAd | null;
  /** Whether the question has an answer — ads, none, or a request that failed or timed out. */
  decided: boolean;
}

/**
 * The ads for one title (`POST /ads/session`), asked once while that title is
 * on screen and never refetched there: `retry: false` because a 404 (hidden
 * title) or a timeout both mean "no ads", `staleTime: Infinity` plus every
 * refetch switch off because a second answer landing mid-film could put a
 * pre-roll over a picture that is already playing (and the break plan is kept
 * for the whole viewing anyway), and `gcTime: 0` because the session belongs
 * to this showing — a new open, or an episode swap away and back, asks afresh.
 *
 * Every open asks: the server applies the admin's "Same movie again" rule
 * (Advertisements → Playback rules) and the breaks already played, and
 * answers accordingly. The phone keeps no memory of its own, which would
 * outlast a setting the admin has just lowered.
 */
export function useAdSession(movieId: string): AdSessionState {
  const query = useQuery({
    queryKey: ["ad-session", movieId],
    queryFn: ({ signal }) => adsApi.getSession(movieId, { signal }),
    enabled: !!movieId,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const decided = query.isSuccess || query.isError;
  const session = query.isSuccess ? query.data : null;

  return {
    preroll: session?.preroll ?? null,
    breaks: session?.breaks ?? null,
    corner: session?.corner ?? null,
    decided,
  };
}
