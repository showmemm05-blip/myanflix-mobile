import { useMemo, type ReactElement } from "react";
import type { Ionicons } from "@expo/vector-icons";
import { MediaRail } from "@/components/movie/MediaRail";
import { movieCardContent } from "@/components/movie/mediaItems";
import type { Movie } from "@/types/movie";

interface Props {
  title: string;
  movies: Movie[];
  onPressMovie: (movie: Movie) => void;
  onSeeAll?: () => void;
  seeAllLabel?: string;
  /** Small uppercase line above the title. */
  eyebrow?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  accent?: string;
  loading?: boolean;
  subtitle?: string;
  /** Fixed card width — see MediaRail. */
  cardWidth?: number;
  endTile?: ReactElement | null;
  /** NEW tab on recently added titles (see movieCardContent's markNew). */
  markNew?: boolean;
}

/** A curated shelf of movies. Renders nothing when the list is empty. */
export function MovieRow({
  title,
  movies,
  onPressMovie,
  onSeeAll,
  seeAllLabel,
  eyebrow,
  icon,
  accent,
  loading,
  subtitle,
  cardWidth,
  endTile,
  markNew,
}: Props) {
  // Held stable so the rail's memoized cards survive an unrelated re-render of
  // the screen — rebuilding this array remounts nothing but re-renders every card.
  const items = useMemo(
    () =>
      movies.map((movie) => ({
        key: movie.id,
        ...movieCardContent(movie, { markNew }),
        onPress: () => onPressMovie(movie),
      })),
    [movies, onPressMovie, markNew],
  );

  return (
    <MediaRail
      title={title}
      eyebrow={eyebrow}
      icon={icon}
      accent={accent}
      onSeeAll={onSeeAll}
      seeAllLabel={seeAllLabel}
      loading={loading}
      items={items}
      subtitle={subtitle}
      cardWidth={cardWidth}
      endTile={endTile}
    />
  );
}
