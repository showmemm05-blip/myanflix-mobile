import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import type { GameId } from "@/data/games";
import {
  ARCADE_SCENES,
  HERO_PATHS,
  LANDSCAPE_PATHS,
  POSTER_PATHS,
} from "@/components/arcade/arcadeScenes";
import { theme } from "@/theme";

/**
 * - `hero` — the 390×560 stage behind a carousel slide.
 * - `landscape` — 16:9 (featured cards, spotlight banners, live thumbnails).
 * - `poster` — 2:3 (the discover rail, the free/limited duo).
 */
export type ArcadeArtFormat = "hero" | "landscape" | "poster";

interface Props {
  gameId: GameId;
  format: ArcadeArtFormat;
  /**
   * The board's dark band along the bottom of a card that carries its title
   * IN the art (featured, discover) — keeps that title legible on a bright sky.
   */
  band?: boolean;
  /** A soft halo around the sun (the new-release spotlight). */
  halo?: boolean;
  /** Draw the art at 55% over its sky — the not-yet-released spotlight. */
  dimmed?: boolean;
  /** Defaults to filling the parent (absolute fill). */
  style?: StyleProp<ViewStyle>;
}

const VIEWBOX: Record<ArcadeArtFormat, { w: number; h: number }> = {
  hero: { w: 390, h: 560 },
  landscape: { w: 240, h: 135 },
  poster: { w: 120, h: 180 },
};

/**
 * One game's scene, drawn locally with react-native-svg — no image files, no
 * network. Decorative: hidden from screen readers (the card around it carries
 * the spoken label). The stage slices to whatever box the parent gives it,
 * like `object-fit: cover`.
 */
export const ArcadeArt = React.memo(function ArcadeArt({
  gameId,
  format,
  band = false,
  halo = false,
  dimmed = false,
  style,
}: Props) {
  const scene = ARCADE_SCENES[gameId];
  const { w, h } = VIEWBOX[format];

  let art: React.ReactNode;
  if (format === "hero") {
    const [far, near] = HERO_PATHS[scene.kind];
    art = (
      <>
        <Circle cx={scene.hx} cy={170} r={130} fill={scene.glow} opacity={0.14} />
        <Circle cx={scene.hx} cy={170} r={60} fill={scene.glow} />
        <Path d={far} fill={scene.mid} />
        <Path d={near} fill={scene.dark} />
      </>
    );
  } else if (format === "landscape") {
    const [far, near] = LANDSCAPE_PATHS[scene.kind];
    art = (
      <>
        {halo && <Circle cx={scene.wx} cy={scene.wy} r={scene.wr * 1.7} fill={scene.glow} opacity={0.16} />}
        <Circle cx={scene.wx} cy={scene.wy} r={scene.wr} fill={scene.glow} />
        {scene.stars?.map(([x, y, r]) => (
          <Circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={scene.glow} />
        ))}
        <Path d={far} fill={scene.mid} />
        <Path d={near} fill={scene.dark} />
        {band && <Rect y={88} width={240} height={47} fill={theme.colors.background} opacity={0.35} />}
      </>
    );
  } else {
    const [far, near] = POSTER_PATHS[scene.kind];
    art = (
      <>
        <Circle cx={scene.mx} cy={scene.my} r={scene.mr} fill={scene.glow} />
        <Path d={far} fill={scene.mid} />
        <Path d={near} fill={scene.dark} />
        {band && <Rect y={118} width={120} height={62} fill={theme.colors.background} opacity={0.35} />}
      </>
    );
  }

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { backgroundColor: scene.bg }, style]}
    >
      <Svg
        style={[StyleSheet.absoluteFill, dimmed && styles.dimmed]}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="xMidYMid slice"
      >
        {/* The sky is the View's own fill, so a dimmed scene fades onto it. */}
        {art}
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  dimmed: { opacity: 0.55 },
});
