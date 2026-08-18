import { useCallback, useState, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/theme";

/**
 * The editorial artwork primitive — a DRAWN ground that every photograph in the
 * press room sits on top of.
 *
 * Two problems solved by one box:
 *
 * 1. NETWORK. The well's photography comes from picsum.photos and i.pravatar.cc.
 *    A slow, offline or filtered device used to leave a marketing page full of
 *    grey rectangles. The composition below is drawn locally from theme tokens,
 *    a gradient and an Ionicon — so the section reads as finished with zero
 *    network, and the photo is an upgrade rather than a dependency.
 *
 * 2. LAYOUT. The ground carries an EXPLICIT height, so a tile can never collapse
 *    just because its only children are absolutely positioned. That is exactly
 *    how the Behind-the-Scenes grid became four hairlines: `aspectRatio` on a
 *    child of a wrapping `alignItems: stretch` row resolves to nothing, and an
 *    absoluteFill image plus an absolute caption contribute no layout height.
 *
 * The composition is EDITORIAL material, not advertising: the inks are muted and
 * textural — toned paper, a film rail, a printed watermark — never the solid
 * role-coloured aurora a CampaignCard draws. It is seeded by the item's index,
 * so every tile differs from its neighbour and every tile is identical to
 * itself on every render (no Math.random, nothing to re-roll on a re-layout).
 */
export type EditorialArtKind = "scene" | "story" | "person";

interface Props extends ViewProps {
  /** Item index. Same seed, same composition, forever. */
  seed: number;
  /** Picks the watermark vocabulary. */
  kind?: EditorialArtKind;
  /** Optional photograph, layered ON TOP with a fade-in. */
  uri?: string;
  /** Measured box. Both are real numbers — this is the layout floor. */
  width: number;
  height: number;
  radius?: number;
  /** Adds the well's hairline ring, the way a photograph is framed in here. */
  bordered?: boolean;
  /** Fill the parent's width instead of the measured `width` (the width is then
      used only to scale the drawn marks). Keeps a 100%-wide lead image honest
      against a parent's 1pt border without leaving a sliver of card showing. */
  stretch?: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

const GLYPHS: Record<EditorialArtKind, readonly (keyof typeof Ionicons.glyphMap)[]> = {
  scene: ["film-outline", "videocam-outline", "aperture-outline", "color-filter-outline", "flash-outline"],
  story: ["newspaper-outline", "megaphone-outline", "globe-outline", "bookmark-outline"],
  person: ["person-outline", "happy-outline", "people-outline", "body-outline"],
};

/**
 * Toned-paper ink pairs, drawn from the CONTENT hues only.
 *
 * `aurora.emerald` and `aurora.gold` are deliberately absent. The palette
 * assigns them roles — emerald is money, gold is premium — and AuroraBackdrop
 * gates them behind a caller-declared `tone` for exactly that reason. Handing
 * them out by `index % 5` threw the gate away and grounded a Behind-the-Scenes
 * tile about a colour suite in the wallet's green. Five pairs, not four, so the
 * ink wheel stays coprime-ish with the 4-long glyph wheels and the two don't
 * rotate in lockstep.
 */
const INKS: readonly (readonly [string, string])[] = [
  [theme.colors.aurora.indigo, theme.colors.aurora.violet],
  [theme.colors.aurora.violet, theme.colors.aurora.crimson],
  [theme.colors.aurora.crimson, theme.colors.aurora.indigo],
  [theme.colors.aurora.violet, theme.colors.aurora.indigo],
  [theme.colors.aurora.indigo, theme.colors.aurora.crimson],
];

/** Below this the marks stop being legible and only the tint + glyph are drawn. */
const DETAIL_FLOOR = 88;

function alpha(hex: string, value: number): string {
  const channel = Math.round(Math.max(0, Math.min(1, value)) * 255)
    .toString(16)
    .padStart(2, "0");
  return hex + channel;
}

/** Deterministic 0–1 from an integer seed. Stable across renders and reloads. */
function noise(seed: number, salt: number): number {
  const value = Math.sin((seed + 1) * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * The DISCRETE choices — ink pair and glyph — rotate rather than hash. Hashing
 * them looked right in theory and wrong on screen: with only four tiles in a
 * grid, a hash happily hands two neighbours the same tint and the same glyph.
 * A rotation guarantees that no two adjacent items in a section ever match,
 * which is the property the grid actually needs. Continuous values (positions,
 * sizes, angles) still come from `noise`, where collisions are invisible.
 */
function rotate<T>(items: readonly T[], seed: number): T {
  const length = items.length;
  return items[((Math.round(seed) % length) + length) % length];
}

export function EditorialArt({
  seed,
  kind = "scene",
  uri,
  width,
  height,
  radius = theme.radius["2xl"],
  bordered,
  stretch,
  children,
  style,
  ...rest
}: Props) {
  // A photo that 404s, times out or is blocked simply stops being rendered —
  // the drawn ground underneath is already the finished picture.
  const [failed, setFailed] = useState(false);
  const onError = useCallback(() => setFailed(true), []);
  // Every other animation on this page honours the OS setting; the photo's
  // cross-fade was the one that did not.
  const reduceMotion = useReducedMotion();

  const size = Math.min(width, height);
  const detailed = size >= DETAIL_FLOOR;

  const [inkA, inkB] = rotate(INKS, seed);
  const leftToRight = noise(seed, 2) < 0.5;

  const ringSize = size * (1 + noise(seed, 3) * 0.55);
  const ringLeft = width * (noise(seed, 4) * 0.65 - 0.28);
  const ringTop = height * (noise(seed, 5) * 0.6 - 0.22);

  const discSize = size * (0.3 + noise(seed, 6) * 0.22);
  const discLeft = width * (0.42 + noise(seed, 7) * 0.42);
  const discTop = height * (0.04 + noise(seed, 8) * 0.28);

  const railOnLeft = noise(seed, 9) < 0.5;
  const perfWidth = Math.max(4, Math.round(size * 0.055));
  const perfHeight = Math.round(perfWidth * 1.7);
  // Scaled to the box: the count that reads as a film rail on a 200pt tile
  // reads as a smudge on a 96pt thumbnail.
  const perfCount = Math.max(3, Math.min(7, Math.round(height / 44)));
  const perforations = Array.from({ length: perfCount }, (_, slot) => slot);

  const glyphSize = Math.round(size * (detailed ? 0.58 : 0.66));
  const glyphShift = {
    transform: [
      { translateX: (noise(seed, 10) - 0.5) * width * 0.2 },
      { translateY: (noise(seed, 11) - 0.5) * height * 0.14 },
    ],
  };

  return (
    <View
      {...rest}
      style={[
        styles.box,
        { height, borderRadius: radius },
        stretch ? styles.stretch : { width },
        bordered && styles.bordered,
        style,
      ]}
    >
      {/* --- the drawn ground: always rendered, always underneath ---
          0.38 is close to the 0.42 AuroraBackdrop lays down, but it composites
          against `background` rather than a lifted surface, so it reads as a
          tint on dark stock instead of a wash. Raise it, or lighten the plate
          under it, and the well turns back into an advertisement. */}
      <LinearGradient
        colors={[alpha(inkA, 0.38), alpha(inkB, 0.18), "transparent"]}
        locations={[0, 0.55, 1]}
        start={{ x: leftToRight ? 0 : 1, y: 0 }}
        end={{ x: leftToRight ? 1 : 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[theme.colors.ring, "transparent"]}
        locations={[0, 0.6]}
        start={{ x: leftToRight ? 1 : 0, y: 0 }}
        end={{ x: leftToRight ? 0.1 : 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {detailed && (
        <>
          <View
            pointerEvents="none"
            style={[
              styles.mark,
              styles.ring,
              { width: ringSize, height: ringSize, borderRadius: ringSize / 2, left: ringLeft, top: ringTop },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.mark,
              styles.disc,
              { width: discSize, height: discSize, borderRadius: discSize / 2, left: discLeft, top: discTop },
            ]}
          />
          {/* A film rail — the one mark that says "this is MyanFlix" rather than
              "this is a placeholder". Scenes only: `kind` switches the whole
              watermark vocabulary, so punching sprocket holes down the side of
              a newspaper story or a portrait contradicted the glyph sitting in
              the middle of it. */}
          {kind === "scene" && (
            <View
              pointerEvents="none"
              style={[styles.rail, railOnLeft ? { left: perfWidth } : { right: perfWidth }]}
            >
              {perforations.map((slot) => (
                <View
                  key={slot}
                  style={[
                    styles.perf,
                    { width: perfWidth, height: perfHeight, borderRadius: Math.round(perfWidth / 3) },
                  ]}
                />
              ))}
            </View>
          )}
        </>
      )}

      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
        {/* Below the detail floor the glyph IS the composition — there are no
            marks left to carry it — so it stops being a watermark behind other
            things and stops being nudged off centre. At 34pt a 0.13-opacity
            mark displaced by 10% of its own width is an empty tinted dot, and
            those are the two smallest, most network-dependent images here. */}
        <Ionicons
          name={rotate(GLYPHS[kind], seed)}
          size={glyphSize}
          color={theme.colors.text}
          style={[{ opacity: detailed ? 0.13 : 0.3 }, detailed && glyphShift]}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        />
      </View>

      <LinearGradient
        colors={["transparent", theme.colors.scrimSoft]}
        locations={[0.5, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* --- the photograph, layered on top --- */}
      {uri && !failed && (
        <Image
          source={{ uri }}
          // NO backgroundColor: an unloaded image must be transparent so the
          // drawn ground is what the reader sees, not a grey plate over it.
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={reduceMotion ? 0 : 260}
          cachePolicy="memory-disk"
          onError={onError}
        />
      )}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * `background`, NOT `skeleton`. Two reasons, and the second is the one that
   * showed: `skeleton` means "the image hasn't arrived" everywhere else in the
   * app (MediaCard, DetailHero, Skeleton), which is precisely the read this
   * primitive exists to avoid — and at #1E2331 it is three steps LIGHTER than
   * the `surfaceSunken` band the editorial well insets these tiles into, so
   * every drawn ground sat above the band instead of in it. Flat, sunken
   * material grounds at or below its band.
   */
  box: { overflow: "hidden", backgroundColor: theme.colors.background },
  stretch: { alignSelf: "stretch" },
  bordered: { borderWidth: 1, borderColor: theme.colors.ring },
  mark: { position: "absolute" },
  ring: { borderWidth: 1, borderColor: theme.colors.ring },
  disc: { backgroundColor: theme.colors.ring },
  rail: { position: "absolute", top: 0, bottom: 0, justifyContent: "space-around" },
  perf: { backgroundColor: theme.colors.borderStrong },
  center: { alignItems: "center", justifyContent: "center" },
});
