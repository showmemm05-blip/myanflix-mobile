import { memo, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
// Deep imports, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
// The crown is CrownGlyph, the one MediaCard draws, so the premium mark reads
// the same everywhere.
import Ionicons from "@expo/vector-icons/Ionicons";
import { CrownGlyph } from "@/components/common/CrownGlyph";
import { PressableScale } from "@/components/ui/PressableScale";
import { ThemedText } from "@/components/ui/ThemedText";
import { Skeleton } from "@/components/common/Skeleton";
import { HubFallbackArt } from "@/components/hub/HubFallbackArt";
import { isRecentlyAdded } from "@/components/movie/mediaItems";
import { useIsInWatchlist, useToggleWatchlist } from "@/hooks/useWatchlist";
import { useLanguage } from "@/localization/LanguageProvider";
import type { TranslationShape } from "@/localization/translations";
import { theme } from "@/theme";
import type { AccessType, Movie } from "@/types/movie";
import { AGE_RATING_LABELS } from "@/utils/ageRating";
import { formatDuration } from "@/utils/format";
import type { SeriesListItem } from "@/types/series";

/** 2:3 — the poster's height is always 1.5× the cell width. */
const POSTER_RATIO = 1.5;
/** The play disc and the bookmark both reserve a full 44pt target. */
const TOUCH = theme.layout.minTouch;
const PLAY_DISC = 30;
const BOOKMARK_BOX = 36;
const BOOKMARK_SLOP = (TOUCH - BOOKMARK_BOX) / 2;
/**
 * The NEW tab's text-size ceiling. It is a mark on the art, beside the 44pt
 * play target, in a cell that is 89pt wide on a 320pt phone; past 1.4× it
 * would run under the play disc. Nothing is lost by the cap: "New" is also
 * spoken in the cell's label.
 */
const NEW_TAB_MAX_SCALE = 1.4;

/*
 * The Media tab's poster cells — the Marquee boards' 3-column grid.
 *
 * WHAT CHANGED from the old one-per-row list cards, deliberately: the blurb
 * and the category chips are gone (a 3-column grid has no room for them),
 * "Watch Now" became a play disc in the poster's top-right corner (the SAME
 * hasAccess rule — the screen decides what it does), and the bookmark moved
 * under the poster beside the rating and year.
 *
 * The title stays as a line under the poster. The boards draw it inside the
 * art, but that is the drawn stand-in for a real poster; a real posterUrl is
 * not guaranteed to carry its title, and a grid of untitled pictures would
 * be unreadable. Rating and year each hide at 0 (the API's "not set").
 */

/**
 * "Inle Blue, 2025, 2h 8m, PG-13, rated 8.0, Premium, New" — each part only
 * when it exists. Running time and age rating are spoken though the cell does
 * not draw them (the board's line is only "★ rating · year"), so a
 * screen-reader user still gets what the old list card's meta line carried;
 * the marks on the art (crown, NEW tab) are part of what the cell says too.
 */
function posterLabel(
  t: TranslationShape,
  title: string,
  parts: { year: number; rating: number; accessType?: AccessType | null; extra?: string | null; isNew?: boolean },
): string {
  return [
    title,
    parts.year > 0 ? String(parts.year) : null,
    parts.extra ?? null,
    parts.rating > 0 ? t.search.ratedA11y.replace("{n}", parts.rating.toFixed(1)) : null,
    parts.accessType === "SUBSCRIPTION" ? t.movie.premium : null,
    parts.isNew ? t.movie.newBadge : null,
  ]
    .filter((part): part is string => part !== null)
    .join(", ");
}

/**
 * The artwork: the real poster plus the premium crown and, when the data says
 * so, the crimson NEW tab (MediaCard's: flush with the left edge, below the
 * crown when both apply). With no poster, the kind's quiet glyph — or, where
 * the cell sits in a hub's "All …" grid (`drawnSeed`), the hub's drawn
 * HubFallbackArt for that title.
 */
function PosterArt({
  url,
  accessType,
  fallbackIcon,
  drawnSeed,
  isNew = false,
}: {
  url: string | null;
  accessType?: AccessType | null;
  fallbackIcon: keyof typeof Ionicons.glyphMap;
  drawnSeed?: string;
  isNew?: boolean;
}) {
  const { t } = useLanguage();
  const isPremium = accessType === "SUBSCRIPTION";
  return (
    <>
      {url ? (
        <Image
          source={{ uri: url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={180}
          // Grid cells leave the list window and come back; re-decoding a
          // poster from disk each time is the expensive half of a fling.
          cachePolicy="memory-disk"
          accessible={false}
        />
      ) : drawnSeed ? (
        <HubFallbackArt seed={drawnSeed} format="poster" />
      ) : (
        <View style={styles.fallback}>
          <Ionicons name={fallbackIcon} size={24} color={theme.colors.textFaint} />
        </View>
      )}
      {isPremium ? (
        <View style={styles.crown} pointerEvents="none">
          <CrownGlyph size={12} color={theme.colors.premium} />
        </View>
      ) : null}
      {isNew ? (
        <View
          style={[styles.newTab, isPremium && styles.newTabBelowCrown]}
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <ThemedText
            variant="overline"
            color={theme.colors.onPrimary}
            numberOfLines={1}
            maxFontSizeMultiplier={NEW_TAB_MAX_SCALE}
            style={styles.newTabText}
          >
            {t.movie.newBadge.toUpperCase()}
          </ThemedText>
        </View>
      ) : null}
    </>
  );
}

/**
 * "★ 8.9 · 2023" — the star only when rated, the year only when set. ONE text
 * run (the star glyph is itself text) so a narrow cell at large text wraps it
 * onto a second line instead of pushing the year out of the cell.
 */
function RatingYear({ rating, year }: { rating: number; year: number }) {
  const rated = rating > 0;
  const dated = year > 0;
  if (!rated && !dated) return <View style={styles.ratingYear} />;
  return (
    <ThemedText variant="label" weight="bold" tabular color={theme.colors.text} style={[styles.metaText, styles.ratingYear]}>
      {rated ? (
        <>
          <Ionicons name="star" size={12} color={theme.colors.premium} />
          {` ${rating.toFixed(1)}`}
        </>
      ) : null}
      {dated ? (
        <ThemedText variant="label" weight="medium" tabular color={theme.colors.textFaint} style={styles.metaText}>
          {rated ? ` · ${year}` : String(year)}
        </ThemedText>
      ) : null}
    </ThemedText>
  );
}

function CellTitle({ children }: { children: ReactNode }) {
  return (
    <ThemedText variant="caption" weight="bold" color={theme.colors.text} numberOfLines={2} style={styles.title}>
      {children}
    </ThemedText>
  );
}

interface MovieCellProps {
  movie: Movie;
  width: number;
  /** The poster — opens MovieDetails. */
  onPress: (movie: Movie) => void;
  /**
   * The play disc. The SCREEN decides what it does: it plays directly when the
   * viewer has access (the same `hasAccess` rule MovieDetails uses) and opens
   * MovieDetails — where the subscribe CTA lives — when not.
   */
  onWatch: (movie: Movie) => void;
  /** A title without a poster gets the hubs' drawn scene instead of the glyph (the hub "All movies" grid). */
  drawnFallback?: boolean;
  /**
   * Stamps the crimson NEW tab on a movie added in the last
   * NEW_TITLE_WINDOW_DAYS (isRecentlyAdded on `createdAt` — Browse's,
   * CategoryDetail's and the hubs' rule) and says "New" in the label. Off by
   * default; the search screen's results grid opts in.
   */
  markNew?: boolean;
}

/**
 * A movie in the grid. Memoized because the grid lives on a screen whose state
 * changes on every keystroke; with stable callbacks from the screen a
 * keystroke re-renders none of these.
 *
 * The bookmark owns its watchlist hooks (one shared query key, so thirty
 * observers cost one request) rather than taking a boolean through
 * renderItem, which would re-render every visible cell on any bookmark.
 */
export const MoviePosterCell = memo(function MoviePosterCell({
  movie,
  width,
  onPress,
  onWatch,
  drawnFallback = false,
  markNew = false,
}: MovieCellProps) {
  const { t } = useLanguage();
  const isNew = markNew && isRecentlyAdded(movie.createdAt);
  const inWatchlist = useIsInWatchlist(movie.id);
  const toggleWatchlist = useToggleWatchlist();

  return (
    <View style={{ width }}>
      <View>
        <PressableScale
          onPress={() => onPress(movie)}
          dimOnPress
          accessibilityLabel={posterLabel(t, movie.title, {
            year: movie.releaseYear,
            rating: movie.rating,
            accessType: movie.accessType,
            extra:
              [formatDuration(movie.duration), movie.ageRating ? AGE_RATING_LABELS[movie.ageRating] : null]
                .filter((part): part is string => part !== null)
                .join(", ") || null,
            isNew,
          })}
          style={[styles.poster, { height: Math.round(width * POSTER_RATIO) }]}
        >
          <PosterArt
            url={movie.posterUrl ?? movie.coverUrl}
            accessType={movie.accessType}
            fallbackIcon="film-outline"
            drawnSeed={drawnFallback ? movie.id : undefined}
            isNew={isNew}
          />
        </PressableScale>
        <Pressable
          onPress={() => onWatch(movie)}
          accessibilityRole="button"
          accessibilityLabel={t.search.watchNowA11y.replace("{title}", movie.title)}
          style={({ pressed }) => [styles.playTarget, pressed && styles.pressed]}
        >
          <View style={styles.playDisc}>
            <Ionicons name="play" size={13} color={theme.colors.text} style={styles.playGlyph} />
          </View>
        </Pressable>
      </View>

      <CellTitle>{movie.title}</CellTitle>
      <View style={styles.metaRow}>
        <RatingYear rating={movie.rating} year={movie.releaseYear} />
        <Pressable
          onPress={() => toggleWatchlist.mutate(movie.id)}
          hitSlop={BOOKMARK_SLOP}
          accessibilityRole="button"
          accessibilityState={{ selected: inWatchlist }}
          accessibilityLabel={inWatchlist ? t.movie.removeFromFavorites : t.movie.addToFavorites}
          style={({ pressed }) => [styles.bookmark, pressed && styles.pressed]}
        >
          <Ionicons
            name={inWatchlist ? "bookmark" : "bookmark-outline"}
            size={20}
            color={inWatchlist ? theme.colors.primary : theme.colors.textMuted}
          />
        </Pressable>
      </View>
    </View>
  );
});

interface SeriesCellProps {
  series: SeriesListItem;
  width: number;
  onPress: (series: SeriesListItem) => void;
  /** A series without a poster gets the hubs' drawn scene instead of the glyph (the hub "All series" grid). */
  drawnFallback?: boolean;
  /** The NEW tab and the spoken "New", by the same rule as MoviePosterCell's `markNew`. Off by default. */
  markNew?: boolean;
}

/**
 * A series in the grid — one tap target for the whole cell. No play disc (an
 * episode has to be picked on the series page first) and no bookmark (the
 * watchlist holds movie ids only, and a control that cannot work is worse
 * than none). The episode count replaces the bookmark row's job.
 */
export const SeriesPosterCell = memo(function SeriesPosterCell({
  series,
  width,
  onPress,
  drawnFallback = false,
  markNew = false,
}: SeriesCellProps) {
  const { t } = useLanguage();
  const isNew = markNew && isRecentlyAdded(series.createdAt);
  const episodes = series.episodeCount > 0 ? t.series.episodeCount.replace("{n}", String(series.episodeCount)) : null;

  return (
    <PressableScale
      onPress={() => onPress(series)}
      dimOnPress
      accessibilityLabel={posterLabel(t, series.title, {
        year: series.releaseYear,
        rating: series.rating,
        accessType: series.accessType,
        extra: episodes,
        isNew,
      })}
      style={{ width }}
    >
      <View style={[styles.poster, { height: Math.round(width * POSTER_RATIO) }]}>
        <PosterArt
          url={series.posterUrl ?? series.coverUrl}
          accessType={series.accessType}
          fallbackIcon="tv-outline"
          drawnSeed={drawnFallback ? series.id : undefined}
          isNew={isNew}
        />
      </View>
      <CellTitle>{series.title}</CellTitle>
      <View style={styles.seriesMeta}>
        <RatingYear rating={series.rating} year={series.releaseYear} />
      </View>
      {episodes ? (
        <ThemedText variant="label" weight="regular" tabular color={theme.colors.textFaint} style={styles.metaText}>
          {episodes}
        </ThemedText>
      ) : null}
    </PressableScale>
  );
});

/** A loading cell in the real cell's shape, so nothing jumps when data lands. */
export function PosterCellSkeleton({ width }: { width: number }) {
  return (
    <View style={{ width }}>
      <Skeleton width={width} height={Math.round(width * POSTER_RATIO)} radius="card" />
      <Skeleton width="64%" height={12} radius="xs" style={styles.skeletonLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  poster: {
    width: "100%",
    borderRadius: theme.radius.card,
    overflow: "hidden",
    backgroundColor: theme.colors.skeleton,
  },
  fallback: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  crown: {
    position: "absolute",
    top: 7,
    left: 7,
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: theme.colors.artBadge,
    alignItems: "center",
    justifyContent: "center",
  },
  /** MediaCard's NEW tab: a crimson tab flush with the left edge, square on that side. */
  newTab: {
    position: "absolute",
    left: 0,
    top: 10,
    minHeight: 20,
    paddingHorizontal: 7,
    justifyContent: "center",
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  /** Under the 22pt crown (top 7) with the same 7pt of air. */
  newTabBelowCrown: { top: 36 },
  newTabText: { fontSize: 10 },
  /** A full 44pt target in the poster's corner; the visible disc is 30pt. */
  playTarget: {
    position: "absolute",
    top: 0,
    right: 0,
    width: TOUCH,
    height: TOUCH,
    alignItems: "center",
    justifyContent: "center",
  },
  playDisc: {
    width: PLAY_DISC,
    height: PLAY_DISC,
    borderRadius: PLAY_DISC / 2,
    backgroundColor: "rgba(8,8,11,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  /** The play triangle's optical centre sits right of its box. */
  playGlyph: { marginLeft: 2 },
  title: { marginTop: theme.spacing.sm },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: BOOKMARK_BOX,
  },
  /** A row, so RatingYear's `flex: 1` spans the cell's width rather than collapsing vertically. */
  seriesMeta: { flexDirection: "row", alignItems: "center", minHeight: 20 },
  ratingYear: { flex: 1, minWidth: 0 },
  metaText: { fontSize: 12, letterSpacing: 0 },
  /** Pulled into the cell's edge so the glyph lines up with the poster's right side. */
  bookmark: {
    width: BOOKMARK_BOX,
    height: BOOKMARK_BOX,
    marginRight: -8,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.6 },
  skeletonLine: { marginTop: 12 },
});
