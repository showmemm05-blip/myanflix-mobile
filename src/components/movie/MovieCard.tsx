import type { StyleProp, ViewStyle } from "react-native";
import { MediaCard, type MediaCardAction } from "@/components/common/MediaCard";
import { movieCardContent } from "@/components/movie/mediaItems";
import type { Movie } from "@/types/movie";

/**
 * Default width for a movie card in a horizontal strip. Kept exported for call
 * sites that size their own list cells; rails should prefer `useRailCardWidth()`
 * so the card scales with the screen.
 */
export const MOVIE_CARD_WIDTH = 260;

interface Props {
  movie: Movie;
  onPress: (movie: Movie) => void;
  onLongPress?: (movie: Movie) => void;
  /** Fixed width (strips). Omit to fill the parent — the layout grids use. */
  width?: number;
  /** Trailing control on the info row, e.g. "remove from favorites". */
  action?: MediaCardAction;
  /** 0–1 watch progress line across the artwork. */
  progress?: number | null;
  style?: StyleProp<ViewStyle>;
}

/**
 * A movie rendered as the app's signature MediaCard — thin mapping layer only,
 * so movies, series and history entries all share one card implementation.
 */
export function MovieCard({ movie, onPress, onLongPress, width, action, progress, style }: Props) {
  return (
    <MediaCard
      {...movieCardContent(movie)}
      width={width}
      progress={progress}
      action={action}
      onPress={() => onPress(movie)}
      onLongPress={onLongPress ? () => onLongPress(movie) : undefined}
      style={style}
    />
  );
}
