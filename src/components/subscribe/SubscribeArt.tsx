import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, G, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { theme, withAlpha } from "@/theme";

/** The crown both the stage art and the Subscribe button draw (Subscribe.dc.html). */
const CROWN_PATH = "M3 18h18l1-11-5.5 4L12 4 7.5 11 2 7z";

/** The Subscribe button's 18pt crown, in the button's own ink. */
export function CrownGlyph({ size = 18, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={CROWN_PATH} fill={color} />
    </Svg>
  );
}

/**
 * The stage's own artwork palette (warm black, amber glow, curtain crimsons) —
 * illustration colours like the arcade's scenes (arcade/arcadeScenes.ts), not
 * UI tokens.
 */
const ART = {
  stage: "#0D0B08",
  glowMid: "#B9822A",
  curtainOuter: "#1E0709",
  curtainInner: "#2C0A0D",
} as const;

/** The board's stage height before the status-bar inset is added on top. */
export const SUBSCRIBE_ART_HEIGHT = 248;

/**
 * Subscribe.dc.html's stage: a gold crown under three spotlight beams, framed
 * by crimson curtains, with a warm glow and four gold motes — drawn, because
 * this is brand artwork rather than a stand-in for a catalogue image. It
 * slices to whatever width the phone has (the curtains crop at the edges of a
 * narrow screen) and dissolves into the page over its bottom 120pt so the
 * title can overlap it. Decorative: hidden from screen readers.
 */
export const SubscribeArt = memo(function SubscribeArt({ height }: { height: number }) {
  return (
    <View
      style={[styles.stage, { height }]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 390 248" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <RadialGradient id="subscribeGlow" cx="50%" cy="36%" r="62%">
            <Stop offset="0" stopColor={theme.colors.premium} stopOpacity={0.42} />
            <Stop offset="0.45" stopColor={ART.glowMid} stopOpacity={0.14} />
            <Stop offset="1" stopColor={theme.colors.background} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={390} height={248} fill={ART.stage} />
        <Path d="M195 -10 L60 248 H122 Z" fill={theme.colors.premium} opacity={0.05} />
        <Path d="M195 -10 L168 248 H222 Z" fill={theme.colors.premium} opacity={0.07} />
        <Path d="M195 -10 L268 248 H330 Z" fill={theme.colors.premium} opacity={0.05} />
        <Rect width={390} height={248} fill="url(#subscribeGlow)" />
        <Path d="M0 0 H64 C52 80 74 160 42 248 H0 Z" fill={ART.curtainOuter} />
        <Path d="M0 0 H34 C26 90 40 170 18 248 H0 Z" fill={ART.curtainInner} />
        <Path d="M390 0 H326 C338 80 316 160 348 248 H390 Z" fill={ART.curtainOuter} />
        <Path d="M390 0 H356 C364 90 350 170 372 248 H390 Z" fill={ART.curtainInner} />
        <G transform="translate(147 34) scale(4)">
          <Path d={CROWN_PATH} fill={theme.colors.premium} />
          <Rect x={3} y={19.5} width={18} height={2} rx={1} fill={theme.colors.premium} />
        </G>
        <Circle cx={120} cy={66} r={2} fill={theme.colors.premium} opacity={0.7} />
        <Circle cx={276} cy={48} r={1.5} fill={theme.colors.premium} opacity={0.6} />
        <Circle cx={298} cy={112} r={2} fill={theme.colors.premium} opacity={0.5} />
        <Circle cx={94} cy={128} r={1.5} fill={theme.colors.premium} opacity={0.5} />
      </Svg>
      <LinearGradient
        colors={[withAlpha(theme.colors.background, 0), theme.colors.background] as const}
        style={styles.scrim}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  stage: { width: "100%", overflow: "hidden", backgroundColor: ART.stage },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 120 },
});
