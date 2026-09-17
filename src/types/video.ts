export interface StreamSubtitle {
  id: string;
  language: string;
  label: string;
  format: "SRT" | "VTT" | "ASS";
  isDefault: boolean;
  /**
   * Signed link to the UPLOADED SOURCE file, expiring on the same ~12h
   * schedule as the playlist. Its timings are content-relative, which is what
   * lets them be compared straight against the player's currentTime.
   */
  url: string;
}

export interface StreamQuality {
  /** The stored resolution verbatim — "720p". Never translated, never re-derived. */
  label: string;
  /**
   * Signed link to that rendition's OWN media playlist, under the same
   * `videos/<id>/hls` scope (and so the same token and expiry) as the master.
   * Playing it is what "pin 720p" has to mean here: expo-video cannot be told
   * to hold a video track, so it is handed a playlist that only has one.
   */
  url: string;
}

export interface StreamInfo {
  playlistUrl: string;
  /**
   * The ladder the master adapts between, addressable one rung at a time,
   * best-first. Optional because the phone can be talking to a backend that
   * has not been redeployed with the field yet — an absent list simply means
   * no quality control.
   */
  qualities?: StreamQuality[];
  /**
   * The subtitles this title offers — and, since the app draws captions
   * itself, the list the picker is built from and the files it reads. They are
   * richer than the manifest's renditions in both directions: `isDefault`
   * records the DEFAULT=YES flag expo-video's SubtitleTrack does not expose,
   * and an ASS row appears here even though it is deliberately left out of the
   * manifest, because our own parser can render it.
   */
  subtitles?: StreamSubtitle[];
}

export interface WatchHistoryEntry {
  id: string;
  movieId: string;
  movieTitle: string;
  posterUrl: string | null;
  durationMinutes: number | null;
  progress: number; // 0-100
  lastPosition: number; // seconds
  updatedAt: string;
}
