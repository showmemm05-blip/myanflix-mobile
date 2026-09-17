import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, Polygon, RadialGradient, Rect, Stop } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "@/theme";
import { PLATE_BASE, type PlatePalette } from "@/data/games";

interface GamePlateProps {
  /** The game's two identity hues — see PLATE_PALETTES in src/data/games.ts. */
  palette: PlatePalette;
  /** Corner radius token; "none" for a full-bleed stage. */
  radius?: keyof typeof theme.radius | "none";
  /** Bottom dissolve so overlay text always sits on dark — on by default. */
  scrim?: boolean;
  /** Desaturating wash for Coming Soon / announced teasers. */
  dimmed?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Overlay content, rendered above the scrim. */
  children?: React.ReactNode;
}

/**
 * The native replacement for the web's generated SVG artwork plates — no
 * image files, no network. One fixed abstract composition whose identity is
 * carried entirely by the palette: two radial hue washes, a faint top
 * highlight, three slanted shards and a thin accent ring, all inside a
 * 160x90 stage that slices to whatever box the parent gives it (the caller
 * owns aspectRatio/size via `style`).
 *
 * Deliberately no grain texture — not worth the extra draw cost on low-end
 * Android.
 */
export const GamePlate = React.memo(function GamePlate({
  palette,
  radius = "xl",
  scrim = true,
  dimmed = false,
  style,
  children,
}: GamePlateProps) {
  const { hueA, hueB } = palette;
  // Gradient ids are resolved within their own <Svg> subtree, but derive them
  // from the palette anyway so two plates can never cross-reference.
  const uid = `${hueA.slice(1)}${hueB.slice(1)}`;
  const idA = `gpA${uid}`;
  const idB = `gpB${uid}`;
  const idHi = `gpHi${uid}`;

  return (
    <View
      style={[
        styles.box,
        { borderRadius: radius === "none" ? 0 : theme.radius[radius] },
        style,
      ]}
    >
      <Svg
        style={StyleSheet.absoluteFill}
        viewBox="0 0 160 90"
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          {/* hueA wash, upper-left (24%, 20%). */}
          <RadialGradient id={idA} gradientUnits="userSpaceOnUse" cx="38.4" cy="18" r="128">
            <Stop offset="0" stopColor={hueA} stopOpacity="0.85" />
            <Stop offset="1" stopColor={hueA} stopOpacity="0" />
          </RadialGradient>
          {/* hueB wash, lower-right (80%, 70%). */}
          <RadialGradient id={idB} gradientUnits="userSpaceOnUse" cx="128" cy="63" r="136">
            <Stop offset="0" stopColor={hueB} stopOpacity="0.65" />
            <Stop offset="1" stopColor={hueB} stopOpacity="0" />
          </RadialGradient>
          {/* Faint white highlight along the top (60%, 10%). */}
          <RadialGradient id={idHi} gradientUnits="userSpaceOnUse" cx="96" cy="9" r="96">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.12" />
            <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Rect x="0" y="0" width="160" height="90" fill={PLATE_BASE} />
        <Rect x="0" y="0" width="160" height="90" fill={`url(#${idA})`} />
        <Rect x="0" y="0" width="160" height="90" fill={`url(#${idB})`} />
        <Rect x="0" y="0" width="160" height="90" fill={`url(#${idHi})`} />

        {/* Fixed shard geometry, same for every game — the palette is the identity. */}
        <Polygon points="0,90 58,0 90,0 28,90" fill={hueA} opacity={0.12} />
        <Polygon points="70,90 118,0 138,0 92,90" fill={hueB} opacity={0.16} />
        <Polygon points="118,90 160,26 160,58 138,90" fill={hueA} opacity={0.1} />

        {/* Thin accent ring. */}
        <Circle cx="128" cy="22" r="14" stroke={hueA} strokeWidth="1" fill="none" opacity={0.3} />
      </Svg>

      {dimmed ? <View pointerEvents="none" style={styles.dim} /> : null}

      {scrim ? (
        <LinearGradient
          pointerEvents="none"
          colors={["transparent", "rgba(11,13,22,0.72)"]}
          style={styles.scrim}
        />
      ) : null}

      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  box: {
    overflow: "hidden",
    backgroundColor: PLATE_BASE,
    borderWidth: 1,
    borderColor: theme.colors.ring,
  },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(11,13,22,0.45)",
  },
  scrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "60%",
  },
});
