import { memo, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { LANDSCAPE_PATHS, POSTER_PATHS, type SceneKind } from "@/components/arcade/arcadeScenes";

/**
 * - `hero` — the hub hero's stage (the boards' 390 × 640).
 * - `poster` — a 2:3 card (120 × 180).
 * - `landscape` — a 16:9 card (240 × 135).
 */
export type HubFallbackFormat = "hero" | "poster" | "landscape";

interface Props {
  /**
   * What picks the scene — the record id (or, for the empty hero, the page's
   * kind). The same seed always draws the same picture, so a title keeps its
   * art across visits and the hero, its row card and its grid cell agree.
   */
  seed: string;
  format: HubFallbackFormat;
  /** Defaults to filling the parent (absolute fill). */
  style?: StyleProp<ViewStyle>;
}

/** One dark cinematic tone: sky, sun, far silhouette, near silhouette. */
interface Palette {
  bg: string;
  glow: string;
  mid: string;
  dark: string;
}

/**
 * The hub boards' title palettes (Main / Series / Books.dc.html sample data),
 * verbatim. Decorative artwork data, like the arcade's scenes — not UI
 * colour, so it lives here rather than in the theme.
 */
const PALETTES: readonly Palette[] = [
  { bg: "#1B2A3A", glow: "#E8A33D", mid: "#22374C", dark: "#0B1520" },
  { bg: "#0F2830", glow: "#7FD6C2", mid: "#164049", dark: "#06171B" },
  { bg: "#33200F", glow: "#F2A65A", mid: "#4A2F16", dark: "#150D05" },
  { bg: "#3A2A12", glow: "#E9B949", mid: "#4F3A18", dark: "#160F06" },
  { bg: "#191633", glow: "#C9C3F5", mid: "#262250", dark: "#0B0919" },
  { bg: "#232033", glow: "#B9A6FA", mid: "#322E47", dark: "#0F0D17" },
  { bg: "#2A1B3D", glow: "#F2B66D", mid: "#3B2752", dark: "#140C1E" },
  { bg: "#2E1420", glow: "#E86A5C", mid: "#43202F", dark: "#13070D" },
  { bg: "#10243F", glow: "#5AB8F0", mid: "#183459", dark: "#06101F" },
  { bg: "#1A2617", glow: "#A8C97F", mid: "#26361F", dark: "#0A1008" },
  { bg: "#12303A", glow: "#F5D06B", mid: "#1A4250", dark: "#06161B" },
  { bg: "#2B2B30", glow: "#D8D2C4", mid: "#3A3A41", dark: "#121215" },
];

const KINDS: readonly SceneKind[] = ["peaks", "city", "figure"];

/** [far, near] silhouettes on the hub hero's 390 × 640 stage (Main.dc.html `HERO`). */
const HERO_PATHS: Record<SceneKind, readonly [string, string]> = {
  peaks: [
    "M0 400 L90 320 L150 370 L240 280 L320 350 L390 310 V640 H0 Z",
    "M0 500 C100 470 200 488 300 462 C340 452 370 456 390 452 V640 H0 Z",
  ],
  city: [
    "M0 410 L100 350 L170 392 L260 320 L390 380 V640 H0 Z",
    "M0 470 h30 v-40 h24 v22 h22 v-64 h30 v46 h22 v-24 h28 v40 h22 v-80 h36 v58 h22 v-18 h30 v44 h28 v-28 h24 V640 H0 Z",
  ],
  figure: [
    "M0 420 C100 392 200 410 300 382 C340 372 370 376 390 372 V640 H0 Z",
    "M0 500 H390 V640 H0 Z M262 500 l6-74 h-12 l3-30 c0-12 5-18 12-18 c7 0 12 6 12 18 l3 30 h-12 l6 74 z M271 362 a14 14 0 1 0 0.1 0 z",
  ],
};

const VIEWBOX: Record<HubFallbackFormat, { w: number; h: number }> = {
  hero: { w: 390, h: 640 },
  poster: { w: 120, h: 180 },
  landscape: { w: 240, h: 135 },
};

/** FNV-1a over the seed — small, fast and the same on every device. */
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The drawn stand-in for a title with no picture (Marquee's art recipe, as
 * the hub boards and the arcade's ArcadeArt draw every title): a flat sky, a
 * soft glow around a sun, a mid silhouette and a dark front silhouette —
 * peaks, a city or a lone figure. Palette, landscape and sun position are
 * picked from the seed, so the choice is stable and never random per render.
 *
 * Decorative: hidden from screen readers (the card or slide around it says
 * what it is) and untouchable. Fills its parent, sliced like `object-fit:
 * cover`, so it suits any box the caller gives it.
 */
export const HubFallbackArt = memo(function HubFallbackArt({ seed, format, style }: Props) {
  const h = hashSeed(seed || "-");
  const palette = PALETTES[h % PALETTES.length];
  const kind = KINDS[(h >>> 8) % KINDS.length];
  // Sun placement, 0..1 — a second slice of the same hash.
  const sun = ((h >>> 16) % 1000) / 1000;
  const box = VIEWBOX[format];

  let art: ReactNode;
  if (format === "hero") {
    const [far, near] = HERO_PATHS[kind];
    // The board's `sx = 90 + mx * 2.4` over its mx range of 34–88.
    const cx = Math.round(170 + sun * 130);
    art = (
      <>
        <Circle cx={cx} cy={210} r={130} fill={palette.glow} opacity={0.14} />
        <Circle cx={cx} cy={210} r={62} fill={palette.glow} />
        <Path d={far} fill={palette.mid} />
        <Path d={near} fill={palette.dark} />
      </>
    );
  } else if (format === "landscape") {
    const [far, near] = LANDSCAPE_PATHS[kind];
    const cx = Math.round(52 + sun * 140);
    art = (
      <>
        <Circle cx={cx} cy={36} r={34} fill={palette.glow} opacity={0.16} />
        <Circle cx={cx} cy={36} r={20} fill={palette.glow} />
        <Path d={far} fill={palette.mid} />
        <Path d={near} fill={palette.dark} />
      </>
    );
  } else {
    const [far, near] = POSTER_PATHS[kind];
    const cx = Math.round(32 + sun * 56);
    const r = 12 + ((h >>> 4) % 7);
    art = (
      <>
        <Circle cx={cx} cy={46} r={r * 1.8} fill={palette.glow} opacity={0.14} />
        <Circle cx={cx} cy={46} r={r} fill={palette.glow} />
        <Path d={far} fill={palette.mid} />
        <Path d={near} fill={palette.dark} />
      </>
    );
  }

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { backgroundColor: palette.bg }, style]}
    >
      <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${box.w} ${box.h}`} preserveAspectRatio="xMidYMid slice">
        {/* The sky is the View's own fill. */}
        {art}
      </Svg>
    </View>
  );
});
