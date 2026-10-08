import { memo, useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { theme, withAlpha } from "@/theme";

/** The art's own stage (Wallet.dc.html); it slices to whatever box it is given. */
const STAGE_W = 390;
const STAGE_H = 440;
/** The marquee's row of bulbs: 15 gold dots along a shallow arc over the right half. */
const BULBS = [96, 93, 90, 88, 86, 85, 84, 84, 84, 85, 86, 88, 90, 93, 96].map((cy, index) => ({
  cx: 170 + index * 15,
  cy,
}));
const SKYLINE = [
  "M0 312 h22 v-26 h20 v12 h18 v-40 h26 v24 h14 v-16 h28 v32 h18 v-54 h30 v36 h16 v-20",
  "h24 v28 h20 v-12 h28 v-34 h22 v48 h26 v-18 h20 v24 H390 V440 H0 Z",
].join(" ");
const HILLS = "M0 370 C80 350 160 362 240 346 C300 334 350 340 390 332 V440 H0 Z";
/** The board's bottom fade: clear, then the ground at 82% by 55%, then the ground. */
const BOTTOM_FADE = [
  withAlpha(theme.colors.background, 0),
  withAlpha(theme.colors.background, 0.82),
  theme.colors.background,
] as const;
const BOTTOM_FADE_STOPS = [0, 0.55, 1] as const;
const BOTTOM_FADE_HEIGHT = 280;

/** The board's `.open`: from 0.4 opacity and 1.06 scale to rest over .5s, ease-out. */
const OPEN_MS = 500;
const OPEN_EASING = Easing.bezier(0.2, 0.8, 0.2, 1);

interface Props {
  height: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * The wallet hero's backdrop — a dark crimson night with a marquee's gold
 * bulbs and a city skyline, fading into the page at the bottom so the balance
 * and the tiles sit on it legibly. Pure decoration (the wallet has no image of
 * its own to show), drawn from theme tones layered over the ground, so it
 * needs no files and no network. It settles in once on mount; under reduce
 * motion it is simply there.
 */
export const WalletHeroArt = memo(function WalletHeroArt({ height, style }: Props) {
  const reduceMotion = useReducedMotion();
  const open = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      open.value = 1;
      return;
    }
    open.value = withTiming(1, { duration: OPEN_MS, easing: OPEN_EASING });
  }, [open, reduceMotion]);
  const openStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + 0.6 * open.value,
    transform: [{ scale: 1.06 - 0.06 * open.value }],
  }));

  return (
    <View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.root, { height }, style]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, openStyle]}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} preserveAspectRatio="xMidYMid slice">
          <Rect width={STAGE_W} height={STAGE_H} fill={theme.colors.background} />
          {/* The night: the ground warmed with a little crimson. */}
          <Rect width={STAGE_W} height={STAGE_H} fill={theme.colors.primary} fillOpacity={0.07} />
          <Circle cx={300} cy={120} r={190} fill={theme.colors.primary} fillOpacity={0.14} />
          <Circle cx={300} cy={120} r={92} fill={theme.colors.primary} fillOpacity={0.16} />
          <Circle cx={40} cy={260} r={140} fill={theme.colors.premium} fillOpacity={0.06} />
          {BULBS.map((bulb) => (
            <Circle key={bulb.cx} cx={bulb.cx} cy={bulb.cy} r={2.5} fill={theme.colors.premium} fillOpacity={0.55} />
          ))}
          <Path d={SKYLINE} fill={theme.colors.primary} fillOpacity={0.12} />
          <Path d={HILLS} fill={theme.colors.background} />
          <Rect y={330} width={STAGE_W} height={110} fill={theme.colors.background} fillOpacity={0.35} />
        </Svg>
      </Animated.View>
      <LinearGradient
        colors={BOTTOM_FADE}
        locations={BOTTOM_FADE_STOPS}
        style={[styles.bottomFade, { height: Math.min(BOTTOM_FADE_HEIGHT, height) }]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  root: { position: "absolute", top: 0, left: 0, right: 0, overflow: "hidden" },
  bottomFade: { position: "absolute", left: 0, right: 0, bottom: 0 },
});
