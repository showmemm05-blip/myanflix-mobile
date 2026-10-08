import type { GameId } from "@/data/games";

/**
 * THE ARCADE'S ARTWORK (Marquee, Main.dc.html). Games carry no image URLs —
 * the storefront is drawn on the phone so it renders in airplane mode and
 * never fetches art from a host it does not control. Each game gets one small
 * scene: a flat sky, a glowing sun, and two silhouette layers (a mid ridge and
 * a dark foreground) in one of three landscapes.
 *
 * Keyed by GameId, so a game cannot ship without its scene (a compile error,
 * not a blank tile). The numbers are the approved board's, verbatim.
 */

export type SceneKind = "city" | "peaks" | "figure";

export interface ArcadeScene {
  /** Sky. */
  bg: string;
  /** The sun / glow disc. */
  glow: string;
  /** The far silhouette. */
  mid: string;
  /** The near silhouette. */
  dark: string;
  kind: SceneKind;
  /** Sun position + radius on the 2:3 POSTER stage (120×180). */
  mx: number;
  my: number;
  mr: number;
  /** Sun position + radius on the 16:9 LANDSCAPE stage (240×135). */
  wx: number;
  wy: number;
  wr: number;
  /** Sun x on the HERO stage (390×560); its y and size are fixed there. */
  hx: number;
  /** Extra star points on the landscape stage — only the night-market game has them. */
  stars?: readonly (readonly [x: number, y: number, r: number])[];
}

export const ARCADE_SCENES: Record<GameId, ArcadeScene> = {
  "game-lacquer-city": { bg: "#1E1640", glow: "#E0409A", mid: "#33246B", dark: "#0E0A1F", kind: "city", mx: 84, my: 44, mr: 16, wx: 176, wy: 36, wr: 20, hx: 290 },
  "game-monsoon-run": { bg: "#0C2A3A", glow: "#1FB6A6", mid: "#163E66", dark: "#061520", kind: "figure", mx: 36, my: 46, mr: 14, wx: 60, wy: 38, wr: 20, hx: 110 },
  "game-the-long-quiet": { bg: "#17241B", glow: "#93A696", mid: "#26402E", dark: "#0A110C", kind: "city", mx: 80, my: 40, mr: 12, wx: 190, wy: 34, wr: 16, hx: 300 },
  "game-teahouse-letters": { bg: "#2E1D0E", glow: "#C98B3F", mid: "#4A2F16", dark: "#150D05", kind: "figure", mx: 40, my: 50, mr: 18, wx: 70, wy: 40, wr: 22, hx: 110 },
  "game-orbital-ferry": { bg: "#12143A", glow: "#3FD0E0", mid: "#2B2E8F", dark: "#080924", kind: "peaks", mx: 86, my: 42, mr: 15, wx: 186, wy: 34, wr: 18, hx: 280 },
  "game-the-ninth-floor": { bg: "#1A1D33", glow: "#8CA5D9", mid: "#3A2E63", dark: "#0C0A18", kind: "city", mx: 34, my: 44, mr: 12, wx: 56, wy: 34, wr: 16, hx: 110 },
  "game-shwe-market-tycoon": { bg: "#13291D", glow: "#E0B23F", mid: "#1F5A38", dark: "#08140D", kind: "city", mx: 82, my: 48, mr: 16, wx: 180, wy: 38, wr: 20, hx: 290 },
  "game-emberfall": { bg: "#2E0F14", glow: "#E06A2B", mid: "#5A1A26", dark: "#14060A", kind: "peaks", mx: 60, my: 50, mr: 20, wx: 120, wy: 40, wr: 22, hx: 200 },
  "game-delta-drift": { bg: "#0E2238", glow: "#A6E04C", mid: "#1D4A7A", dark: "#06111D", kind: "peaks", mx: 30, my: 44, mr: 12, wx: 52, wy: 32, wr: 16, hx: 100 },
  "game-paper-tigers": { bg: "#2A1512", glow: "#D6C6A3", mid: "#6E2620", dark: "#120806", kind: "peaks", mx: 84, my: 46, mr: 14, wx: 184, wy: 36, wr: 18, hx: 290 },
  "game-starlit-bazaar": {
    bg: "#1E1638",
    glow: "#E0C46A",
    mid: "#3A2A6B",
    dark: "#0D0A1C",
    kind: "city",
    mx: 70,
    my: 40,
    mr: 10,
    wx: 150,
    wy: 32,
    wr: 12,
    hx: 280,
    stars: [
      [60, 26, 2],
      [92, 18, 1.5],
      [200, 22, 2],
    ],
  },
  "game-signal-thirty": { bg: "#1A1D26", glow: "#E04C4C", mid: "#3C4456", dark: "#0B0D12", kind: "city", mx: 40, my: 46, mr: 14, wx: 64, wy: 36, wr: 18, hx: 110 },
};

/** [far, near] silhouettes on the 2:3 poster stage (120×180). */
export const POSTER_PATHS: Record<SceneKind, readonly [string, string]> = {
  peaks: ["M0 120 L28 92 L50 108 L80 76 L104 100 L120 90 V180 H0 Z", "M0 150 C30 140 60 146 90 136 C104 132 114 134 120 132 V180 H0 Z"],
  city: [
    "M0 124 L30 100 L54 114 L84 88 L120 108 V180 H0 Z",
    "M0 140 h10 v-14 h8 v8 h8 v-22 h10 v16 h8 v-8 h10 v14 h8 v-28 h12 v20 h8 v-6 h10 v16 h10 v-10 h8 V180 H0 Z",
  ],
  figure: [
    "M0 128 C30 118 60 124 90 114 C104 110 114 112 120 110 V180 H0 Z",
    "M0 150 H120 V180 H0 Z M57 150 l2-24 h-4 l1-10 c0-4 2-6 4-6 c2 0 4 2 4 6 l1 10 h-4 l2 24 z M60 106 a5 5 0 1 0 0.1 0 z",
  ],
};

/** [far, near] silhouettes on the 16:9 landscape stage (240×135). */
export const LANDSCAPE_PATHS: Record<SceneKind, readonly [string, string]> = {
  city: [
    "M0 96 L40 70 L70 86 L110 56 L150 84 L182 66 L240 88 V135 H0 Z",
    "M0 112 h20 v-16 h14 v10 h12 v-24 h16 v18 h14 v-10 h16 v16 h14 v-30 h18 v22 h14 v-6 h16 v20 h18 v-12 h14 V135 H0 Z",
  ],
  peaks: ["M0 90 L36 62 L64 80 L104 44 L140 76 L176 58 L240 84 V135 H0 Z", "M0 112 C60 102 120 110 180 98 C206 94 226 96 240 94 V135 H0 Z"],
  figure: [
    "M0 98 C60 88 120 96 180 84 C206 80 226 82 240 80 V135 H0 Z",
    "M0 116 H240 V135 H0 Z M176 116 l3-34 h-6 l2-14 c0-6 3-9 6-9 c3 0 6 3 6 9 l2 14 h-6 l3 34 z M175 52 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 z",
  ],
};

/** [far, near] silhouettes on the hero stage (390×560). */
export const HERO_PATHS: Record<SceneKind, readonly [string, string]> = {
  city: [
    "M0 380 L100 310 L170 350 L270 270 L390 330 V560 H0 Z",
    "M0 440 h30 v-44 h26 v24 h26 v-66 h32 v48 h26 v-24 h32 v42 h26 v-84 h38 v60 h26 v-18 h32 v48 h32 v-30 h38 v20 h26 V560 H0 Z",
  ],
  peaks: ["M0 370 L90 280 L160 330 L250 230 L330 310 L390 270 V560 H0 Z", "M0 460 C90 430 190 450 280 420 C330 406 370 410 390 406 V560 H0 Z"],
  figure: [
    "M0 390 C90 360 190 382 280 352 C330 336 370 342 390 334 V560 H0 Z",
    "M0 470 H390 V560 H0 Z M262 470 l5-70 h-11 l3-28 c0-12 5-17 11-17 c6 0 11 5 11 17 l3 28 h-11 l5 70 z M257 340 a13 13 0 1 0 26 0 a13 13 0 1 0 -26 0 z",
  ],
};
