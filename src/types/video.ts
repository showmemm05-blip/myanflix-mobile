export interface StreamSubtitle {
  id: string;
  language: string;
  label: string;
  format: "SRT" | "VTT" | "ASS";
  isDefault: boolean;
  url: string;
}

export interface StreamInfo {
  playlistUrl: string;
  /**
   * The database rows behind the manifest's subtitle renditions. Playback
   * never uses these URLs — expo-video can only surface tracks it discovers
   * inside the manifest — but `isDefault` is the one fact the manifest carries
   * (DEFAULT=YES) that expo-video's SubtitleTrack does not expose, and the
   * player needs it to honour the default on a fresh install.
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
