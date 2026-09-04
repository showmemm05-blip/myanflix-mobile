import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";
import { GAMES, type Game, type GameId } from "@/data/games";
import type { TranslationShape } from "@/localization/translations";

/**
 * THE ARCADE'S SELECTORS — the ONLY module that reads GAMES. Home sections
 * import their slices from here, never from games.ts, so the day a games API
 * ships this file is the whole swap. Every curated/derived pick throws AT
 * MODULE INIT when the shelf stops satisfying it (failure-fast, exactly like
 * the web's lib/home/store.ts): a broken storefront should fail the build,
 * not render a hole.
 */

function byId(id: GameId): Game {
  const game = GAMES.find((g) => g.id === id);
  if (!game) throw new Error(`Arcade: unknown game id "${id}"`);
  return game;
}

/** Free = unpriced AND actually released — a Coming Soon title is unpriced, not free. */
export function isFreeGame(game: Game): boolean {
  return game.priceMMK === null && game.badge !== "comingSoon";
}

/** Curated hero order — six slides, exactly the web's rotation. */
const HERO_ROTATION: GameId[] = [
  "game-lacquer-city",
  "game-monsoon-run",
  "game-the-long-quiet",
  "game-orbital-ferry",
  "game-emberfall",
  "game-delta-drift",
];

export const heroGames: Game[] = HERO_ROTATION.map(byId);

/** Curated featured shelf — four cards. */
export const featuredGames: Game[] = [
  byId("game-the-long-quiet"),
  byId("game-teahouse-letters"),
  byId("game-paper-tigers"),
  byId("game-the-ninth-floor"),
];

function newestBy(predicate: (g: Game) => boolean, label: string): Game {
  const picked = GAMES.filter(predicate).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!picked) throw new Error(`Arcade: no game satisfies the "${label}" promo`);
  return picked;
}

/**
 * The three promo banners' subjects, derived rather than hardcoded so a
 * shelf edit re-picks them. On today's shelf: Lacquer City / Starlit Bazaar /
 * Delta Drift / Orbital Ferry.
 */
export const promos = {
  /** Newest badge === "new" release. */
  newRelease: newestBy((g) => g.badge === "new", "newRelease"),
  /** The one Coming Soon row — NO CTA, no countdown, ever. */
  comingSoon: newestBy((g) => g.badge === "comingSoon", "comingSoon"),
  /** Busiest free-to-play title. */
  freeToPlay: (() => {
    const picked = GAMES.filter(isFreeGame).sort(
      (a, b) => (b.playersOnline ?? 0) - (a.playersOnline ?? 0),
    )[0];
    if (!picked) throw new Error(`Arcade: no game satisfies the "freeToPlay" promo`);
    return picked;
  })(),
  /** The limited-time event row. */
  limitedEvent: newestBy((g) => g.badge === "limited", "limitedEvent"),
} as const;

/**
 * Every game with a live player figure, busiest first, capped at 4.
 * The figures are static editorial copy — they never tick.
 */
export const liveNow: Game[] = GAMES.filter((g) => g.playersOnline !== null)
  .sort((a, b) => (b.playersOnline ?? 0) - (a.playersOnline ?? 0))
  .slice(0, 4);

/** The whole shelf, newest first — the discover rail. */
export const discoverGames: Game[] = [...GAMES].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/* ------------------------------------------------------------------ */
/* Lanes — the "beyond games" registry                                 */
/* ------------------------------------------------------------------ */

export type LaneId = keyof TranslationShape["arcade"]["lanes"];
export type LaneVerb = keyof TranslationShape["arcade"]["verbs"];
export type LaneState = "live" | "preview" | "announced";

export interface Lane {
  id: LaneId;
  state: LaneState;
  icon: ComponentProps<typeof Ionicons>["name"];
  /** Key into t.arcade.verbs — the lane's action word, resolved at render time. */
  verb: LaneVerb;
}

/**
 * Registry order is the render order. Names and verbs come from
 * t.arcade.lanes / t.arcade.verbs at render time — never stored here.
 */
export const LANES: Lane[] = [
  { id: "film", state: "live", icon: "film-outline", verb: "watch" },
  { id: "series", state: "live", icon: "tv-outline", verb: "watch" },
  { id: "book", state: "live", icon: "book-outline", verb: "read" },
  { id: "music", state: "preview", icon: "musical-notes-outline", verb: "listen" },
  { id: "game", state: "live", icon: "game-controller-outline", verb: "play" },
  { id: "anime", state: "announced", icon: "sparkles-outline", verb: "watch" },
  { id: "podcast", state: "announced", icon: "mic-outline", verb: "listen" },
  { id: "live", state: "announced", icon: "radio-outline", verb: "join" },
];

function lane(id: LaneId): Lane {
  const found = LANES.find((l) => l.id === id);
  if (!found) throw new Error(`Arcade: unknown lane "${id}"`);
  return found;
}

/** The Explore More strip — the four lanes a member can actually walk into. */
export const EXPLORE_LANES: Lane[] = [lane("film"), lane("series"), lane("book"), lane("music")];

/** Discover-section teasers — announced lanes only, non-pressable. */
export const ANNOUNCED_LANES: Lane[] = [lane("anime"), lane("podcast"), lane("live")];
