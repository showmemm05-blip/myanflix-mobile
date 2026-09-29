import { memo, useMemo } from "react";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ListCard } from "@/components/search/ListCard";
import { AGE_RATING_LABELS } from "@/utils/ageRating";
import { useIsInWatchlist, useToggleWatchlist } from "@/hooks/useWatchlist";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatDuration } from "@/utils/format";
import { theme } from "@/theme";
import type { Movie } from "@/types/movie";

interface Props {
  movie: Movie;
  /** The card body — opens MovieDetails. */
  onPress: (movie: Movie) => void;
  /**
   * The "Watch Now" pill. The SCREEN decides what it does: it plays directly
   * when the viewer has access (the same `hasAccess` rule MovieDetails uses)
   * and opens MovieDetails — where the subscribe CTA lives — when not. Kept
   * out of the card so the card never has to know about subscriptions.
   */
  onWatch: (movie: Movie) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * A movie as a results row. Memoized because the list above it lives on a
 * screen whose state changes on every keystroke; with stable callbacks from
 * the screen, a keystroke re-renders none of these.
 *
 * The bookmark owns its own watchlist hooks rather than taking a boolean from
 * the screen: the alternative — reading the whole watchlist in the screen and
 * threading `inWatchlist` through `renderItem` — would give `renderItem` a new
 * identity every time any title was bookmarked and re-render every visible
 * row for it. The query is one key shared by every card, so thirty observers
 * cost one request.
 */
export const MovieListCard = memo(function MovieListCard({ movie, onPress, onWatch, style }: Props) {
  const { t } = useLanguage();
  const inWatchlist = useIsInWatchlist(movie.id);
  const toggleWatchlist = useToggleWatchlist();

  /**
   * "2010 · 2h 28m · PG-13" — each part only when it exists, so an untimed
   * or unrated title loses the part AND its dot rather than showing "· ·".
   */
  const meta = useMemo(
    () =>
      [
        movie.releaseYear > 0 ? String(movie.releaseYear) : null,
        formatDuration(movie.duration),
        movie.ageRating ? AGE_RATING_LABELS[movie.ageRating] : null,
      ]
        .filter((part): part is string => part !== null)
        .join(" · "),
    [movie.releaseYear, movie.duration, movie.ageRating],
  );
  const chips = useMemo(() => movie.categories.map((category) => category.name), [movie.categories]);
  const action = useMemo(
    () => ({ label: t.search.watchNow, icon: "play" as const, onPress: () => onWatch(movie), solid: true }),
    [t, onWatch, movie],
  );

  return (
    <ListCard
      title={movie.title}
      posterUrl={movie.posterUrl}
      coverUrl={movie.coverUrl}
      accessType={movie.accessType}
      meta={meta}
      chips={chips}
      description={movie.description ?? ""}
      rating={movie.rating}
      action={action}
      onPress={() => onPress(movie)}
      style={style}
      corner={
        <Pressable
          onPress={() => toggleWatchlist.mutate(movie.id)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityState={{ selected: inWatchlist }}
          accessibilityLabel={inWatchlist ? t.movie.removeFromFavorites : t.movie.addToFavorites}
          style={({ pressed }) => [styles.bookmark, pressed && styles.bookmarkPressed]}
        >
          <Ionicons
            name={inWatchlist ? "bookmark" : "bookmark-outline"}
            size={20}
            color={inWatchlist ? theme.colors.primary : theme.colors.textMuted}
          />
        </Pressable>
      }
    />
  );
});

const styles = StyleSheet.create({
  /**
   * 32pt box with a 6pt hitSlop — the 44pt touch minimum is met without
   * pushing the title over by a control-sized gap. Negative margins pull the
   * glyph into the card's own padding so the icon sits in the corner, not a
   * third of the way in.
   */
  bookmark: {
    width: 32,
    height: 32,
    marginTop: -6,
    marginRight: -6,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  bookmarkPressed: { opacity: 0.6 },
});
