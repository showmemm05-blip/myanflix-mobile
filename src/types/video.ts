export interface StreamInfo {
  playlistUrl: string;
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
