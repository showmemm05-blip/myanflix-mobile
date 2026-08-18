import { useMemo } from "react";
import { MediaRail } from "@/components/movie/MediaRail";
import { formatDuration } from "@/utils/format";
import type { WatchHistoryEntry } from "@/types/video";

interface Props {
  title: string;
  entries: WatchHistoryEntry[];
  onPress: (movieId: string) => void;
  onSeeAll?: () => void;
  seeAllLabel?: string;
  loading?: boolean;
}

/**
 * "Pick up where you left off" shelf. Same MediaCard as every other rail, with
 * the watch-progress line across the artwork and the percentage in the corner.
 * The poster tile is suppressed — history entries only carry the one image.
 */
export function ContinueWatchingRow({ title, entries, onPress, onSeeAll, seeAllLabel, loading }: Props) {
  // Stable identity keeps the rail's memoized cards out of the parent's render path.
  const items = useMemo(
    () =>
      entries.map((entry) => ({
        key: entry.id,
        title: entry.movieTitle,
        imageUrl: entry.posterUrl,
        showPoster: false,
        meta: [entry.durationMinutes ? formatDuration(entry.durationMinutes) : null],
        progress: Math.min(100, Math.max(0, entry.progress)) / 100,
        cornerLabel: `${Math.round(Math.min(100, Math.max(0, entry.progress)))}%`,
        onPress: () => onPress(entry.movieId),
      })),
    [entries, onPress],
  );

  return (
    <MediaRail
      title={title}
      icon="play-circle-outline"
      onSeeAll={onSeeAll}
      seeAllLabel={seeAllLabel}
      loading={loading}
      items={items}
    />
  );
}
