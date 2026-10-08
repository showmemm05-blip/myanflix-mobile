import { BROWSE_STALE_TIME_MS } from "@/hooks/useMovies";
import { LIST_PAGE_SIZE } from "@/hooks/pagination";
import { isWatched, percentOf } from "@/components/library/historyFormat";
import type { Movie, MovieQuery } from "@/types/movie";
import type { SeriesListItem, SeriesQuery } from "@/types/series";
import type { WatchHistoryEntry } from "@/types/video";

/**
 * HOME'S DATA RULES (owner, 2026-10-08: Home is movies, series and books —
 * HomeMovies.dc.html). Pure helpers and the query spellings; the hooks that
 * ask the server live in HomeRows.tsx and the Home screen.
 *
 * Only endpoints the app already calls — GET /movies, GET /series, GET
 * /books and the watch history — one request per row, each kept for five
 * minutes (BROWSE_OPTIONS), and never asked for while a row is hidden (a
 * guest never calls /books or the history). The hero costs nothing extra:
 * it is cut from the "Recently added" and "New series" pages.
 *
 * The showcase (2026-10-08) adds exactly ONE request: GET /api/home/showcase
 * (hooks/useHomeShowcase — the hero promos, the spotlight, coming soon and
 * the Home settings, kept five minutes). The Premium band reads the plans
 * and the subscription the app already asks for (signed in only), and the
 * books band shares the "New on the shelf" row's GET /books.
 */

/** The rows' freshness window — the Media hubs' (CatalogListOptions explains). */
export const BROWSE_OPTIONS = { staleTime: BROWSE_STALE_TIME_MS } as const;
/** Every row shows ten (the Top 10 exactly ten). */
export const HOME_ROW_LIMIT = 10;
/** The hero rotates through five. */
export const HOME_HERO_COUNT = 5;

/**
 * ONE request feeds the hero's movies and "Recently added": the first page
 * of the newest movies, spelled exactly as the Movies hub's newest query
 * (MoviesHubContent NEWEST_QUERY — the server's default sort, so no `sort`
 * is sent) — so the Media tab later opens on the very same cache entry.
 */
export const NEWEST_MOVIES_QUERY: MovieQuery = { limit: LIST_PAGE_SIZE };
/** The same for series — the Series hub's BASE_QUERY. */
export const NEWEST_SERIES_QUERY: SeriesQuery = { limit: LIST_PAGE_SIZE };
/** The history page both signed-in rows read — Profile's "Your library" key, so it is shared. */
export const HISTORY_QUERY = { limit: LIST_PAGE_SIZE } as const;

/**
 * Continue watching: started, not finished. A title played to 95% or more
 * counts as watched (historyFormat's rule, the player's resume line) and a
 * bare 0% has nothing to continue. The API answers most recent first.
 */
export function continueWatching(entries: readonly WatchHistoryEntry[]): WatchHistoryEntry[] {
  return entries.filter((entry) => percentOf(entry) > 0 && !isWatched(entry));
}

/** One hero pick: a movie or a series, in one list sorted newest first. */
export type HeroPick = { kind: "movie"; movie: Movie } | { kind: "series"; series: SeriesListItem };

function addedAt(pick: HeroPick): number {
  const stamp = Date.parse(pick.kind === "movie" ? pick.movie.createdAt : pick.series.createdAt);
  return Number.isFinite(stamp) ? stamp : 0;
}

/**
 * The hero's rotation: the newest PUBLISHED movies and series, mixed, newest
 * first, five at most (the owner's rule — a title with no picture is still
 * featured, over its drawn HubFallbackArt). A series with no episode yet
 * has nothing for Play to open, so it is left out, as the Series hub does.
 */
export function heroPicks(movies: readonly Movie[], series: readonly SeriesListItem[]): HeroPick[] {
  const picks: HeroPick[] = [
    ...movies.map((movie): HeroPick => ({ kind: "movie", movie })),
    ...series.filter((item) => item.episodeCount > 0).map((item): HeroPick => ({ kind: "series", series: item })),
  ];
  return picks.sort((a, b) => addedAt(b) - addedAt(a)).slice(0, HOME_HERO_COUNT);
}

/** Where "Because you watched" looks: the title's first category, or its genre. */
export type BecausePick = { kind: "category"; id: string; name: string } | { kind: "genre"; name: string };

export function becausePickOf(movie: Movie | null | undefined): BecausePick | null {
  if (!movie) return null;
  const category = movie.categories?.[0];
  if (category) return { kind: "category", id: category.id, name: category.name };
  if (movie.genre) return { kind: "genre", name: movie.genre };
  return null;
}

/** The row's query for a pick: one more than the row shows, so the watched title can be left out. */
export function becauseQueryOf(pick: BecausePick): MovieQuery {
  return pick.kind === "category"
    ? { categoryId: pick.id, limit: HOME_ROW_LIMIT + 1 }
    : { genres: [pick.name], limit: HOME_ROW_LIMIT + 1 };
}

/** A release year, or nothing for the backend's 0. */
export function yearOf(item: { releaseYear: number }): number | null {
  return item.releaseYear > 0 ? item.releaseYear : null;
}

/* ------------------------------------------------------------------ */
/* The showcase (owner, 2026-10-08: HomeMobile.dc.html)                 */
/* ------------------------------------------------------------------ */

/**
 * The hero carries the five featured titles and, between them, the live
 * HERO promos from the admin "Home promos" page — at most this many, in the
 * team's order, so the carousel stays a carousel (every slide is mounted).
 */
export const HOME_HERO_MAX_PROMOS = 7;

/**
 * Title, promo, title, promo… — whatever is left of the longer list follows
 * at the end. No titles (an empty catalogue): the promos alone.
 */
export function interleave<A, B>(titles: readonly A[], promos: readonly B[]): Array<A | B> {
  const out: Array<A | B> = [];
  const n = Math.max(titles.length, promos.length);
  for (let i = 0; i < n; i += 1) {
    if (i < titles.length) out.push(titles[i]);
    if (i < promos.length) out.push(promos[i]);
  }
  return out;
}

/**
 * A promo field in the reader's language: the Burmese half for "mm", the
 * English half otherwise — and the other half when the one asked for is
 * empty (the admin requires both, but a blank must never show as nothing).
 */
export function promoText(language: string, en: string | null | undefined, mm: string | null | undefined): string | null {
  const first = language === "mm" ? mm : en;
  const second = language === "mm" ? en : mm;
  const pick = first?.trim() ? first : second;
  return pick?.trim() ? pick.trim() : null;
}

/** Only an http(s) address is ever opened from Home (the admin requires it too). */
export function isWebUrl(url: string | null | undefined): url is string {
  return !!url && /^https?:\/\//i.test(url.trim());
}

/** "myanflix.com" from "https://www.myanflix.com/" — what the web card prints. */
export function displayAddress(url: string): string {
  return url
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "");
}

/** The plan fields the Premium band reads. */
export interface PlanLike {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  isActive: boolean;
}

/** The plans to show: the active ones, shortest first (the server answers oldest first). */
export function visiblePlans<P extends PlanLike>(plans: readonly P[] | undefined): P[] {
  return (plans ?? [])
    .filter((plan) => plan.isActive && plan.durationDays > 0)
    .sort((a, b) => a.durationDays - b.durationDays || a.price - b.price);
}

/** BEST VALUE goes on the longest plan — only when there is more than one to compare. */
export function bestValuePlanId(plans: readonly PlanLike[]): string | null {
  if (plans.length < 2) return null;
  return plans.reduce((best, plan) => (plan.durationDays > best.durationDays ? plan : best)).id;
}

/** Price per day, rounded; `exact` is false when it does not divide evenly ("about 333 Ks a day"). */
export function perDay(plan: PlanLike): { amount: number; exact: boolean } {
  const raw = plan.price / plan.durationDays;
  return { amount: Math.round(raw), exact: Number.isInteger(raw) };
}

/**
 * The two ways to add money, as the value strip and the Premium band name
 * them (owner, 2026-10-08: KBZPay and WavePay only). The dot colours are the board's chip marks.
 */
export const PAY_METHODS = [
  { name: "KBZPay", dot: "#4DB3FF" },
  { name: "WavePay", dot: "#F5C451" },
] as const;
