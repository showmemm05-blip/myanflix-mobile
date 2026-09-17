import { useQuery } from "@tanstack/react-query";
import { parseSubtitleCues, type SubtitleCue } from "@/video/subtitleCues";
import type { StreamSubtitle } from "@/types/video";

/**
 * Loads the cues for the chosen subtitle so the app can paint them itself.
 *
 * `fetch`, not `apiClient`: the URL is an absolute, already-signed link to the
 * source file on the cache server, so the axios client's base URL, auth header
 * and envelope unwrapping would all be wrong here.
 *
 * The signed link expires on the same ~12h schedule as the playlist, which is
 * why `retry` is off — a stale link has to surface IMMEDIATELY so the screen
 * can ask the API for a fresh one (and fall back to the native renderer
 * meanwhile) instead of silently retrying a URL that will never work again.
 * `staleTime: Infinity` is safe for the opposite reason: the URL is part of
 * the key, so a fresh link is a different query rather than a refetch.
 */
export function useSubtitleCues(subtitle: StreamSubtitle | null) {
  return useQuery<SubtitleCue[]>({
    queryKey: ["subtitle-cues", subtitle?.id, subtitle?.url],
    queryFn: async () => {
      const response = await fetch((subtitle as StreamSubtitle).url);
      if (!response.ok) throw new Error(`subtitle ${response.status}`);
      const cues = parseSubtitleCues(await response.text());
      // A file we cannot get a single cue out of is a failure, not an empty
      // track: thrown, it takes the same fallback path as a dead link and the
      // native renderer gets its turn, rather than leaving the viewer with a
      // subtitle switched on that never shows anything.
      if (cues.length === 0) throw new Error("subtitle empty");
      return cues;
    },
    enabled: !!subtitle,
    retry: false,
    staleTime: Infinity,
  });
}
