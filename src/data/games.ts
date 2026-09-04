import type { TranslationShape } from "@/localization/translations";

/**
 * THE GAMES SHELF — ported from userwebsite/lib/media/games-data.ts, shaped
 * exactly like the future `GET /games` payload so the swap to a real service
 * is mechanical. Mobile carries NO artwork URLs at all: every plate is drawn
 * locally by `components/common/GamePlate` from PLATE_PALETTES below, so the
 * storefront renders fully in airplane mode and never rents artwork from a
 * host it does not control.
 *
 * Nothing outside `src/data/arcade.ts` may read GAMES — the selectors there
 * are the only consumer, so a games API someday replaces one file.
 *
 * Titles, studios, genres and platform tags stay Latin in BOTH languages;
 * only the descriptions (in t.arcade.gameCopy) translate.
 */

/**
 * A game id doubles as its copy key: `mm satisfies typeof en` on the
 * translation files means a game cannot exist without BOTH languages
 * carrying its description.
 */
export type GameId = keyof TranslationShape["arcade"]["gameCopy"];

export type GamePlatform = "PC" | "Mobile" | "Browser";

export type GameBadge = "live" | "new" | "trending" | "limited" | "comingSoon" | null;

export type GameEventKey = "seasonUpdate" | "multiplayerEvent";

export interface Game {
  id: GameId;
  title: string;
  studio: string;
  releaseYear: number;
  /** Catalogue-taxonomy word, stays Latin in both languages. */
  genre: string;
  createdAt: string;
  /** Points into t.arcade.gameCopy — always equal to `id`. */
  descriptionKey: GameId;
  platforms: GamePlatform[];
  /** null = free to play — UNLESS badge === "comingSoon" (unpriced, not free). */
  priceMMK: number | null;
  rating: number | null;
  badge: GameBadge;
  /** Static editorial figure — never ticks, never animates. */
  playersOnline: number | null;
  eventKey: GameEventKey | null;
}

export const GAMES: Game[] = [
  {
    id: "game-lacquer-city",
    title: "Lacquer City",
    studio: "Bagan Interactive",
    releaseYear: 2026,
    genre: "Adventure",
    createdAt: "2026-08-19T09:00:00.000Z",
    descriptionKey: "game-lacquer-city",
    platforms: ["PC", "Mobile"],
    priceMMK: 12800,
    rating: 8.6,
    badge: "new",
    playersOnline: 3200,
    eventKey: null,
  },
  {
    id: "game-monsoon-run",
    title: "Monsoon Run",
    studio: "Third Bridge Studio",
    releaseYear: 2026,
    genre: "Action",
    createdAt: "2026-07-02T09:00:00.000Z",
    descriptionKey: "game-monsoon-run",
    platforms: ["PC", "Mobile", "Browser"],
    priceMMK: null,
    rating: 8.1,
    badge: "live",
    playersOnline: 12400,
    eventKey: null,
  },
  {
    id: "game-the-long-quiet",
    title: "The Long Quiet",
    studio: "Nightferry",
    releaseYear: 2025,
    genre: "Horror",
    createdAt: "2025-11-14T09:00:00.000Z",
    descriptionKey: "game-the-long-quiet",
    platforms: ["PC"],
    priceMMK: 15500,
    rating: 9.0,
    badge: "trending",
    playersOnline: 5600,
    eventKey: null,
  },
  {
    id: "game-teahouse-letters",
    title: "Teahouse Letters",
    studio: "Paper Lantern Works",
    releaseYear: 2025,
    genre: "Drama",
    createdAt: "2025-09-30T09:00:00.000Z",
    descriptionKey: "game-teahouse-letters",
    platforms: ["Mobile", "Browser"],
    priceMMK: 9900,
    rating: 8.8,
    badge: null,
    playersOnline: null,
    eventKey: null,
  },
  {
    id: "game-orbital-ferry",
    title: "Orbital Ferry",
    studio: "Cold Harbour Games",
    releaseYear: 2025,
    genre: "Sci-Fi",
    createdAt: "2025-06-11T09:00:00.000Z",
    descriptionKey: "game-orbital-ferry",
    platforms: ["PC"],
    priceMMK: 18000,
    rating: 7.9,
    badge: "limited",
    playersOnline: 2100,
    eventKey: "seasonUpdate",
  },
  {
    id: "game-the-ninth-floor",
    title: "The Ninth Floor",
    studio: "Two Rivers Collective",
    releaseYear: 2024,
    genre: "Mystery",
    createdAt: "2024-12-05T09:00:00.000Z",
    descriptionKey: "game-the-ninth-floor",
    platforms: ["PC", "Mobile"],
    priceMMK: 11000,
    rating: 8.3,
    badge: null,
    playersOnline: null,
    eventKey: null,
  },
  {
    id: "game-shwe-market-tycoon",
    title: "Shwe Market",
    studio: "Yangon Playworks",
    releaseYear: 2024,
    genre: "Family",
    createdAt: "2024-08-22T09:00:00.000Z",
    descriptionKey: "game-shwe-market-tycoon",
    platforms: ["Mobile", "Browser"],
    priceMMK: null,
    rating: 7.6,
    badge: "live",
    playersOnline: 8900,
    eventKey: "multiplayerEvent",
  },
  {
    id: "game-emberfall",
    title: "Emberfall",
    studio: "Sule Forge",
    releaseYear: 2023,
    genre: "Fantasy",
    createdAt: "2023-10-17T09:00:00.000Z",
    descriptionKey: "game-emberfall",
    platforms: ["PC"],
    priceMMK: 14000,
    rating: 8.9,
    badge: "trending",
    playersOnline: 7400,
    eventKey: null,
  },
  {
    id: "game-delta-drift",
    title: "Delta Drift",
    studio: "Ayeyarwady Softworks",
    releaseYear: 2026,
    genre: "Crime",
    createdAt: "2026-05-08T09:00:00.000Z",
    descriptionKey: "game-delta-drift",
    platforms: ["PC", "Mobile"],
    priceMMK: null,
    rating: 7.8,
    badge: "live",
    playersOnline: 15600,
    eventKey: "multiplayerEvent",
  },
  {
    id: "game-paper-tigers",
    title: "Paper Tigers",
    studio: "Hinthar Play",
    releaseYear: 2025,
    genre: "History",
    createdAt: "2025-03-21T09:00:00.000Z",
    descriptionKey: "game-paper-tigers",
    platforms: ["PC", "Browser"],
    priceMMK: 13500,
    rating: 8.4,
    badge: null,
    playersOnline: null,
    eventKey: null,
  },
  {
    id: "game-starlit-bazaar",
    title: "Starlit Bazaar",
    studio: "Moe Kaung Studio",
    releaseYear: 2027,
    genre: "Romance",
    createdAt: "2026-08-28T09:00:00.000Z",
    descriptionKey: "game-starlit-bazaar",
    platforms: ["PC", "Mobile"],
    priceMMK: null,
    rating: null,
    badge: "comingSoon",
    playersOnline: null,
    eventKey: null,
  },
  {
    id: "game-signal-thirty",
    title: "Signal Thirty",
    studio: "Mandalay Arcade",
    releaseYear: 2026,
    genre: "Thriller",
    createdAt: "2026-06-14T09:00:00.000Z",
    descriptionKey: "game-signal-thirty",
    platforms: ["Browser"],
    priceMMK: 8800,
    rating: 8.0,
    badge: null,
    playersOnline: null,
    eventKey: null,
  },
];

/** The two hues GamePlate paints a game's identity from. */
export interface PlatePalette {
  hueA: string;
  hueB: string;
}

/** Deep near-black navy every plate sits on — matches the web SVG plates. */
export const PLATE_BASE = "#0b0d16";

/**
 * Per-game two-hue palettes — the mobile equivalent of the web's per-genre
 * SVG plates. Keyed by GameId so a new game cannot ship without a palette.
 */
export const PLATE_PALETTES: Record<GameId, PlatePalette> = {
  "game-lacquer-city": { hueA: "#7c5cff", hueB: "#e0409a" },
  "game-monsoon-run": { hueA: "#1fb6a6", hueB: "#1f4fb6" },
  "game-the-long-quiet": { hueA: "#26402e", hueB: "#93a696" },
  "game-teahouse-letters": { hueA: "#c98b3f", hueB: "#7a4b26" },
  "game-orbital-ferry": { hueA: "#3fd0e0", hueB: "#2b2e8f" },
  "game-the-ninth-floor": { hueA: "#5c7ba6", hueB: "#6a4a9e" },
  "game-shwe-market-tycoon": { hueA: "#e0b23f", hueB: "#2f9e5f" },
  "game-emberfall": { hueA: "#e06a2b", hueB: "#a3203c" },
  "game-delta-drift": { hueA: "#3f8fe0", hueB: "#a6e04c" },
  "game-paper-tigers": { hueA: "#d6c6a3", hueB: "#b03a30" },
  "game-starlit-bazaar": { hueA: "#8f6ae0", hueB: "#e0c46a" },
  "game-signal-thirty": { hueA: "#e04c4c", hueB: "#3c4456" },
};

/**
 * "12,800 Ks" — manual thousands separator rather than `toLocaleString`,
 * whose grouping varies with the Hermes ICU build. Slug-voice only (mono,
 * Latin digits). NOTE: `src/utils/currency.ts` has a wallet-side formatKyat
 * built on toLocaleString — kept untouched; the storefront deliberately uses
 * this deterministic one.
 */
export function formatKyat(amount: number): string {
  return `${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")} Ks`;
}

/** "12.4K" / "1.2M" — trimmed one-decimal compact count for playersOnline figures. */
export function formatCompactCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(count);
}
