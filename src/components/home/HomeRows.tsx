import { memo, useMemo } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { HubRow, type HubRowItem, type HubRowVariant } from "@/components/hub/HubRow";
import { HUB_SECTION_GAP } from "@/components/hub/hubLayout";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { isRecentlyAdded } from "@/components/movie/mediaItems";
import { historyA11yLabel, historyStatusLine, percentOf } from "@/components/library/historyFormat";
import {
  BROWSE_OPTIONS,
  HISTORY_QUERY,
  HOME_ROW_LIMIT,
  becausePickOf,
  becauseQueryOf,
  continueWatching,
  yearOf,
} from "@/components/home/homeData";
import { useBooksList } from "@/hooks/useBooks";
import { useMovie, useMovies } from "@/hooks/useMovies";
import { useWatchHistoryInfinite } from "@/hooks/useVideo";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatDuration } from "@/utils/format";
import type { MovieFilters } from "@/components/search/filters";
import type { Book } from "@/types/book";
import type { Movie, MovieQuery } from "@/types/movie";
import type { SeriesListItem } from "@/types/series";

/**
 * Where Home's rows send the user. Built once by the Home screen (memoized)
 * so every row's cards keep their identity across re-renders.
 */
export interface HomeRowActions {
  openMovie: (movie: Pick<Movie, "id">) => void;
  /** Continue watching: straight into the player, which resumes the title. */
  playMovie: (movieId: string) => void;
  openSeries: (series: Pick<SeriesListItem, "id">) => void;
  openBook: (book: Pick<Book, "id">) => void;
  /** The Media tab's Movies chip — browse with no patch, or its results view with one (a sort, a genre, a category). */
  seeAllMovies: (patch: Partial<MovieFilters>) => void;
  seeAllSeries: () => void;
  seeAllBooks: () => void;
  /** Profile → Watch history. */
  seeAllHistory: () => void;
}

interface RowStyleProps {
  /** The first row under the hero carries less air above it. */
  first?: boolean;
}

function rowStyle(first: boolean | undefined): StyleProp<ViewStyle> {
  return first ? styles.firstRow : styles.row;
}

/* ------------------------------------------------------------------ */
/* Continue watching (signed-in only)                                   */
/* ------------------------------------------------------------------ */

/**
 * The row's entries: the first page of the watch history (Profile's own key,
 * so one request serves both), kept to what is started and not finished.
 * `enabled: false` (a guest) asks for nothing.
 */
function useContinueWatchingEntries(enabled: boolean) {
  const query = useWatchHistoryInfinite(HISTORY_QUERY, { ...BROWSE_OPTIONS, enabled });
  const page = query.data?.pages[0]?.items;
  const entries = useMemo(() => continueWatching(page ?? []).slice(0, HOME_ROW_LIMIT), [page]);
  return { entries, loading: query.isLoading };
}

/**
 * Whether the Home screen should list the Continue watching row at all:
 * yes while its history is still loading (so its placeholders show) and once
 * it has something to resume; no for a guest, with nothing part-watched, or
 * after a failed request. The screen builds its row list from this, so the
 * row under a hidden Continue watching knows it is the first under the hero
 * and takes the first row's smaller gap, not the section gap.
 */
export function useContinueWatchingPresent(enabled: boolean): boolean {
  const { entries, loading } = useContinueWatchingEntries(enabled);
  return enabled && (loading || entries.length > 0);
}

/**
 * Wide 16:9 cards with the crimson progress line and "62% · 47m left" under
 * each, from the viewer's watch history (useContinueWatchingEntries). Hidden
 * while the viewer has nothing part-watched, and on a failed request. Its
 * "See all" is Profile's Watch history.
 */
export const ContinueWatchingRow = memo(function ContinueWatchingRow({
  actions,
  first,
}: RowStyleProps & { actions: HomeRowActions }) {
  const { t } = useLanguage();
  const { entries, loading } = useContinueWatchingEntries(true);
  const items = useMemo<HubRowItem[]>(
    () =>
      entries.map((entry) => ({
        key: entry.id,
        title: entry.movieTitle,
        // The history carries the poster only; the 16:9 frame crops it.
        imageUrl: entry.posterUrl,
        progress: percentOf(entry),
        meta: [historyStatusLine(entry, t)],
        accessibilityLabel: historyA11yLabel(entry, t),
        onPress: () => actions.playMovie(entry.movieId),
      })),
    [entries, t, actions],
  );
  return (
    <HubRow
      style={rowStyle(first)}
      variant="landscape"
      title={t.library.continueWatching}
      items={items}
      loading={loading}
      onSeeAll={actions.seeAllHistory}
    />
  );
});

/* ------------------------------------------------------------------ */
/* Recently added / New series — cut from the hero's pages              */
/* ------------------------------------------------------------------ */

/** The newest movies, wide, with the NEW tab for the last 14 days (the first page the hero already holds). */
export const RecentlyAddedRow = memo(function RecentlyAddedRow({
  movies,
  loading,
  actions,
  first,
}: RowStyleProps & { movies: readonly Movie[] | undefined; loading: boolean; actions: HomeRowActions }) {
  const { t } = useLanguage();
  const items = useMemo<HubRowItem[]>(
    () =>
      (movies ?? []).slice(0, HOME_ROW_LIMIT).map((movie) => ({
        key: movie.id,
        title: movie.title,
        // A 16:9 frame: the landscape cover first.
        imageUrl: movie.coverUrl ?? movie.posterUrl,
        accessType: movie.accessType,
        isNew: isRecentlyAdded(movie.createdAt),
        meta: [movie.genre || null, yearOf(movie), formatDuration(movie.duration)],
        onPress: () => actions.openMovie(movie),
      })),
    [movies, actions],
  );
  return (
    <HubRow
      style={rowStyle(first)}
      variant="landscape"
      title={t.browse.recentlyAdded}
      items={items}
      loading={loading}
      // Recently added is the catalogue's default order: its See all is every movie.
      onSeeAll={() => actions.seeAllMovies({})}
    />
  );
});

/** The newest series as posters, "{n} episodes" under each. */
export const NewSeriesRow = memo(function NewSeriesRow({
  series,
  loading,
  actions,
  first,
}: RowStyleProps & { series: readonly SeriesListItem[] | undefined; loading: boolean; actions: HomeRowActions }) {
  const { t } = useLanguage();
  const items = useMemo<HubRowItem[]>(
    () =>
      (series ?? []).slice(0, HOME_ROW_LIMIT).map((item) => ({
        key: item.id,
        title: item.title,
        imageUrl: item.posterUrl ?? item.coverUrl,
        accessType: item.accessType,
        isNew: isRecentlyAdded(item.createdAt),
        meta: [
          yearOf(item),
          item.episodeCount === 1 ? t.hubs.series.episodesOne : t.hubs.series.episodes.replace("{n}", String(item.episodeCount)),
        ],
        onPress: () => actions.openSeries(item),
      })),
    [series, t, actions],
  );
  return (
    <HubRow
      style={rowStyle(first)}
      variant="poster"
      title={t.hubs.series.newSeries}
      items={items}
      loading={loading}
      onSeeAll={actions.seeAllSeries}
    />
  );
});

/* ------------------------------------------------------------------ */
/* New on the shelf (signed-in only)                                    */
/* ------------------------------------------------------------------ */

/**
 * The newest books (GET /books answers newest first and is members-only, so
 * a guest never asks). Covers with the author under each; the board's
 * "Books" eyebrow over the heading.
 */
export const NewBooksRow = memo(function NewBooksRow({
  enabled,
  actions,
  first,
}: RowStyleProps & { enabled: boolean; actions: HomeRowActions }) {
  const { t } = useLanguage();
  const query = useBooksList({ limit: HOME_ROW_LIMIT }, { ...BROWSE_OPTIONS, enabled });
  const books = query.data?.items;
  const items = useMemo<HubRowItem[]>(
    () =>
      (books ?? []).slice(0, HOME_ROW_LIMIT).map((book) => ({
        key: book.id,
        title: book.title,
        imageUrl: book.coverUrl,
        byline: book.author,
        isNew: isRecentlyAdded(book.createdAt),
        meta: [book.categories[0]?.name ?? null],
        onPress: () => actions.openBook(book),
      })),
    [books, actions],
  );
  if (!enabled) return null;
  return (
    <HubRow
      style={rowStyle(first)}
      variant="cover"
      title={t.books.newOnShelf}
      items={items}
      loading={query.isLoading}
      header={
        <SectionHeader
          eyebrow={t.books.title}
          title={t.books.newOnShelf}
          titleLines={3}
          onSeeAll={actions.seeAllBooks}
          seeAllLabel={t.common.seeAll}
          seeAllTone="text"
        />
      }
    />
  );
});

/* ------------------------------------------------------------------ */
/* One movie row that asks for its own titles (Top 10, Top rated)       */
/* ------------------------------------------------------------------ */

export interface MovieRowSpec {
  title: string;
  variant: Extract<HubRowVariant, "poster" | "ranked">;
  query: MovieQuery;
  /** Each card shows its ★ rating (Top rated — whose query already leaves unrated titles out). */
  showRating?: boolean;
  /** The quiet line under each card. */
  meta: (movie: Movie) => HubRowItem["meta"];
  /** The Movies results view its See all opens. */
  seeAll: Partial<MovieFilters>;
}

/** Mounted (and so asking) only as the page brings it near the screen. */
export const MovieQueryRow = memo(function MovieQueryRow({
  spec,
  actions,
  first,
}: RowStyleProps & { spec: MovieRowSpec; actions: HomeRowActions }) {
  const query = useMovies(spec.query, BROWSE_OPTIONS);
  const movies = query.data?.items;
  const items = useMemo<HubRowItem[]>(
    () =>
      (movies ?? []).slice(0, HOME_ROW_LIMIT).map((movie) => ({
        key: movie.id,
        title: movie.title,
        imageUrl: movie.posterUrl ?? movie.coverUrl,
        accessType: movie.accessType,
        rating: spec.showRating && movie.rating > 0 ? movie.rating : null,
        isNew: spec.variant === "poster" && isRecentlyAdded(movie.createdAt),
        meta: spec.meta(movie),
        onPress: () => actions.openMovie(movie),
      })),
    [movies, spec, actions],
  );
  return (
    <HubRow
      style={rowStyle(first)}
      variant={spec.variant}
      title={spec.title}
      items={items}
      loading={query.isLoading}
      onSeeAll={() => actions.seeAllMovies(spec.seeAll)}
    />
  );
});

/* ------------------------------------------------------------------ */
/* Because you watched <title> (signed-in only)                         */
/* ------------------------------------------------------------------ */

/**
 * The viewer's most recently played title (the first row of the watch
 * history — the same page Continue watching reads, so no second request),
 * that title's own record (the ["movie", id] entry its page uses, so it is
 * often already cached), then one GET /movies in its first category — or
 * its genre when it has no category — with the title itself left out.
 * Hidden with no history, no category or genre to follow, nothing to show,
 * or a failed request.
 */
export const BecauseYouWatchedRow = memo(function BecauseYouWatchedRow({
  actions,
  first,
}: RowStyleProps & { actions: HomeRowActions }) {
  const { t } = useLanguage();
  const history = useWatchHistoryInfinite(HISTORY_QUERY, BROWSE_OPTIONS);
  const latest = history.data?.pages[0]?.items[0] ?? null;
  const watched = useMovie(latest?.movieId);
  const pick = useMemo(() => becausePickOf(watched.data), [watched.data]);
  const row = useMovies(pick ? becauseQueryOf(pick) : {}, { ...BROWSE_OPTIONS, enabled: pick !== null });
  const movies = row.data?.items;
  const watchedId = latest?.movieId;
  const items = useMemo<HubRowItem[]>(
    () =>
      (movies ?? [])
        .filter((movie) => movie.id !== watchedId)
        .slice(0, HOME_ROW_LIMIT)
        .map((movie) => ({
          key: movie.id,
          title: movie.title,
          imageUrl: movie.posterUrl ?? movie.coverUrl,
          accessType: movie.accessType,
          isNew: isRecentlyAdded(movie.createdAt),
          meta: [yearOf(movie), movie.genre || null],
          onPress: () => actions.openMovie(movie),
        })),
    [movies, watchedId, actions],
  );
  // Nothing until the watched title and its category are known: the row is
  // the last on the page, so it simply appears once there is a heading to give it.
  if (!latest || !pick) return null;
  return (
    <HubRow
      style={rowStyle(first)}
      variant="poster"
      title={t.home.becauseYouWatched.replace("{title}", latest.movieTitle)}
      subtitle={t.home.moreOf.replace("{name}", pick.name)}
      items={items}
      loading={row.isLoading}
      onSeeAll={() =>
        actions.seeAllMovies(pick.kind === "category" ? { categoryId: pick.id } : { genres: [pick.name] })
      }
    />
  );
});

const styles = StyleSheet.create({
  firstRow: { marginTop: 10 },
  row: { marginTop: HUB_SECTION_GAP },
});
